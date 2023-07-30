import dotenv from "dotenv";
import puppeteer from "puppeteer";

import { 
  FollowersReturnTemplate,
  FollowerRes,
  FollowersArg
} from "../utils/type_utils";

import { 
  generate_url, 
  make_followers_request,
} from "../utils/helper_functions"

import { knex_client } from "../db/knex_client";

dotenv.config()

const acct_username = process.env.BOT_ACCT_USERNAME;
const password = process.env.BOT_ACCT_PASSWORD;

export const scrape_followers = async(followers_arg: FollowersArg) => {
  console.log("Begin followers scraping")
  const {batch_id, athlete_id, followers_count, username } = followers_arg
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.instagram.com/accounts/login", {
    waitUntil: "networkidle2",
  });
  const followers_regex =
    /https:\/\/www.instagram.com\/api\/v1\/friendships\/(\d+)\/followers\//;
  await page.waitForTimeout(2000);
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    if (followers_regex.test(req.url())) {
      const url_req_details = new URL(req.url());
      //console.log(req.url(), "FIRST FOLLOWERS API CALL URLLL");
      const search_params = url_req_details.searchParams;
      search_params.set("count", "100");
      const foll_url = generate_url(url_req_details, search_params);
      req.continue({ url: foll_url });
    } else {
      //If the regex doesn't match, continue the request normally
      req.continue();
    }
  });

  let followers_iteration_tracker = 0;
  let completed_followers_scraping = false;
  let final_followers_list: FollowersReturnTemplate[];
  
  page.on("response", async (res) => {
    if (
      followers_regex.test(res.request().url()) &&
      followers_iteration_tracker == 0
    ) {
      followers_iteration_tracker++;
      //console.log(res.request().url(), "REQUEST URL");
      const initial_followers_response: FollowerRes = await res.json();
      const initial_followers_list: FollowersReturnTemplate[] =
        initial_followers_response.users.map((follower_obj) => {
          return {
            username: follower_obj.username,
            profile_pic_url: follower_obj.profile_pic_url,
            pk_id: follower_obj.pk_id,
          };
        });
      await page.waitForTimeout(2000);
      //console.log(`FOLLOWER COUNT BEFORE PROCEEDING: ${followers_count}`)
      if (initial_followers_list.length < followers_count) {
        final_followers_list = await make_followers_request(
          res.request().url(),
          initial_followers_response.next_max_id,
          initial_followers_list,
          res.request().headers(),
          followers_count,
        );
      } else {
        final_followers_list = initial_followers_list;
      }
      //console.log("ABOUT TO WRITE TO FILE");
      //write_array_to_file(final_followers_list, `${username_to_scrape}_followers`);
      //bulk_write_to_db(final_followers_list, process.env.SOC_MED_DBT_INSTA);
      completed_followers_scraping = true;
      //await page.waitForSelector('a[href^="/p/"]');
      const close_followers_dialog_button = await page.$(
        "button[class='_abl-'] > div > svg[aria-label='Close']"
      );
      const close_button_element = await page.evaluateHandle((element) => {
        return element.closest("button[class='_abl-']");
      }, close_followers_dialog_button);
      await close_button_element.click();
      console.log("DONE SCRAPING FOLLOWERS")
      //Add follower data to DB
      await knex_client('ig_fb_followers').update({
        followers: JSON.stringify(final_followers_list),
        scraped_followers: 'true',
      }).where({athlete_id, batch_id})
      await page.close();
    }
    return;
  });

  await page.type("input[name=username]", acct_username, { delay: 20 });
  await page.type("input[name=password]", password, { delay: 20 });
  await page.click("button[type=submit]", { delay: 2000 });

 // Handle turn on/off notifications popup
  try {
    await page.waitForSelector('button[class="_acan _acap _acas _aj1-"]', { timeout: 3000 });
    const save_login_button =  await page.$('button[class="_acan _acap _acas _aj1-"]');
    if (save_login_button) {
      await save_login_button.click();
    }
  } catch(err) {

  }
  try {
    await page.waitForSelector('div[role="dialog"]', { timeout: 3000 });
    const not_now_button = await page.$('button[class="_a9-- _a9_1"]');
    if (not_now_button){
      await not_now_button.click()
    }
  } catch (err) {
    console.log("No popup notification, skipping...")
  }
  // const notification_popup_dialog = await page.$('div[role="dialog"]');
  // if (notification_popup_dialog) {
  //   const not_now_button = await page.$('button[class="_a9-- _a9_1"]');
  //   await not_now_button.click();
  // }
  await page.waitForSelector('a[href="#"]');
  await page.waitForTimeout(3000);
  const searchLink = await page.$('a[href="#"]');
  await searchLink.click();
  await page.waitForSelector('input[aria-label="Search input"]');
  await page.type('input[aria-label="Search input"]', username);
  await page.waitForTimeout(1000);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("NumpadEnter");
  await page.waitForTimeout(5000);

  await page.waitForSelector(`a[href^="/${username}/followers"]`);
  const followers_btn = await page.$(
    `a[href^="/${username}/followers"]`
  );
  await followers_btn.click();
  while (!completed_followers_scraping) {
    console.log(`Waiting to finish followers scraping`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return "done";
}