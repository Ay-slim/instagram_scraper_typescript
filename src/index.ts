import express, {Request, Response} from "express";
import dotenv from 'dotenv';

import { start_scraping } from "./endpoints/initiate_scraping"
import { scrape_profile_details } from "./endpoints/profile_details";
import { knex_client } from "./db/knex_client";

dotenv.config()
const app = express()

app.use(express.json())

const home_endpoint = async (req: Request, res: Response) => {
  console.log("In home handler")
  // const email_test = await knex_client('athletes').select('email').where({id: 1});
  // console.log(email_test)
  res.status(200).json({message: "Welcome!"})
}

app.get("/", home_endpoint)
app.post("/initiate", start_scraping)
app.post("/profile_details", scrape_profile_details)

app.listen(process.env.PORT || 6500, () =>
  console.log(`App running on port ${process.env.PORT || 6500}`)
);