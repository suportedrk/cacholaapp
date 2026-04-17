export type SellerStatus = 'active' | 'inactive';

export interface Seller {
  id: string;
  owner_id: number;
  name: string;
  email: string | null;
  status: SellerStatus;
  hire_date: string | null;          // ISO date (YYYY-MM-DD)
  termination_date: string | null;   // ISO date
  primary_unit_id: string | null;
  notes: string | null;
  photo_url: string | null;
  is_system_account: boolean;
  created_at: string;
  updated_at: string;
}

export interface SellerFormInput {
  name: string;
  email?: string | null;
  status: SellerStatus;
  hire_date?: string | null;
  termination_date?: string | null;
  primary_unit_id?: string | null;
  notes?: string | null;
  is_system_account?: boolean;
}
