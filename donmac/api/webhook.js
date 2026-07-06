// Vercel Serverless Function: POST or GET /api/webhook
// SMS Webhook endpoint — receives forwarded SMS from your SMS-forwarder app
// and auto-credits the matching user's wallet.
//
// SMS Forwarder URL to configure: https://your-domain.vercel.app/api/webhook
//
// IMPORTANT: All parsing + matching + crediting logic lives in ONE place —
// the `process_sms_webhook` Postgres function (see supabase_schema.sql).
// This endpoint is intentionally a thin wrapper that just forwards the raw
// SMS text to that function and relays the result. This avoids having two
// separate (and potentially conflicting) parsing/matching implementations.
//
// Flow inside process_sms_webhook:
//   1. Extracts amount (GHS X.XX), transaction ID, and a 6-char reference code
//      from the raw SMS text using regex.
//   2. Looks for a "reservation" row in `topups` where:
//        reference_code = <extracted code>
//        status = 'unclaimed'
//        amount IS NULL   <- this is the placeholder created by
//                             get_or_create_reference_code() when the user
//                             opened "Top Up" in the app, BEFORE they paid.
//   3. If found: credits that exact user's wallet, fills in the real amount/
//      txId/raw_sms on that same row, and flips status -> 'claimed'.
//   4. If NOT found (no matching reservation, e.g. user paid without ever
//      generating a code, or typed an unrelated 6-char string): the SMS is
//      saved as a fresh `topups` row with status = 'unclaimed' and
//      reference_code/transaction_id/amount populated. It then shows up in
//      Admin → Top Ups so the customer can manually claim it with their
//      Transaction ID (Dashboard → "Claim with Transaction ID"), or the
//      admin can delete the stray record if it's not a real payment.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role required to call the RPC with elevated rights
)

export default async function handler(req, res) {
  // Some SMS-forwarder apps only support GET webhooks — support both.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.method === 'POST' ? (req.body || {}) : (req.query || {})

    // Accept whichever field name the forwarder app uses for the SMS body
    const rawSms = body.message || body.sms || body.text || body.body || ''
    const fromNumber = body.from || body.sender || body.number || null

    if (!rawSms || typeof rawSms !== 'string' || rawSms.trim().length === 0) {
      return res.status(400).json({ error: 'No SMS message content found in request' })
    }

    console.log('[SMS Webhook] received from', fromNumber || 'unknown', '— raw:', rawSms.slice(0, 200))

    // Hand off ALL parsing + matching + crediting to the single source of truth
    const { data, error } = await supabase.rpc('process_sms_webhook', {
      p_raw_sms: rawSms,
    })

    if (error) {
      console.error('[SMS Webhook] process_sms_webhook RPC error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    console.log('[SMS Webhook] result:', data)

    return res.status(200).json({
      success: true,
      ...data, // { success, user_id, amount, ref } on match, or { success:false, message } when saved as unclaimed
    })

  } catch (error) {
    console.error('[SMS Webhook] handler error:', error.message)
    return res.status(500).json({ error: error.message })
  }
}
