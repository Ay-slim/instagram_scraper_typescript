import express from "express";
import dotenv from 'dotenv';

import { scrape_followers } from "./scraper_logic/followers"
import { scrape_comments } from "./scraper_logic/comments";

dotenv.config()
const app = express()

app.use(express.json())

app.post("/scrape_followers", scrape_followers)
app.post("/scrape_comments", scrape_comments)

app.listen(process.env.PORT || 6500, () =>
  console.log(`App running on port ${process.env.PORT || 6500}`)
);