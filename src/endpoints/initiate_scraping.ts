import dotenv from "dotenv";
import { Response } from "express";

import {
  RequestWithProfile,
  NormalizedProfileType
} from "../utils/type_utils";

import {
  login_auth,
} from "../utils/helper_functions" //DO not delete, for use in first line of `start_scraping` function

import { knex_client } from "../db/knex_client";
import { scrape_followers } from "../scraper_logic/followers";
import { scrape_comments } from "../scraper_logic/comments";
import { aggregate_and_rank_comments_and_followers } from "../ranking_and_sentiment_logic/comments_followers_score";
dotenv.config()

export const start_scraping = async(req: RequestWithProfile, res: Response) => {
  try {
    if (req?.body?.is_private) {
      throw new Error("Cannot scrape private profile");
    }
    const { athlete_id } = await login_auth(req?.headers?.authorization, 'athlete_id')
    //const athlete_id = 500 For testing, REMOVE AND REPLACE WITH ABOVE
    const { batch_id: current_batch_id, scraped_comments, scraped_followers } = await knex_client('ig_fb_followers')
      .select('batch_id', 'scraped_comments', 'scraped_followers')
      .where({ athlete_id })
      .orderBy('batch_id', 'desc')
      .limit(1)
      .first() ?? { batch_id: 0, scraped_comments: 'new', scraped_followers: 'new' }
    //console.log(`curr_batch_id: ${current_batch_id}, scraped_foll: ${scraped_followers}, scraped_comm: ${scraped_comments}: DB_DEETS`)
    const has_scraped_followers_or_new = ['new', 'true'].includes(scraped_followers)
    const has_scraped_comments_or_new = ['new', 'true'].includes(scraped_comments);
    //console.log(has_scraped_comments_or_new, 'commentss', has_scraped_followers_or_new, 'followersss')
    const batch_id: number = has_scraped_comments_or_new && has_scraped_followers_or_new ? current_batch_id + 1: current_batch_id;
    //console.log(batch_id, 'BATCHHHHH_IDDDD', current_batch_id)
    const profile_details: NormalizedProfileType = req.body;
    if (!profile_details.username) {
      res.json({ status: "Failed", message: "No username" });
    }
    if (has_scraped_followers_or_new && has_scraped_comments_or_new) {
      await knex_client('ig_fb_followers').insert({
        athlete_id,
        batch_id,
        profile_details: JSON.stringify(profile_details)
      })
    }
    let should_scrape_followers = true;
    if (scraped_followers === 'true' && scraped_comments === 'false') {
      should_scrape_followers = false;
    }
    //const should_scrape_followers = ['new', 'false'].includes(scraped_followers) && has_scraped_comments_or_new;
    //console.log(should_scrape_followers, 'SHOULD SCRAPE FOLLOWERS')
    if (req?.body?.can_crawl_all_followers && should_scrape_followers) {
      console.log("Calling followers scraper")
      await scrape_followers({
        batch_id,
        athlete_id,
        username: profile_details.username,
        followers_count: profile_details.followers,
      })
    }
    console.log("Commence comments scraping")
    await scrape_comments(athlete_id, batch_id, profile_details.username)
    console.log("Commence followers ranking")
    await aggregate_and_rank_comments_and_followers(athlete_id, batch_id, req?.body?.can_crawl_all_followers)
    res.status(201).json({status: "success"})
  } catch (err) {
    throw err;
  }
}