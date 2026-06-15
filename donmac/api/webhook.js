// Vercel Serverless Function: /api/webhook
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Protected layout words to ignore during 6-character token evaluation
const BLOCKED_TOKENS = new Set([
  'AMOUNT', 'STATUS', 'MOBILE', 'BALANC', 'VOLUME', 'MASHUP', 
  'PREMIU', 'BUNDLE', 'VODAFO', 'TELECE', 'AIRTEL', 'MOMOPY'
])

function parseSMS(text) {
  const result = { amount: null, txId: null, refCode: null, network: 'MoMo', possibleRefs: [] }
  if (!text) return result

  // 1. Precise Financial Processing (Handles GHS 50.00, GHS50, 50.00 GHS)
  const amountMatch = text.match(/GHS\s*([0-9]+(?:\.[0-9]{1,2})?)/i) || 
                      text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*GHS/i)
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1])
  }

  // 2. Transaction ID Fingerprinting (MTN / Telecel / AT alphanumeric strings)
  // Catches standard alphanumeric strings between 9-12 digits or long numerical sequences
  const txMatch = text.match(/\b([A-Z0-9]{9,14})\b/i) || 
                  text.match(/(?:txn|transaction|id)[:\s#]*([0-9A-Z]+)/i)
  if (txMatch) {
    result.txId = txMatch[1].toUpperCase()
  }

  // 3. User Reference Token Validation
  const allSixCharMatches = text.match(/\b([A-Z0-9]{6})\b/gi)
  if (allSixCharMatches) {
    const cleanTokens = allSixCharMatches
      .map(t => t.toUpperCase())
      .filter(t => {
        // Drop purely numerical times (like 114522 from timestamps) or system keywords
        if (/^\d+$/.test(t)) return false
        if (BLOCKED_TOKENS.has(t)) return false
        return true
      })

    result.possibleRefs = [...new Set(cleanTokens)] // Deduplicate matching targets
    if (result.possibleRefs.length > 0) {
      result.refCode = result.possibleRefs[0] // Set initial match target
    }
  }

  // 4. Network Structural Routing
  const lowerText = text.toLowerCase()
  if (lowerText.includes('mtn') || lowerText.includes('mobile money') || lowerText.includes('momo')) {
    result.network = 'MTN MoMo'
  } else if (lowerText.includes('vodafone') || lowerText.includes('telecel') || lowerText.includes('cash')) {
    result.network = 'Telecel'
  } else if (lowerText.includes('airtel') || lowerText.includes('tigo') || lowerText.includes('at money')) {
    result.network = 'AirtelTigo'
  }

  return result
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method access denied' })
  }

  try {
    const body = req.method === 'POST' ? req.body : req.query
    const rawSms = body.message || body.sms || body.text || body.body || ''
    const fromSender = body.from || body.sender || body.number || ''

    if (!rawSms.trim()) {
      return res.status(400).json({ error: 'Payload body cannot be blank' })
    }

    const parsed = parseSMS(rawSms)
    console.log('Processed Vector:', { txId: parsed.txId, amount: parsed.amount, targets: parsed.possibleRefs })

    // Deduplicate: If transaction ID exists, make sure it hasn't already been processed or logged
    if (parsed.txId) {
      const { data: existingTx } = await supabase
        .from('topups')
        .select('id, status, user_id')
        .eq('transaction_id', parsed.txId)
        .maybeSingle()

      if (existingTx) {
        if (existingTx.status === 'claimed') {
          return res.status(200).json({ success: true, message: 'Transaction identity previously settled' })
        }
        // If it is logged but unclaimed, skip logging duplicate rows and terminate early
        if (existingTx.status === 'unclaimed' && parsed.possibleRefs.length === 0) {
          return res.status(200).json({ success: true, message: 'Unclaimed record logged' })
        }
      }
    }

    let credited = false
    let creditedUserId = null

    // Loop through candidates to confirm an active matching ledger
    for (const token of parsed.possibleRefs) {
      const { data: topupRows } = await supabase
        .from('topups')
        .select('*')
        .eq('reference_code', token)
        .eq('status', 'unclaimed')
        .limit(1)

      if (topupRows && topupRows.length > 0) {
        const matchingTopup = topupRows[0]
        const targetUser = matchingTopup.user_id

        if (targetUser && parsed.amount && parsed.amount > 0) {
          
          // --- BEGIN TRANSACTION LAYER ---
          // Fetch user profile securely using master key bypass
          const { data: profile } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', targetUser)
            .single()

          const originalBalance = Number(profile?.balance || 0)
          const finalizedBalance = originalBalance + parsed.amount

          // 1. Commit new account summary calculations
          await supabase
            .from('profiles')
            .update({ balance: finalizedBalance })
            .eq('id', targetUser)

          // 2. Shift state flags on internal request row to avoid execution looping
          await supabase
            .from('topups')
            .update({
              status: 'claimed',
              claimed_by: targetUser,
              amount: parsed.amount,
              transaction_id: parsed.txId || matchingTopup.transaction_id,
              network: parsed.network,
              raw_sms: rawSms
            })
            .eq('id', matchingTopup.id)

          // 3. Document explicit audit logs
          await supabase.from('transactions').insert({
            user_id: targetUser,
            type: 'credit',
            description: `Auto-topup via system web gateway. Ref token: [${token}]. Network Trx ID: ${parsed.txId || 'N/A'}`,
            amount: parsed.amount,
            status: 'success'
          })

          // 4. Fire notifications summary
          await supabase.from('notifications').insert({
            user_id: targetUser,
            title: 'Wallet Credited! 💰',
            message: `₵${parsed.amount.toFixed(2)} added to your wallet layout dynamically.`,
            type: 'topup'
          })
          // --- END TRANSACTION LAYER ---

          credited = true
          creditedUserId = targetUser
          break // Escape evaluation matrix immediately upon successful match
        }
      }
    }

    // Save fallback entry for manually auditing or verifying missing transactions
    if (!credited) {
      await supabase.from('topups').insert({
        reference_code: parsed.refCode || null,
        transaction_id: parsed.txId || null,
        amount: parsed.amount || null,
        network: parsed.network,
        raw_sms: rawSms,
        status: 'unclaimed',
        method: 'MoMo'
      })
    }

    return res.status(200).json({
      success: true,
      credited,
      user_id: creditedUserId,
      extracted: {
        amount: parsed.amount,
        txId: parsed.txId,
        refCode: parsed.refCode
      }
    })

  } catch (globalError) {
    console.error('Fatal execution state drop:', globalError.message)
    return res.status(500).json({ error: 'Internal pipeline system exception' })
  }
}
