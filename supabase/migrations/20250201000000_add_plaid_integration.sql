CREATE TABLE plaid_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    access_token text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, access_token)
);

-- Enable RLS
ALTER TABLE plaid_tokens ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own tokens"
    ON plaid_tokens FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
    ON plaid_tokens FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Add plaid_transaction_id to transactions table
ALTER TABLE transactions
ADD COLUMN plaid_transaction_id text UNIQUE; 