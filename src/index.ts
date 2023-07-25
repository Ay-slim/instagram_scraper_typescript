import express from "express";
import dotenv from 'dotenv';

import { start_scraping } from "./endpoints/initiate_scraping"
import { scrape_profile_details } from "./endpoints/profile_details";

dotenv.config()
const app = express()

app.use(express.json())

app.post("/initiate", start_scraping)
app.post("/profile_details", scrape_profile_details)

app.listen(process.env.PORT || 6500, () =>
  console.log(`App running on port ${process.env.PORT || 6500}`)
);