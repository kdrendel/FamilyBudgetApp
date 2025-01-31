import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[Deno.env.get('PLAID_ENV') || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': Deno.env.get('PLAID_CLIENT_ID'),
        'PLAID-SECRET': Deno.env.get('PLAID_SECRET'),
      },
    },
  })
)

serve(async (req) => {
  try {
    const { public_token, user_id } = await req.json()

    // Exchange public token for access token
    const tokenResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    })

    const accessToken = tokenResponse.data.access_token

    // Store the access token in your database
    const { data: client } = await supabase.from('plaid_tokens').insert({
      user_id,
      access_token: accessToken,
    })

    // Fetch initial transactions
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    })

    // Store transactions in your database
    const transactions = transactionsResponse.data.transactions.map(t => ({
      user_id,
      amount: t.amount,
      date: t.date,
      description: t.name,
      category_id: await matchPlaidCategory(t.category), // You'll need to implement this
      plaid_transaction_id: t.transaction_id,
    }))

    await supabase.from('transactions').insert(transactions)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}) 