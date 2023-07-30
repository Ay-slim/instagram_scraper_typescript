import { Request } from 'express'
import { JwtPayload } from 'jsonwebtoken'

/**
 * Profile Types
 */
export type RequestUsername = Request & {
  body: {
    username: string;
  }
}

type PpDataCount = {
  count: number;
}

export type ProfileType = {
  biography: string;
  full_name: string;
  username: string;
  edge_owner_to_timeline_media: PpDataCount;
  edge_follow: PpDataCount;
  edge_followed_by: PpDataCount;
  profile_pic_url: string;
  is_private: boolean;
}

export type NormalizedProfileType = {
  bio: string;
  full_name: string;
  username: string;
  no_of_posts: number;
  following: number;
  followers: number;
  profile_pic_url: string;
  is_private: boolean;
  can_crawl_all_followers?: boolean;
}

export type RequestWithProfile = Request & {
  body: NormalizedProfileType
}

export type ProfileBasics = {
  data: {
    user: ProfileType
  }
}

export type JwtPayloadWithId = JwtPayload & {
  user_id?: number
  athlete_id?: number
  name?: string
  email?: string
}

export type ServerReturnType = {
  status: number
  error: boolean
  message: string
}

export type CanCrawlFollowers = {
  big_list: boolean;
}

/**
 * Follower Types
 */
export type FollowersArg = {
  batch_id: number;
  athlete_id: number;
  followers_count: number;
  username: string
}

export type FollowersReturnTemplate = {
  username: string;
  profile_pic_url: string;
  pk_id: string;
};
export type FollowrObj = {
  has_anonymous_profile_picture: boolean;
  pk: string;
  pk_id: string;
  strong_id__: string;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_id: string;
  profile_pic_url: string;
  account_badges: any[];
  is_possible_scammer: boolean;
  latest_reel_media: number;
};

export type FollowerRes = {
  users: FollowrObj[];
  big_list: boolean;
  page_size: number;
  next_max_id: string;
  has_more: boolean;
  should_limit_list_of_followers: boolean;
  status: string;
};

export type AxiosFollowerRes = {
  data: FollowerRes;
  [key: string]: any;
};

/**
 * Comment Types
 */
export type CommentUser = {
  username: string;
  profile_pic_url: string;
  pk_id: string;
}

export type Comment = {
  child_comment_count: number;
  comment_like_count: number;
  text: string;
  user: CommentUser;
  pk: string;
}

export type Caption = {
  created_at: number;
  text: string;
}

export type PostComments = {
  pk: string;
  caption: Caption;
  comment_count: number;
  comments: Comment[];
}

export type CommentsAPIResponse = {
  caption: Caption & {
    [key: string]: any;
  };
  comment_count: number;
  has_more_headload_comments: boolean;
  next_min_id: string;
  comments: Comment &
    {
      [key: string]: any;
    }[];
  [key: string]: any;
}

export type AxiosCommentsResponse = {
  [key: string]: any;
  data: CommentsAPIResponse;
};

export type CommentDBItem = {
  child_comment_count: number;
  comment_like_count: number;
  text: string;
  username: string;
  profile_pic_url: string;
  user_pk_id: string;
}

/**
 * Ranking Types
 */
export type FanRankings = {
  [key: string]: {
    interaction_score?: number;
    is_follower?: boolean;
    sentiment_ratings?: number[];
    aggregated_comments: string[];
    average_sentiment?: number;
  }
}

export type FanRankingsArr = { username: string } & FanRankings

type ApiPostItem = {
  pk: string;
  taken_at: number;
  image_versions2: {
    [key: string]: any,
    candidates: {
      width: number;
      height: number;
      url: string;
    }[]
  };
  comment_count: number;
  like_count: number;
  play_count: number;
  video_codec: string;
  caption: {
    text: string;
    [key: string]: any;
  };
  [key:string]: any;
}

export type PostsAPIResponse = {
  [key: string]: any;
  next_max_id: string;
  more_available: boolean;
  items: ApiPostItem[];
  user: {
    pk: string;
    [key: string]: any;
  }
}

export type AxiosPostsResponse = {
  [key: string]: any;
  data: PostsAPIResponse;
};

export type ParsedCommentsType = {
  comments: {
    text: string;
    sentiment_rating: number;
    username: string;
    profile_pic_url: string;
    pk: string;
  }[],
  post_id: string;
  caption: string;
  media_url: string;
}