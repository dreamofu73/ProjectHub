export interface Message {
  id: string;
  room_id: string;
  author_name: string;
  author_login: string;
  content: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  created_at: string;
}

export interface UserInfo {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface UserGroup {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface UserGroupMember {
  id: string;
  user_id: string;
  group_id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}
