export interface OrganizationSettings {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  description: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentMember {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  is_active: number;
}

export interface AddressBookGroup {
  id: string;
  user_id: string;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface AddressBookMember {
  id: string;
  group_id: string;
  user_id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  created_at: string;
}
