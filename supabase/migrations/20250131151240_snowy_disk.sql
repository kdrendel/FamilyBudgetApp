/*
  # Budget Management Schema

  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `budget_limit` (decimal)
      - `color` (text)
      - `created_at` (timestamp)
    
    - `transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `category_id` (uuid, references categories)
      - `amount` (decimal)
      - `description` (text)
      - `date` (date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Categories table
CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    name text NOT NULL,
    budget_limit decimal NOT NULL DEFAULT 0,
    color text NOT NULL DEFAULT '#6366f1',
    created_at timestamptz DEFAULT now(),
    CONSTRAINT positive_budget_limit CHECK (budget_limit >= 0)
);

-- Transactions table
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    category_id uuid REFERENCES categories ON DELETE CASCADE,
    amount decimal NOT NULL,
    description text NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Users can view their categories"
    ON categories FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their categories"
    ON categories FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their categories"
    ON categories FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their categories"
    ON categories FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Policies for transactions
CREATE POLICY "Users can view their transactions"
    ON transactions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their transactions"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their transactions"
    ON transactions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their transactions"
    ON transactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);