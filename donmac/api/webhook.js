// Vercel Serverless Function: POST or GET /api/webhook
// SMS Webhook endpoint — receives forwarded SMS from your SMS-forwarder app
// and auto-credits the matching user's wallet.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Support both POST and GET
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

    // Call the RPC function
    const { data, error } = await supabase.rpc('process_sms_webhook', {
      p_raw_sms: rawSms,
    })

    if (error) {
      console.error('[SMS Webhook] RPC error:', error.message)
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    }

    console.log('[SMS Webhook] result:', data)

    // ============================================================
    // FIX: Handle the response correctly
    // ============================================================
    // If data is an array (from RETURNS TABLE), take the first element
    let responseData = data
    if (Array.isArray(data) && data.length > 0) {
      responseData = data[0]
    }

    // If responseData is already an object with success field, use it
    if (responseData && typeof responseData === 'object') {
      return res.status(200).json({
        success: true,
        ...responseData
      })
    }

    // Fallback
    return res.status(200).json({
      success: true,
      data: responseData,
      message: 'Webhook processed successfully'
    })

  } catch (error) {
    console.error('[SMS Webhook] handler error:', error.message)
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}
