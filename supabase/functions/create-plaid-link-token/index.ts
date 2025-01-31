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
    const { user_id } = await req.json()

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user_id },
      client_name: 'Family Budget App',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    })

    return new Response(JSON.stringify(response.data), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}) 