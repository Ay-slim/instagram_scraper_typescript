import axios from 'axios'
import fs from 'fs';
import jwt from 'jsonwebtoken';

import { FollowersReturnTemplate, AxiosFollowerRes, ProfileType, NormalizedProfileType, ServerReturnType } from "./type_utils";
import { JwtPayloadWithId } from './type_utils';

export const generate_url = (
  url_object: URL,
  url_params: URLSearchParams
): string => {
  return url_object.origin + url_object.pathname + "?" + url_params.toString();
};

export const make_followers_request = async (
  url: string,
  first_next_max_id: string,
  followers_list: FollowersReturnTemplate[],
  foll_req_headers: any,
  followers_num: number,
) => {
  let next_max_id = first_next_max_id;
  while (followers_list.length < followers_num) {
    console.log(`Length: ${followers_list.length}, Num: ${followers_num}`);
    const url_to_update = new URL(url);
    const url_to_update_params = url_to_update.searchParams;
    url_to_update_params.set("max_id", next_max_id);
    url_to_update_params.set("count", "100");
    const new_url = generate_url(url_to_update, url_to_update_params);
    const config = {
      headers: foll_req_headers,
    };
    let resp: AxiosFollowerRes;
    try {
      resp = await axios.get(new_url, config);
    } catch (e) {
      console.log(e, "AXIOS ERROR");
    }
    //console.log(resp?.data?.users?.length, "GOT AXIOSSSS RESPONSEEEEEEEE");
    followers_list = followers_list.concat(
      resp.data.users.map((followers_obj) => {
        return {
          username: followers_obj.username,
          profile_pic_url: followers_obj.profile_pic_url,
          pk_id: followers_obj.pk_id
        };
      })
    );
    //console.log("Updated FollowersList");
    next_max_id = resp.data.next_max_id;
    if (followers_list.length < followers_num) {
      console.log("IN INFINITE WAITTTT");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    console.log("AFTER THE SETTIMEOUT");
  }
  return followers_list;
};

export const write_array_to_file = (
  arr_to_write: Array<object>,
  filename: string
) => {
  const file = fs.createWriteStream(`${filename}.txt`);
  file.on("error", (err) => {
    console.log("WRITE ERROR");
  });
  arr_to_write.forEach((v) => {
    file.write(JSON.stringify(v) + ", " + "\n");
  });
  file.end();
};

export const write_obj_to_file = (
  obj: { [key: string]: any },
  filename: string
) => {
  const file = fs.createWriteStream(`${filename}.txt`);
  file.on("error", (err) => {
    console.log("WRITE ERROR");
  });
  file.write(JSON.stringify(obj) + ", " + "\n");
  file.end();
};

export const text_count_to_num = (str: string) => {
  //Todo: Rewrite this to account for people with followers or posts above a million
  return Number(str.replace(",", ""));
};

export const normalize_profile_basics = (raw_basics: ProfileType): NormalizedProfileType => {
  return {
    bio: raw_basics.biography,
    full_name: raw_basics.full_name,
    username: raw_basics.username,
    no_of_posts: raw_basics.edge_owner_to_timeline_media.count,
    following: raw_basics.edge_follow.count,
    followers: raw_basics.edge_followed_by.count,
    profile_pic_url: raw_basics.profile_pic_url,
    is_private: raw_basics.is_private
  }
}

const laconic_unauthorized_error = {
  status: 401,
  message: 'Unauthorized',
}

export const login_auth = async (
  bearer_token: string,
  sign_key: string
): Promise<JwtPayloadWithId> => {
  try {
      const token = bearer_token.replace('Bearer ', '')
      if (!token) {
          throw new Error('No login token passed')
      }
      const jwt_secret = process.env.JWT_SECRET_KEY
      if (!jwt_secret) {
          throw new Error('No jwt_secret set')
      }
      const jwt_payload: JwtPayloadWithId | string = jwt.verify(
          token,
          jwt_secret
      )
      if (!jwt_payload || !(jwt_payload as JwtPayloadWithId)?.[sign_key]) {
          throw new Error('Unable to extract value from token')
      }
      return jwt_payload as JwtPayloadWithId
  } catch (err) {
      const Error = err as ServerReturnType
      console.error(`Jwt decryption failure: ${Error?.message ?? ''}`)
      throw laconic_unauthorized_error
  }
}

export const average_num_array = (arr: number[]) => {
  return arr.reduce((accumulator, current_num) => accumulator + current_num, 0) / arr.length
}