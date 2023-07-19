import express from "express";
import dotenv from 'dotenv';

import { scrape_followers } from "./scraper_logic/followers"
import { scrape_comments } from "./scraper_logic/comments";
import { aggregate_and_rank_comments_and_followers } from "./ranking_and_sentiment_logic/comments_followers_score"

dotenv.config()
const app = express()

app.use(express.json())

app.post("/scrape_followers", scrape_followers)
app.post("/scrape_comments", scrape_comments)
app.post("/rank_fan_comments", aggregate_and_rank_comments_and_followers)

app.listen(process.env.PORT || 6500, () =>
  console.log(`App running on port ${process.env.PORT || 6500}`)
);