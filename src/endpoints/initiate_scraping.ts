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
  const { athlete_id } = await login_auth(req?.headers?.authorization, 'athlete_id')
  //const athlete_id = 500 For testing, REMOVE AND REPLACE WITH ABOVE
  const { batch_id: current_batch_id } = await knex_client('ig_fb_followers')
    .select('batch_id')
    .where({ athlete_id })
    .orderBy('batch_id', 'desc')
    .limit(1)
    .first() ?? { batch_id: 0 }
  const batch_id: number = current_batch_id + 1;
  console.log(batch_id, 'BATCHHHHH_IDDDD')
  const profile_details: NormalizedProfileType = req.body;
  if (!profile_details.username) {
    res.json({ status: "Failed", message: "No username" });
  }
  await knex_client('ig_fb_followers').insert({
    athlete_id,
    batch_id,
    profile_details: JSON.stringify(profile_details)
  })
  console.log("Calling followers scraper")
  await scrape_followers({
    batch_id,
    athlete_id,
    username: profile_details.username,
    followers_count: profile_details.followers,
  })
  console.log("Commence comments scraping")
  await scrape_comments(athlete_id, batch_id, profile_details.username)
  console.log("Commence followers ranking")
  await aggregate_and_rank_comments_and_followers(athlete_id, batch_id)
  res.status(201).json({status: "success"})
}