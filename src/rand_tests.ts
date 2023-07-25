import * as language from '@google-cloud/language';

const test_sentiments = async() => {
  const client = new language.LanguageServiceClient();
  const text = 'Love this product!';

  const plain_text_string: "PLAIN_TEXT" = "PLAIN_TEXT"
  const document = {
    content: text,
    type: plain_text_string,
  };

  const [result] = await client.analyzeSentiment({document});

  const sentiment = result.documentSentiment;
  console.log('Document sentiment:');
  console.log(`  Score: ${sentiment.score}`);
  console.log(`  Magnitude: ${sentiment.magnitude}`);
}

//test_sentiments()


// import * as language from '@google-cloud/language';
// //import { knex_client } from "../db/knex_client";
// import {
//   CommentDBItem,
//   FanRankings,
//   FanRankingsArr,
//   FollowersReturnTemplate
// } from "./utils/type_utils";
// import { average_num_array } from './utils/helper_functions';

// export const aggregate_and_rank_comments_and_followers = async() => {
//   /**
//    * Some Notes
//    * 
//    * Comments have a weight of 3 and followership has a weight of 2, interaction score is i_s = (3 * no_of_comments) + (2  * (is_follower ? 1 : 0))
//    * A decent amount of shitty coding practices here (using global variables, updating dicts implicitly as a side effect within forEach loops). Doing this because the amount of data being processed here is huge and we're trying to conserve space as much as possible
//    */
//   //const { followers: followers_raw }: {followers: string} = await knex_client('ig_fb_followers').select('followers').where({ athlete_id, batch_id }).first()
//   //const followers: FollowersReturnTemplate[] = JSON.parse(followers_raw)
//   //const raw_comments: { comments: string }[] = await knex_client('ig_fb_posts').select('comments').where({athlete_id, batch_id})
//   const test_followers = [{
//       username: 'user2',
//       profile_pic_url: 'string;',
//       pk_id: ' string;'
//   }, {
//     username: 'user4',
//     profile_pic_url: 'string;',
//     pk_id: ' string;'
//   }]
//   const followers: FollowersReturnTemplate[] = test_followers;
//   // const comments_collection: CommentDBItem[][] = raw_comments.map(
//   //   raw_comment => {
//   //     return JSON.parse(raw_comment.comments)
//   //     }
//   //   )
//   const test_comments_collection = [[{child_comment_count: 2,
//     comment_like_count: 3,
//     text: 'text1',
//     username: 'user1',
//     profile_pic_url: 'string;,',
//     user_pk_id: 'string;'}, {child_comment_count: 2,
//       comment_like_count: 3,
//       text: 'text2',
//       username: 'user2',
//       profile_pic_url: 'string;,',
//       user_pk_id: 'string;'}], [{child_comment_count: 2,
//       comment_like_count: 3,
//       text: 'text3',
//       username: 'user1',
//       profile_pic_url: 'string;,',
//       user_pk_id: 'string;'}], [{child_comment_count: 2,
//       comment_like_count: 3,
//       text: 'text3',
//       username: 'user4',
//       profile_pic_url: 'string;,',
//       user_pk_id: 'string;'}], [{child_comment_count: 2,
//         comment_like_count: 3,
//         text: 'text3',
//         username: 'user4',
//         profile_pic_url: 'string;,',
//         user_pk_id: 'string;'}], [{child_comment_count: 2,
//           comment_like_count: 3,
//           text: 'text3',
//           username: 'user4',
//           profile_pic_url: 'string;,',
//           user_pk_id: 'string;'}]]
//   const comments_collection: CommentDBItem[][] =test_comments_collection;
//   let comments: CommentDBItem[] = []
//   //Spread all comments into a single array
//   comments_collection.forEach(comment_collection => {
//     //console.log(comments, 'collection')
//     comments = comments.concat(comment_collection)
//   })
//   const fan_rankings: FanRankings = {};
//   //console.log(comments)
//   //Aggregate comments across posts
//   comments.forEach(comment => {
//     if (fan_rankings[comment.username]) {
//       fan_rankings[comment.username].aggregated_comments = fan_rankings[comment.username].aggregated_comments.concat(comment.text)
//     } else {
//       fan_rankings[comment.username] = {
//         aggregated_comments: [comment.text]
//       }
//     }
//   })

//   //Assign an interaction score based on comment count and set follower boolean flag
//   for (let username in fan_rankings) {
//     if (fan_rankings[username].aggregated_comments.length > 0) {
//       fan_rankings[username].interaction_score = fan_rankings[username].aggregated_comments.length
//       fan_rankings[username].is_follower = false
//     }
//   }

//   //Update interaction score based on whether each fan is a follower
//   followers.forEach(follower => {
//     //console.log(fan_rankings)
//     if (fan_rankings[follower.username] && fan_rankings[follower.username]?.interaction_score) {
//       fan_rankings[follower.username].is_follower = true
//       fan_rankings[follower.username].interaction_score = Number((fan_rankings[follower.username].interaction_score * 1.2).toFixed(1))
//     }
//   })
//   //console.log(fan_rankings)
//   // const client = new language.LanguageServiceClient();
//   // const plain_text_string: "PLAIN_TEXT" = "PLAIN_TEXT"
//   // for (let username in fan_rankings) {
//   //   if (fan_rankings[username].aggregated_comments.length === 0) {
//   //     continue;
//   //   }
//   //   const sentiment_ratings = await Promise.all(fan_rankings[username].aggregated_comments.map(async comment => {
//   //     const document = {
//   //       content: comment,
//   //       type: plain_text_string,
//   //     };
//   //     const [result] = await client.analyzeSentiment({document});
//   //     const { score } = result.documentSentiment;
//   //     return score;
//   //   }))
//   //   fan_rankings[username]['sentiment_ratings'] = sentiment_ratings;
//   //   fan_rankings[username]['average_sentiment'] = Number(average_num_array(sentiment_ratings).toFixed(1))
//   // }
//   const fan_rankings_array = [];
//   for (let username in fan_rankings) {
//     if (fan_rankings[username]?.interaction_score) {
//       fan_rankings_array.push({
//         ...fan_rankings[username], ...{username}
//       })
//     }
//   }
//   fan_rankings_array.sort((a, b)=> {
//     return b.interaction_score - a.interaction_score;
//   })
//   console.log(fan_rankings_array)
//   // await knex_client('ig_fb_followers')
//   //   .update({fan_rankings: JSON.stringify(fan_rankings)})
//   //   .where({athlete_id, batch_id})
  
//   return "done"
// }


//aggregate_and_rank_comments_and_followers()