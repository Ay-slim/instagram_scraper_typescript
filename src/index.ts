import express from "express";
import dotenv from 'dotenv';

import { scrape_followers } from "./scraper_logic/followers"

dotenv.config()
const app = express()

app.use(express.json())

app.post("/scrape_followers", scrape_followers)

app.listen(process.env.PORT || 6500, () =>
  console.log(`App running on port ${process.env.PORT || 6500}`)
);