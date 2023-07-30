import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { Response } from 'express'
import { RequestUsername, ProfileBasics, ProfileType, CanCrawlFollowers } from '../utils/type_utils'
import { normalize_profile_basics } from "../utils/helper_functions";

dotenv.config()

const acct_username = process.env.BOT_ACCT_USERNAME;
const password = process.env.BOT_ACCT_PASSWORD;

export const scrape_profile_details = async (req: RequestUsername, res: Response) => {
  console.log("In scrape_profile_detais handler")
  const { username }: {username: string} = req.body
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  await page.goto("https://www.instagram.com/accounts/login", {
    waitUntil: "networkidle2",
  });
  const followers_regex = /https:\/\/www.instagram.com\/api\/v1\/friendships\/(\d+)\/followers\//;
  await page.waitForTimeout(2000);
  await page.setRequestInterception(true);
  page.on("request", async(pup_req) => {
    pup_req.continue()
  })
  let has_grabbed_pp_deets = false;
  let basic_profile_data: ProfileType;
  let is_private_profile = false;
  let can_crawl_all_followers = false;
  let has_checked_ff_biglist = false;
  page.on("response", async(pup_res) => {
    if(pup_res.request().url().startsWith('https://www.instagram.com/api/v1/users/web_profile_info/?username=') && !has_grabbed_pp_deets) {
      const profile_response: ProfileBasics = await pup_res.json();
      basic_profile_data = profile_response.data.user;
      has_grabbed_pp_deets = true;
      is_private_profile = basic_profile_data.is_private;
    }
    if (
      followers_regex.test(pup_res.request().url())
    ) {
      console.log("Did we get in the followers regex")
      const followers_details_response: CanCrawlFollowers = await pup_res.json();
      //console.log(followers_details_response, "Followers details response")
      can_crawl_all_followers = followers_details_response.big_list;
      has_checked_ff_biglist = true;
    }
  })

  await page.type("input[name=username]", acct_username, { delay: 20 });
  await page.type("input[name=password]", password, { delay: 20 });
  await page.click("button[type=submit]", { delay: 2000 });

  //Handle turn on/off notifications popup
  try {
    await page.waitForSelector('button[class="_acan _acap _acas _aj1-"]', { timeout: 3000 });
    const save_login_button =  await page.$('button[class="_acan _acap _acas _aj1-"]');
    if (save_login_button) {
      await save_login_button.click();
      console.log("Clicked save login");
    }
  } catch(err) {
    console.log("No save login dialog, skipping...");
  }
  try {
    await page.waitForSelector('div[role="dialog"]', { timeout: 3000 });
    const not_now_button = await page.$('button[class="_a9-- _a9_1"]');
    if (not_now_button){
      await not_now_button.click();
      console.log("clicked not_now");
    }
  } catch (err) {
    console.log("No popup notification, skipping...")
  }

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
  while (!has_grabbed_pp_deets) {
    console.log(`Waiting for profile details`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!is_private_profile) {
    console.log("About to click followers list")
    await page.waitForSelector(`a[href^="/${username}/followers"]`);
    const followers_btn = await page.$(
      `a[href^="/${username}/followers"]`
    );
    //console.log(followers_btn, 'followers button before clicking')
    await followers_btn.click();
    console.log("has clicked follower button")
    while (!has_checked_ff_biglist) {
      console.log(`Waiting for follower big_list check`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  await page.close();
  const profile_details = normalize_profile_basics(basic_profile_data);
  profile_details['can_crawl_all_followers'] = can_crawl_all_followers;
  res.status(200).json({
    profile_details,
  });
}