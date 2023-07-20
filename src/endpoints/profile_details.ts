import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { Response } from 'express'
import { RequestUsername, ProfileBasics, ProfileType } from '../utils/type_utils'
import { normalize_profile_basics } from "../utils/helper_functions";

dotenv.config()

const acct_username = process.env.BOT_ACCT_USERNAME;
const password = process.env.BOT_ACCT_PASSWORD;

export const scrape_profile_details = async (req: RequestUsername, res: Response) => {
  const { username }: {username: string} = req.body
  const browser = await puppeteer.launch({
    args: ["--incognito"],
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.instagram.com/accounts/login", {
    waitUntil: "networkidle2",
  });
  await page.waitForTimeout(2000);
  await page.setRequestInterception(true);
  page.on("request", async(pup_req) => {
    pup_req.continue()
  })
  let has_grabbed_pp_deets = false;
  let basic_profile_data: ProfileType;
  page.on("response", async(pup_res) => {
    if(pup_res.request().url().startsWith('https://www.instagram.com/api/v1/users/web_profile_info/?username=') && !has_grabbed_pp_deets) {
      const profile_response: ProfileBasics = await pup_res.json();
      basic_profile_data = profile_response.data.user;
      has_grabbed_pp_deets = true;
    }
  })

  await page.type("input[name=username]", acct_username, { delay: 20 });
  await page.type("input[name=password]", password, { delay: 20 });
  await page.click("button[type=submit]", { delay: 2000 });

  //Handle turn on/off notifications popup
  try {
    await page.waitForSelector("._a9_1", { timeout: 16000000 });
    await page.click("._a9_1"); //click not now
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
  await page.close();
  res.status(200).json({
    profile_details: normalize_profile_basics(basic_profile_data)
  });
}