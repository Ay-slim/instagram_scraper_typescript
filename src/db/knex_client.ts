import { knex } from 'knex'
import dotenv from 'dotenv'

import knex_config from './knexfile'

dotenv.config()
const env = process.env.NODE_ENV
export const knex_client = knex(knex_config[env])

// const test_db_func = async () => {
//   // const users = await knex_client('users').select('*').where({id: 3})
//   // console.log(users)
//   const { batch_id: current_batch_id, followers: flw, profile_details: stats } = await knex_client('ig_fb_followers')
//     .select('batch_id', 'followers', 'profile_details')
//     .where({ athlete_id: 400 })
//     .orderBy('batch_id', 'desc')
//     .limit(1)
//     .first() ?? { batch_id: 0, followers: 'not null' }
//   console.log(current_batch_id, flw, JSON.parse(stats))
//   //console.log(totol ?? 1)
// }

// test_db_func()