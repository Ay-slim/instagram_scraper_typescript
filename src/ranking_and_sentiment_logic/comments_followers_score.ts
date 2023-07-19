import { Request, Response } from "express";
import { knex_client } from "../db/knex_client";
import {
  CommentDBItem,
  FanRankings,
  FollowersReturnTemplate
} from "../utils/type_utils";

export const aggregate_and_rank_comments_and_followers = async(req: Request, res: Response) => {
  /**
   * Some Notes
   * 
   * Comments have a weight of 3 and followership has a weight of 2, interaction score is i_s = (3 * no_of_comments) + (2  * (is_follower ? 1 : 0))
   * A decent amount of shitty coding practices here (using global variables, updating dicts implicitly as a side effect within forEach loops). Doing this because the amount of data being processed here is huge and we're trying to conserve space as much as possible
   */
  const { athlete_id, batch_id } = req.body;
  const { followers: followers_raw }: {followers: string} = await knex_client('ig_fb_followers').select('followers').where({ athlete_id, batch_id }).first()
  const followers: FollowersReturnTemplate[] = JSON.parse(followers_raw)
  const raw_comments: { comments: string }[] = await knex_client('ig_fb_posts').select('comments').where({athlete_id, batch_id})
  // const test_followers = [{
  //     username: 'user2',
  //     profile_pic_url: 'string;',
  //     pk_id: ' string;'
  // }, {
  //   username: 'user4',
  //   profile_pic_url: 'string;',
  //   pk_id: ' string;'
  // }]
  const comments_collection: CommentDBItem[][] = raw_comments.map(
    raw_comment => {
      return JSON.parse(raw_comment.comments)
      }
    )
  // const test_comments_collection = [[{child_comment_count: 2,
  //   comment_like_count: 3,
  //   text: 'text1',
  //   username: 'user1',
  //   profile_pic_url: 'string;,',
  //   user_pk_id: 'string;'}, {child_comment_count: 2,
  //     comment_like_count: 3,
  //     text: 'text2',
  //     username: 'user2',
  //     profile_pic_url: 'string;,',
  //     user_pk_id: 'string;'}], [{child_comment_count: 2,
  //     comment_like_count: 3,
  //     text: 'text3',
  //     username: 'user1',
  //     profile_pic_url: 'string;,',
  //     user_pk_id: 'string;'}]]
  let comments: CommentDBItem[] = []
  //Spread all comments into a single array
  comments_collection.forEach(comment_collection => {
    //console.log(comments, 'collection')
    comments = comments.concat(comment_collection)
  })
  const fan_rankings: FanRankings = {};
  //console.log(comments)
  //Aggregate comments across posts
  comments.forEach(comment => {
    if (fan_rankings[comment.username]) {
      fan_rankings[comment.username].aggregated_comments = fan_rankings[comment.username].aggregated_comments.concat(comment.text)
    } else {
      fan_rankings[comment.username] = {
        aggregated_comments: [comment.text]
      }
    }
  })

  //Assign an interaction score based on comment count and set follower boolean flag
  for (let username in fan_rankings) {
    fan_rankings[username].interaction_score = 3 * fan_rankings[username].aggregated_comments.length
    fan_rankings[username].is_follower = false
  }

  //Update interaction score based on whether each fan is a follower
  followers.forEach(follower => {
    //console.log(fan_rankings)
    if (fan_rankings[follower.username]) {
      fan_rankings[follower.username].is_follower = true
      fan_rankings[follower.username].interaction_score += 2
    } else {
      fan_rankings[follower.username] = {
        is_follower: true,
        interaction_score: 2,
        aggregated_comments: []
      }
    }
  })
  //console.log(fan_rankings)
  await knex_client('ig_fb_followers')
    .update({fan_rankings: JSON.stringify(fan_rankings)})
    .where({athlete_id, batch_id})
  res.status(201).json({
    status: "successful",
  });
}
