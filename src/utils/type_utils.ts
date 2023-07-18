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

export type ProfilePicContainer = {
  data: {
    user: {
      reel: {
        owner: {
          profile_pic_url: string;
        }
      }
    }
  }
}