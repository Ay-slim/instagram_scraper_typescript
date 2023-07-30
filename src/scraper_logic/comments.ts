import dotenv from "dotenv";
import puppeteer from "puppeteer";
import axios from "axios";

import {
  CommentsAPIResponse,
  AxiosCommentsResponse,
  PostsAPIResponse,
  AxiosPostsResponse
} from "../utils/type_utils";

import { 
  generate_url,
} from "../utils/helper_functions"

import { knex_client } from "../db/knex_client";

dotenv.config()

const username = process.env.BOT_ACCT_USERNAME;
const passWord = process.env.BOT_ACCT_PASSWORD;

export const scrape_comments = async(athlete_id: number, batch_id: number, username_to_scrape: string) => {
  const MAX_POSTS_TO_SCRAPE = 100;
  console.log(username_to_scrape);
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.instagram.com/accounts/login", {
    waitUntil: "networkidle2",
  });
  const comments_regex =
    /https:\/\/www.instagram.com\/api\/v1\/media\/(\d+)\/comments\//;
  const posts_regex = 
    /^https?:\/\/(?:www\.)?instagram\.com\/api\/v1\/feed\/user\/[\w.-]+(?:\/\w+)*\/?\?.*$/;
  await page.waitForTimeout(2000);
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    req.continue()
  });

  let posts_handling_tracker = 0;
  let completed_comments_scraping = false;
  let has_trapped_post_res = false;
  let completed_posts_scraping = false;
  const posts_img_url_dict: {[key: string]: string} = {}
  let num_of_img_lens = 0;
  
  page.on("response", async (res) => {
    if (posts_regex.test(res.request().url()) && !has_trapped_post_res) {
      const posts_response: PostsAPIResponse = await res.json();
      let has_more_posts: boolean = false;
      let next_max_id: string;
      num_of_img_lens += posts_response?.items?.length;
      posts_response?.items?.forEach(post_response => {
        posts_img_url_dict[post_response?.pk] = post_response?.image_versions2?.candidates[0]?.url ?? ""
      });
      has_more_posts = posts_response?.more_available && num_of_img_lens <= MAX_POSTS_TO_SCRAPE;
      next_max_id = posts_response?.next_max_id
      while(has_more_posts) {
        const config = {
          headers: res.request().headers(),
        };
        const dynamic_post_url = new URL(`https://www.instagram.com/api/v1/feed/user/${posts_response?.user?.pk}/?count=100`);
        const dynamic_post_url_params = dynamic_post_url.searchParams;
        dynamic_post_url_params.set("max_id", next_max_id);
        const post_url = generate_url(dynamic_post_url, dynamic_post_url_params);
        let post_axios_resp: AxiosPostsResponse;
        try {
          post_axios_resp = await axios.get(post_url, config);
        }catch (err) {
          console.log(`Posts Axios Error: ${err}`)
        }
        if (
          !post_axios_resp.data || !post_axios_resp?.data?.items
        ) {
          break;
        }
        num_of_img_lens += post_axios_resp?.data?.items?.length;
        has_more_posts = (post_axios_resp?.data?.more_available && num_of_img_lens <= MAX_POSTS_TO_SCRAPE) ?? false;
        next_max_id = post_axios_resp?.data?.next_max_id ?? "";
        post_axios_resp?.data?.items.forEach(post_response => {
          posts_img_url_dict[post_response?.pk] = post_response?.image_versions2?.candidates[0]?.url ?? ""
        });
      }
      //console.log(num_of_img_lens, "NUM IMG LENS")
      completed_posts_scraping = true;
    }
    if (comments_regex.test(res.request().url())) {
      console.log("In comments handler")
      const post_pk = res.request().url().split("/")[6];
      posts_handling_tracker++
      const comments_response: CommentsAPIResponse = await res.json();
      const post_metadata = JSON.stringify({
        caption: comments_response.caption?.text,
        comment_count: comments_response.comment_count,
        media_url: posts_img_url_dict[post_pk]
      })
      //console.log(post_metadata, 'post metadata')
      const db_update_packet = {
        athlete_id,
        batch_id,
        post_batch_position: posts_handling_tracker,
        post_id: post_pk,
        post_metadata,
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
        await knex_client('ig_fb_followers').update({
          scraped_comments: 'true'
        }).where({
          athlete_id, batch_id
        })
        console.log("Done scraping comments")
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
  await page.type('input[aria-label="Search input"]', username_to_scrape);
  await page.waitForTimeout(1000);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("NumpadEnter");
  await page.waitForTimeout(5000);
  while (!completed_posts_scraping) {
    console.log(`Waiting to finish posts scraping`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  await page.waitForSelector('a[href^="/p/"]');
  const first_post_element = await page.$('a[href^="/p/"]');
  await first_post_element.click();
  console.log("Clicked first post element")

  while (!completed_comments_scraping) {
    console.log(`Waiting to finish comments scraping`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return "done"
}

//scrape_comments(500, 120, '42_life_universe_everything')