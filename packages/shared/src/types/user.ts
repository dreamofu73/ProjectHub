export interface UserData {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'user' | 'overseer';
  is_active: number;
  organization_id?: string | null;
  department_id?: string | null;
  organization_name?: string | null;
  department_name?: string | null;
  created_at: string;
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
