export interface Category {
  id: string;
  name: string;
  budget_limit: number;
  color: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  category_id: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}