import dotenv from "dotenv";
import puppeteer from "puppeteer";
import axios from "axios";
import { Request, Response } from "express";

import {
  CommentsAPIResponse,
  AxiosCommentsResponse
} from "../utils/type_utils";

import { 
  generate_url,
} from "../utils/helper_functions"

import { knex_client } from "../db/knex_client";

dotenv.config()

const username = process.env.BOT_ACCT_USERNAME;
const passWord = process.env.BOT_ACCT_PASSWORD;

export const scrape_comments = async(req: Request, res: Response) => {
  const username_to_scrape: string = req.body?.username;
  const athlete_id = req.body?.athlete_id
  const batch_id = req.body?.batch_id
  const MAX_POSTS_TO_SCRAPE = 100;
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
  const comments_regex =
    /https:\/\/www.instagram.com\/api\/v1\/media\/(\d+)\/comments\//;
  await page.waitForTimeout(2000);
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    req.continue()
  });

  let posts_handling_tracker = 0;
  let completed_comments_scraping = false;
  
  page.on("response", async (res) => {
    if (comments_regex.test(res.request().url())) {
      console.log("In comments handler")
      const post_pk = res.request().url().split("/")[6];
      posts_handling_tracker++
      const comments_response: CommentsAPIResponse = await res.json();
      const post_metadata = JSON.stringify({
        caption: comments_response.caption,
        comment_count: comments_response.comment_count
      })
      const db_update_packet = {
        athlete_id,
        batch_id,
        post_batch_position: posts_handling_tracker,
        post_id: post_pk,
        post_metadata: JSON.stringify(post_metadata),
        comments: JSON.stringify([])
      }
      const comments_exist = comments_response?.comments && comments_response?.comments?.length
      if (comments_exist) {
        const comments_holder = [];
        comments_response?.comments?.forEach(comment => {
          comments_holder.push({
            child_comment_count: comment?.child_comment_count,
            comment_like_count: comment?.comment_like_count,
            text: comment?.text ?? "",
            username: comment?.user?.username,
            profile_pic_url: comment?.user?.profile_pic_url,
            user_pk_id: comment?.user?.pk_id
          })
        })
        let comments_min_id = comments_response?.next_min_id ?? "";
        let has_more_comments = comments_exist ? comments_response?.has_more_headload_comments : false;
        while (has_more_comments) {
          //console.log(`In axios while. Length: ${posts_list[posts_list.length - 1].comments.length + child_comments}, Count: ${posts_list[posts_list.length - 1].comment_count}`);
          const config = {
            headers: res.request().headers(),
          };
          //console.log(`Still in Axios while: pk: ${pk}, min_id: ${comments_min_id}`)
          const dynamic_comment_url = new URL(
            `https://www.instagram.com/api/v1/media/${post_pk}/comments/?can_support_threading=true`
          );
          const dynamic_url_params = dynamic_comment_url.searchParams;
          dynamic_url_params.set("min_id", comments_min_id);
          const comments_url = generate_url(
            dynamic_comment_url,
            dynamic_url_params
          );
          //console.log(`Comments url in axios while: ${comments_url}`);
          let axios_resp: AxiosCommentsResponse;
          try {
            axios_resp = await axios.get(comments_url, config);
          } catch (e) {
            console.log(e, "Axios comments error");
          }
          if (
            !axios_resp.data ||
            !axios_resp.data?.comments?.length
          ) {
            break;
          }
          axios_resp.data.comments.forEach(comment => {
            comments_holder.push({
              child_comment_count: comment?.child_comment_count,
              comment_like_count: comment?.comment_like_count,
              text: comment?.text ?? "",
              username: comment?.user?.username,
              profile_pic_url: comment?.user?.profile_pic_url,
              user_pk_id: comment?.user?.pk_id
            })
          })
          if (
            !axios_resp.data?.has_more_headload_comments
          ) {
            break;
          }
          has_more_comments = axios_resp.data.has_more_headload_comments;
          comments_min_id = axios_resp.data.next_min_id;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        db_update_packet.comments = JSON.stringify(comments_holder);
      }
      await knex_client('ig_fb_posts').insert(db_update_packet)
      //Go to next post
      //await page.waitForSelector("div._abm0 > span > svg[aria-label='Next']");
      await page.waitForTimeout(1500);
      const next_post_button = await page.$(
        "div._abm0 > span > svg[aria-label='Next']"
      );
      if (next_post_button && posts_handling_tracker < MAX_POSTS_TO_SCRAPE) {
        const next_post_button_element = await page.evaluateHandle(
          (element) => {
            return element.closest("button._abl-");
          },
          next_post_button
        );
        await next_post_button_element.click();
        await page.waitForTimeout(1500);
      } else {
        completed_comments_scraping = true;
        await page.close();
      }
    }
    return;
  });

  await page.type("input[name=username]", username, { delay: 20 });
  await page.type("input[name=password]", passWord, { delay: 20 });
  await page.click("button[type=submit]", { delay: 2000 });

  //Handle turn notifications on/off popup
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
  await page.waitForSelector('a[href^="/p/"]');
  const first_post_element = await page.$('a[href^="/p/"]');
  console.log(first_post_element, "ABI POST ELEMENT NO DEY???");
  await first_post_element.click();

  while (!completed_comments_scraping) {
    console.log(`Waiting to finish comments scraping`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  
  res.status(201).json({
    status: "successful",
  });
}