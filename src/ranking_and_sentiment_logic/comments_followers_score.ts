import * as language from '@google-cloud/language';
import { knex_client } from "../db/knex_client";
import {
  CommentDBItem,
  FanRankings,
  FollowersReturnTemplate,
  ParsedCommentsType
} from "../utils/type_utils";
import { average_num_array } from '../utils/helper_functions';

const calculate_sentiment_scores = async (comment_text) => {
  const client = new language.LanguageServiceClient();
  const plain_text_string: "PLAIN_TEXT" = "PLAIN_TEXT"
  try {
    const document = {
      content: comment_text,
      type: plain_text_string,
    };
    const [result] = await client.analyzeSentiment({document});
    const { score } = result.documentSentiment;
    return score;
  } catch (err) {
    console.log(`Error occurred analyzing comment: ${comment_text}`)
    console.log(err)
    return 0;
  }
}

const posts_sentiments_analysis = (parsed_comments: ParsedCommentsType[]) => {
  return parsed_comments.map(parsed_comment => {
    const sentiment_scores = parsed_comment.comments.map(comment => {
      return comment.sentiment_rating
    })
    return {
      post_id: parsed_comment.post_id,
      caption: parsed_comment.caption,
      media_url: parsed_comment.media_url,
      average_sentiment: Number(average_num_array(sentiment_scores).toFixed(1))
    }
  })
}

const fan_ranking_calculations = (parsed_comments: ParsedCommentsType[], has_followers: boolean, followers: FollowersReturnTemplate[]) => {
  let comments_aggregation: {
    comment_text: string;
    sentiment_rating: number;
    username: string;
    profile_pic_url: string;
    pk: string;
  }[] = []
  //console.log(parsed_comments, 'BULK INPUT')

  parsed_comments.forEach(parsed_comment => {
    parsed_comment.comments.forEach(parsed_sub_comment => {
      comments_aggregation = comments_aggregation.concat({
        comment_text: parsed_sub_comment.text,
        sentiment_rating: parsed_sub_comment.sentiment_rating,
        username: parsed_sub_comment.username,
        profile_pic_url: parsed_sub_comment.profile_pic_url,
        pk: parsed_sub_comment.pk,
      })
    })
  })

  //console.log(comments_aggregation, 'FLATTENED ARRAY')

  const fans_ranking: FanRankings = {};

  comments_aggregation.forEach(comment => {
    if (fans_ranking[comment.username]) {
      fans_ranking[comment.username].aggregated_comments = fans_ranking[comment.username].aggregated_comments.concat(comment.comment_text)
      fans_ranking[comment.username].sentiment_ratings = fans_ranking[comment.username].sentiment_ratings.concat(comment.sentiment_rating)
    } else {
      fans_ranking[comment.username] = {
        aggregated_comments: [comment.comment_text],
        sentiment_ratings: [comment.sentiment_rating]
      }
    }
  })

  for (let username in fans_ranking) {
    if (fans_ranking[username].aggregated_comments.length > 0) {
      fans_ranking[username].interaction_score = fans_ranking[username].aggregated_comments.length
      fans_ranking[username].is_follower = false
    }
  }

  if (has_followers) {
    followers.forEach(follower => {
      if (fans_ranking[follower.username] && fans_ranking[follower.username]?.interaction_score) {
        fans_ranking[follower.username].is_follower = true
        fans_ranking[follower.username].interaction_score = Number((fans_ranking[follower.username].interaction_score * 1.2).toFixed(1))
      }
    })
  }

  const fan_rankings_array: {
    username: string;
    interaction_score?: number;
    is_follower?: boolean;
    sentiment_ratings?: number[];
    aggregated_comments: string[];
    average_sentiment?: number;
}[] = [];
  for (let username in fans_ranking) {
    if (fans_ranking[username]?.interaction_score) {
      fan_rankings_array.push({
        ...fans_ranking[username], ...{username},
        average_sentiment: Number(average_num_array(fans_ranking[username].sentiment_ratings).toFixed(1))
      })
    }
  }
  fan_rankings_array.sort((a, b)=> {
    return b.interaction_score - a.interaction_score;
  })
  return fan_rankings_array
}

export const aggregate_and_rank_comments_and_followers = async(athlete_id: number, batch_id: number, has_followers: boolean) => {
  /**
   * Some Notes
   * 
   * Followership has a weight of 1.2, interaction score is i_s = no_of comments * (is_follower ? 1.2 : 1)
   * A decent amount of shitty coding practices here (using global variables, updating dicts implicitly as a side effect within forEach loops). Doing this because the amount of data being processed here is huge and we're trying to conserve space as much as possible
   */
  const { followers: followers_raw }: {followers: string} = await knex_client('ig_fb_followers').select('followers').where({ athlete_id, batch_id }).first()
  const followers: FollowersReturnTemplate[] = JSON.parse(followers_raw)
  const raw_comments: { comments: string; post_id: string; post_metadata: string; }[] = await knex_client('ig_fb_posts').select('comments', 'post_id', 'post_metadata').where({athlete_id, batch_id})
  // const test_followers = [{
  //     username: 'user2',
  //     profile_pic_url: 'string;',
  //     pk_id: ' string;'
  // }, {
  //   username: 'user4',
  //   profile_pic_url: 'string;',
  //   pk_id: ' string;'
  // }]
  // console.log(raw_comments)
  // return

  /**
   * Parse all commments from the DB and calculate their individual sentiment analysis scores
   */
  let parsed_comments: ParsedCommentsType[] = []
  for (let post of raw_comments) {
    const parsed_metadata: { caption: string; comment_count: number, media_url: string } = JSON.parse(post.post_metadata)
    //console.log(parsed_metadata, Object.keys(parsed_metadata), parsed_metadata['caption'], parsed_metadata['media_url'], 'PARSEDDDD')
    const parsed_post_comments: CommentDBItem[] = JSON.parse(post.comments)
    if (parsed_post_comments.length === 0) {
      continue
    }
    const concat_packet: ParsedCommentsType = {
      comments: await Promise.all(parsed_post_comments.map(async (parsed_post_comment) => {
        return {
          text: parsed_post_comment.text,
          //sentiment_rating: 2,
          sentiment_rating: await calculate_sentiment_scores(parsed_post_comment.text),
          username: parsed_post_comment.username,
          profile_pic_url: parsed_post_comment.profile_pic_url,
          pk: parsed_post_comment.user_pk_id,
        }
      })),
      post_id: post.post_id,
      caption: parsed_metadata.caption,
      media_url: parsed_metadata.media_url
    }
    //console.log(concat_packet, 'COMMMENTSSSSS')
    parsed_comments = parsed_comments.concat(concat_packet)
  }
  //console.log(parsed_comments)
  const aggregated_posts = posts_sentiments_analysis(parsed_comments)
  //console.log(aggregated_posts, 'AGGREGATED')

  const ranked_followers = fan_ranking_calculations(parsed_comments, has_followers, followers)
  //console.log(ranked_followers, 'RANKKEDDD')
  await knex_client('ig_fb_followers')
    .update({
      fan_rankings: JSON.stringify(ranked_followers),
      posts_sentiments: JSON.stringify(aggregated_posts)
    })
    .where({athlete_id, batch_id})
}
 // return
//   const comments_collection: CommentDBItem[][] = raw_comments.map(
//     raw_comment => {
//       return JSON.parse(raw_comment.comments)
//       }
//     )
//   // const test_comments_collection = [[{child_comment_count: 2,
//   //   comment_like_count: 3,
//   //   text: 'text1',
//   //   username: 'user1',
//   //   profile_pic_url: 'string;,',
//   //   user_pk_id: 'string;'}, {child_comment_count: 2,
//   //     comment_like_count: 3,
//   //     text: 'text2',
//   //     username: 'user2',
//   //     profile_pic_url: 'string;,',
//   //     user_pk_id: 'string;'}], [{child_comment_count: 2,
//   //     comment_like_count: 3,
//   //     text: 'text3',
//   //     username: 'user1',
//   //     profile_pic_url: 'string;,',
//   //     user_pk_id: 'string;'}]]
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
//   if (has_followers) {
//     followers.forEach(follower => {
//       //console.log(fan_rankings)
//       if (fan_rankings[follower.username] && fan_rankings[follower.username]?.interaction_score) {
//         fan_rankings[follower.username].is_follower = true
//         fan_rankings[follower.username].interaction_score = Number((fan_rankings[follower.username].interaction_score * 1.2).toFixed(1))
//       }
//     })
//   }
//   //console.log(fan_rankings)
//   const client = new language.LanguageServiceClient();
//   const plain_text_string: "PLAIN_TEXT" = "PLAIN_TEXT"
//   for (let username in fan_rankings) {
//     if (fan_rankings[username].aggregated_comments.length === 0) {
//       continue;
//     }
//     const sentiment_ratings = await Promise.all(fan_rankings[username].aggregated_comments.map(async comment => {
//       try {
//         const document = {
//           content: comment,
//           type: plain_text_string,
//         };
//         const [result] = await client.analyzeSentiment({document});
//         const { score } = result.documentSentiment;
//         return score;
//       } catch (err) {
//         console.log(`Error occurred analyzing comment: ${comment}`)
//         console.log(err)
//         return 0;
//       }
//     }))
//     fan_rankings[username]['sentiment_ratings'] = sentiment_ratings;
//     fan_rankings[username]['average_sentiment'] = Number(average_num_array(sentiment_ratings).toFixed(1))
//   }
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
//   await knex_client('ig_fb_followers')
//     .update({fan_rankings: JSON.stringify(fan_rankings_array)})
//     .where({athlete_id, batch_id})
  
//   return "done"
// }

//aggregate_and_rank_comments_and_followers(44, 1, true);