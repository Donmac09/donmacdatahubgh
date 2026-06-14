// Vercel Serverless Function: /api/webhook
// SMS Webhook endpoint — receives forwarded SMS and auto-credits users
// SMS Forwarder App URL: https://your-domain.vercel.app/api/webhook

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for webhook
)

// Parse SMS text to extract: amount, transaction ID, reference code
function parseSMS(text) {
  const result = { amount: null, txId: null, refCode: null, network: 'MoMo' }

  // Extract amount — patterns like "GHS 50.00" or "GHS50" or "amount of GHS 50"
  const amountMatch = text.match(/GHS\s*([0-9]+(?:\.[0-9]{1,2})?)/i)
    || text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*GHS/i)
    || text.match(/amount[:\s]+([0-9]+(?:\.[0-9]{1,2})?)/i)
  if (amountMatch) result.amount = parseFloat(amountMatch[1])

  // Extract transaction ID — typically alphanumeric 8-15 chars, sometimes starts with letters
  const txMatch = text.match(/\b([A-Z]{1,3}[0-9]{8,12})\b/)
    || text.match(/(?:transaction|txn|ref(?:erence)?)[:\s#]*([A-Z0-9]{6,15})/i)
    || text.match(/\b([0-9]{10,13})\b/)
  if (txMatch) result.txId = txMatch[1]

  // Extract 6-char alphanumeric reference code (user's ref code in message note/description)
  const refMatch = text.match(/\b([A-Z0-9]{6})\b/g)
  if (refMatch) {
    // Find which one matches a known reference code — done in DB query
    result.possibleRefs = refMatch
    result.refCode = refMatch[refMatch.length - 1] // last 6-char code as primary
  }

  // Network detection
  if (/mtn|mobile money|momo/i.test(text)) result.network = 'MTN MoMo'
  else if (/vodafone|telecel/i.test(text)) result.network = 'Telecel'
  else if (/airtel|tigo/i.test(text)) result.network = 'AirtelTigo'

  return result
}

export default async function handler(req, res) {
  // Allow GET for SMS Forwarder apps that use GET requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.method === 'POST' ? req.body : req.query

    // Accept both raw SMS text and structured data
    const rawSms = body.message || body.sms || body.text || body.body || ''
    const fromNumber = body.from || body.sender || body.number || ''

    if (!rawSms) {
      return res.status(400).json({ error: 'No message content found' })
    }

    console.log('SMS Webhook received:', { rawSms, fromNumber })

    const parsed = parseSMS(rawSms)
    let credited = false
    let creditedUser = null

    // Try each possible 6-char ref code
    const codestoTry = parsed.possibleRefs || (parsed.refCode ? [parsed.refCode] : [])

    for (const code of codestoTry) {
      // Look up user by reference code stored in topups table
      const { data: topupRows } = await supabase
        .from('topups')
        .select('*, user:user_id(*)')
        .eq('reference_code', code)
        .eq('status', 'unclaimed')
        .limit(1)

      if (topupRows && topupRows.length > 0) {
        const topup = topupRows[0]
        const userId = topup.user_id

        if (userId && parsed.amount && parsed.amount > 0) {
          // Credit the user
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single()
          const newBalance = (profile?.balance || 0) + parsed.amount

          await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId)

          // Update topup record
          await supabase.from('topups').update({
            status: 'claimed',
            claimed_by: userId,
            amount: parsed.amount,
            transaction_id: parsed.txId,
            network: parsed.network,
            raw_sms: rawSms,
          }).eq('id', topup.id)

          // Record transaction
          await supabase.from('transactions').insert({
            user_id: userId,
            type: 'credit',
            description: `Auto top-up via MoMo (Ref: ${code}, TxID: ${parsed.txId || 'N/A'})`,
            amount: parsed.amount,
            status: 'success',
          })

          // Notification
          await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Wallet Credited! 💰',
            message: `₵${parsed.amount.toFixed(2)} has been added to your wallet automatically.`,
            type: 'topup',
          })

          credited = true
          creditedUser = userId
          console.log(`Auto-credited ₵${parsed.amount} to user ${userId}`)
          break
        }
      }
    }

    // Save to topups even if not matched (admin can see unclaimed)
    if (!credited) {
      await supabase.from('topups').insert({
        reference_code: parsed.refCode || null,
        transaction_id: parsed.txId || null,
        amount: parsed.amount || null,
        network: parsed.network,
        raw_sms: rawSms,
        status: 'unclaimed',
        method: 'MoMo',
      })
    }

    return res.status(200).json({
      success: true,
      credited,
      user_id: creditedUser,
      parsed: { amount: parsed.amount, txId: parsed.txId, refCode: parsed.refCode, network: parsed.network },
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
}
