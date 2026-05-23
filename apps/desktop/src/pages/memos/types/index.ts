export interface User {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  groupName?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  filesize: number;
  content_type: string;
  created_at: string;
}

export interface Memo {
  id: string;
  sender_id: string;
  receiver_id: string;
  title: string;
  content: string;
  created_at: string;
  is_read: number;
  is_archived: number;
  is_spam: number;
  is_sent?: number;
  sender_login?: string;
  sender_firstname?: string;
  sender_lastname?: string;
  receiver_login?: string;
  receiver_firstname?: string;
  receiver_lastname?: string;
  attachments?: Attachment[];
  folder_id?: string;
  reserved_at?: string;
  expires_at?: string;
}

export interface CustomFolder {
  id: string;
  name: string;
}

export type FolderType = 'received' | 'personal' | 'group' | 'self' | 'sent' | 'archived' | 'spam' | 'trash' | string;
