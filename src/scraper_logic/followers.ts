import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { Request, Response } from "express";

import { 
  FollowersReturnTemplate,
  FollowerRes,
  ProfilePicContainer, 
} from "../utils/type_utils";

import { 
  generate_url, 
  make_followers_request,
  text_count_to_num,
} from "../utils/helper_functions"

import { knex_client } from "../db/knex_client";

dotenv.config()

const username = process.env.BOT_ACCT_USERNAME;
const passWord = process.env.BOT_ACCT_PASSWORD;

export const scrape_followers = async(req: Request, res: Response) => {
  const username_to_scrape: string = req.body?.username;
  const athlete_id = req.body?.athlete_id
  const { batch_id: current_batch_id, followers: has_followers_data, profile_details: athlete_profile_details } = await knex_client('ig_fb_followers')
    .select('batch_id', 'followers', 'profile_details')
    .where({ athlete_id })
    .orderBy('batch_id', 'desc')
    .limit(1)
    .first() ?? { batch_id: 0, followers: 'not null' }
  const batch_id: number = has_followers_data ? (current_batch_id ?? 0) + 1 : current_batch_id //If no follower data exists, we are simply updating the same batch_id with the followers data, no need to increment
  if (!username_to_scrape) {
    res.json({ status: "Failed", message: "No username" });
  }
  console.log(username_to_scrape);
  const browser = await puppeteer.launch({
    args: ["--incognito"],
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
      console.log(req.url(), "FIRST FOLLOWERS API CALL URLLL");
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
  let followers_count = 0;
  let profile_pic_url;
  let has_grabbed_pp_url = false; //Since the string we're checking the profile request with could be common, we're using this flag to ensure that we only run the profile picture grabbing logic once and not do it multiple times
  
  page.on("response", async (res) => {
    if (res.request().url().startsWith('https://www.instagram.com/graphql/query/?query_hash=') && !has_grabbed_pp_url && has_followers_data) {
      const profile_response: ProfilePicContainer = await res.json();
      console.log(profile_response, 'PROFILE RESPONSEEEEEE')
      try{
        profile_pic_url = profile_response.data.user.reel.owner.profile_pic_url;
        has_grabbed_pp_url = true;
      } catch (err) {}
    }

    if (
      followers_regex.test(res.request().url()) &&
      followers_iteration_tracker == 0
    ) {
      followers_iteration_tracker++;
      console.log(res.request().url(), "REQUEST URL");
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
      console.log(`FOLLOWER COUNT BEFORE PROCEEDING: ${followers_count}`)
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
      console.log("ABOUT TO WRITE TO FILE");
      //write_array_to_file(final_followers_list, `${username_to_scrape}_followers`);
      //bulk_write_to_db(final_followers_list, process.env.SOC_MED_DBT_INSTA);

      console.log(
        completed_followers_scraping,
        "BEFORE SETTING COMPLETION FOLLOWERS"
      );
      completed_followers_scraping = true;
      console.log(
        completed_followers_scraping,
        "AFTER SETTING COMPLETION FOLLOWERS"
      );
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
      }).where({batch_id})
      await page.close();
    }
    return;
  });

  await page.type("input[name=username]", username, { delay: 20 });
  await page.type("input[name=password]", passWord, { delay: 20 });
  await page.click("button[type=submit]", { delay: 2000 });

  //Handle turn on/off notifications popup
  try {
    await page.waitForSelector("._a9_1", { timeout: 6000 });
    await page.click("._a9_1"); //click not now
  } catch (err) {
    console.log("No popup notification, skipping...")
  }

  await page.waitForSelector('a[href="#"]');
  await page.waitForTimeout(3000);
  const searchLink = await page.$('a[href="#"]');
  await searchLink.click();
  await page.waitForSelector('input[aria-label="Search input"]');
  await page.type('input[aria-label="Search input"]', username_to_scrape);
  await page.waitForTimeout(1000);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("NumpadEnter");
  await page.waitForTimeout(5000);
  if (has_followers_data) {
    /**
     * Will skip the set of instructions below if has_followers_data is null i.e. we have already scraped the athlete's profile
     * details(posts, and follower counts, pp url etc) and for some reason
     * something broke and we were not able to scrape actual followers data, so this time
     * we just want to scrape the followers data and update the existing batch id
     */
    await page.waitForSelector("._ac2a");
    const count_elements = await page.$$("._ac2a");
    const [
      posts_summary_count,
      followers_summary_count,
      following_summary_count,
    ] = await Promise.all(
      count_elements.map((count_element) =>
        page.evaluate((el) => el["outerText"], count_element)
      )
    );
    // const count_titles = await Promise.all(
    //   count_elements.map((count_element) =>
    //     page.evaluate((el) => el["title"], count_element)
    //   )
    // );
    // const followers_count_str = count_titles[1];
    followers_count = text_count_to_num(String(followers_summary_count));
    const following_count = text_count_to_num(String(following_summary_count))
    //console.log(followers_count, posts_summary_count, following_summary_count, "COUNTTTTTTS")
    const posts_count = text_count_to_num(String(posts_summary_count));
    const stats = {
      followers_count,
      following_count,
      posts_count,
      profile_pic_url
    };
    //write_obj_to_file(stats, `${username_to_scrape}_stats`);
    /**
     * TODO: When queue system is ready, we'll emit a message (with this data possibly) after this DB insert to indicate
     * that a response can be sent to the athlete informing them that we've commenced aggregating their data
     */
    await knex_client('ig_fb_followers').insert({
      athlete_id,
      batch_id,
      profile_details: JSON.stringify(stats) ?? "",
    })
  } else {
    try {
      const details: {
        followers_count: number
        following_count: number
        posts_count: number
        profile_pic_url: string
      } = JSON.parse(athlete_profile_details)
      followers_count = details.followers_count
    } catch (err) {
      console.log("Error occurred while deserializing profile details")
    }
  }

  await page.waitForSelector(`a[href^="/${username_to_scrape}/followers"]`);
  const followers_btn = await page.$(
    `a[href^="/${username_to_scrape}/followers"]`
  );
  while(!followers_count) {
    console.log(`Waiting to intialize follower count`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  await followers_btn.click();
  while (!completed_followers_scraping) {
    console.log(`Waiting to finish followers scraping`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  res.status(201).json({
    status: "successful",
  });
}