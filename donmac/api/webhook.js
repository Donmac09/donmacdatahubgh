// Vercel Serverless Function: /api/webhook
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================
// STRICT BLOCKED TOKENS - Expanded to prevent false matches
// ============================================================
const BLOCKED_TOKENS = new Set([
  'AMOUNT', 'STATUS', 'MOBILE', 'BALANC', 'VOLUME', 'MASHUP',
  'PREMIU', 'BUNDLE', 'VODAFO', 'TELECE', 'AIRTEL', 'MOMOPY',
  'MTN', 'VODA', 'TIGO', 'MOMO', 'CASH', 'GHANA', 'PAY',
  'LUKMAN', 'KOFI', 'AMA', 'YAW', 'KWAME', 'AKUA',
  'JOE', 'MIKE', 'JOHN', 'PETER', 'DAVID', 'PAUL',
  // 🔴 Critical additions to prevent random matches:
  'RECEIV', 'CASHIN', 'CREDIT', 'DEBIT', 'BALANCE',
  'PENDING', 'SUCCESS', 'FAILED', 'DECLINED', 'REFUND',
  'MESSAGE', 'SENDER', 'PHONE', 'NUMBER', 'CALLER',
  'TEST', 'DEMO', 'SAMPLE', 'EXAMPLE', 'DUMMY'
])

// ============================================================
// VALIDATION: Check if this is actually an SMS
// ============================================================
function isValidSms(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return false
  }

  // Must contain at least one of these indicators
  const indicators = [
    'GHS', 'MTN', 'TELECEL', 'AIRTEL', 'TIGO', 'MOMO',
    'received', 'payment', 'trans', 'txn', 'ref', 'credited',
    'debit', 'balance', 'cash', 'money', 'wallet'
  ]
  
  const lowerText = text.toLowerCase()
  return indicators.some(ind => lowerText.includes(ind))
}

// ============================================================
// EXTRACT SMS TEXT from various payload formats
// ============================================================
function extractSmsText(body) {
  // If it's a simple string, return it directly
  if (typeof body === 'string' && body.length > 5) {
    return body
  }

  // Handle nested data structures
  const possibleFields = [
    'message', 'sms', 'text', 'body', 'Content', 'Body',
    'content', 'msg', 'payload', 'data', 'MESSAGE',
    'SMS', 'Text', 'Message'
  ]
  
  // Check top-level fields
  for (const field of possibleFields) {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 5) {
      return body[field]
    }
  }
  
  // Check nested data objects
  if (body.data && typeof body.data === 'object') {
    for (const field of possibleFields) {
      if (body.data[field] && typeof body.data[field] === 'string' && body.data[field].length > 5) {
        return body.data[field]
      }
    }
  }
  
  // Check payload objects
  if (body.payload && typeof body.payload === 'object') {
    for (const field of possibleFields) {
      if (body.payload[field] && typeof body.payload[field] === 'string' && body.payload[field].length > 5) {
        return body.payload[field]
      }
    }
  }
  
  // Fallback: scan all object values for SMS-like content
  if (typeof body === 'object') {
    for (const key of Object.keys(body)) {
      const value = body[key]
      if (typeof value === 'string' && value.length > 20) {
        if (value.match(/GHS|REF|MOMO|MTN|TELECEL|AIRTEL|TIGO|received|payment/i)) {
          return value
        }
      }
    }
  }
  
  return ''
}

// ============================================================
// PARSE SMS: Extract amount, txId, refCode
// ============================================================
function parseSMS(text) {
  const result = {
    amount: null,
    txId: null,
    refCode: null,
    network: 'MoMo',
    possibleRefs: [],
    isValid: false
  }

  if (!text || !text.trim()) return result

  const trimmedText = text.trim()

  // ============================================================
  // 1. Extract Amount
  // ============================================================
  const amountMatch = trimmedText.match(/GHS\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    trimmedText.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*GHS/i)
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1])
  }

  // ============================================================
  // 2. Extract Transaction ID
  // ============================================================
  const txMatch = trimmedText.match(/(?:Trans|Txn|Transaction|Tx)\s*(?:ID|Id|id)?\s*[:#]?\s*([A-Z0-9]{8,20})/i) ||
    trimmedText.match(/\b([A-Z0-9]{9,15})\b/i)
  if (txMatch) {
    result.txId = txMatch[1].toUpperCase()
  }

  // ============================================================
  // 3. Extract Reference Code (ONLY if preceded by "Ref" or "Reference")
  // ============================================================
  // 🔴 FIX: Only extract if explicitly labeled as a reference
  const refPatternMatch = trimmedText.match(/(?:Ref|Reference)[:\s#]*([A-Z0-9]{6})\b/i)
  if (refPatternMatch) {
    const refCandidate = refPatternMatch[1].toUpperCase()
    // Verify it's not a blocked token
    if (!BLOCKED_TOKENS.has(refCandidate) && !/^\d+$/.test(refCandidate)) {
      result.refCode = refCandidate
      result.possibleRefs.push(refCandidate)
    }
  }

  // ============================================================
  // 4. Fallback: Find all 6-char tokens (but only if they make sense)
  // ============================================================
  // Only use this as a fallback if we already have a refCode
  if (result.refCode) {
    const allSixCharMatches = trimmedText.match(/\b([A-Z0-9]{6})\b/gi) || []
    const cleanTokens = allSixCharMatches
      .map(t => t.toUpperCase())
      .filter(t => {
        if (t.length !== 6) return false
        if (/^\d+$/.test(t)) return false
        if (BLOCKED_TOKENS.has(t)) return false
        return true
      })
    
    // Add any additional tokens found
    for (const token of cleanTokens) {
      if (!result.possibleRefs.includes(token)) {
        result.possibleRefs.push(token)
      }
    }
  }

  // ============================================================
  // 5. Detect Network
  // ============================================================
  const lowerText = trimmedText.toLowerCase()
  if (lowerText.includes('mtn') || lowerText.includes('momo')) {
    result.network = 'MTN MoMo'
  } else if (lowerText.includes('vodafone') || lowerText.includes('telecel') || lowerText.includes('cash')) {
    result.network = 'Telecel Cash'
  } else if (lowerText.includes('airtel') || lowerText.includes('tigo') || lowerText.includes('at money')) {
    result.network = 'AirtelTigo Money'
  }

  // ============================================================
  // 6. Mark as valid if we have enough information
  // ============================================================
  if (result.amount && result.amount > 0) {
    result.isValid = true
  }

  return result
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  // Handle GET requests (health checks)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Webhook endpoint is active. Send POST requests with SMS content.',
      tip: 'Include SMS text in fields: message, sms, text, body, payload, or data'
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body
    console.log('📥 Webhook received:', JSON.stringify(body, null, 2))

    // ============================================================
    // 🔴 CRITICAL: Extract and validate SMS
    // ============================================================
    const rawSms = extractSmsText(body)

    // ✅ If no SMS found, return early (prevent random top-ups!)
    if (!rawSms || !rawSms.trim() || rawSms.trim().length < 10) {
      console.log('⚠️ No valid SMS text found in payload. Ignoring request.')
      return res.status(200).json({
        success: false,
        message: 'No SMS text found in payload - ignored',
        received: body
      })
    }

    // ✅ Validate this is actually an SMS with financial content
    if (!isValidSms(rawSms)) {
      console.log('⚠️ SMS does not contain financial keywords. Ignoring.')
      return res.status(200).json({
        success: false,
        message: 'SMS does not appear to be a financial transaction - ignored',
        preview: rawSms.substring(0, 100)
      })
    }

    console.log('📝 Valid SMS text:', rawSms)

    // ============================================================
    // Parse the SMS
    // ============================================================
    const parsed = parseSMS(rawSms)
    console.log('🔍 Parsed:', parsed)

    // ✅ If no amount or refCode, don't process
    if (!parsed.amount || parsed.amount <= 0) {
      console.log('⚠️ No valid amount found. Skipping.')
      return res.status(200).json({
        success: false,
        message: 'No valid amount found - ignored',
        extracted: { amount: parsed.amount }
      })
    }

    // ✅ If no refCode, don't process (prevents random top-ups)
    if (!parsed.refCode) {
      console.log('⚠️ No reference code found. Skipping.')
      return res.status(200).json({
        success: false,
        message: 'No reference code found - ignored',
        extracted: { refCode: parsed.refCode, possibleRefs: parsed.possibleRefs }
      })
    }

    // ============================================================
    // Check for duplicate transaction
    // ============================================================
    if (parsed.txId) {
      const { data: existingTx } = await supabaseAdmin
        .from('topups')
        .select('id, status, user_id')
        .eq('transaction_id', parsed.txId)
        .maybeSingle()

      if (existingTx) {
        if (existingTx.status === 'claimed') {
          return res.status(200).json({
            success: true,
            message: 'Transaction already claimed',
            transaction_id: parsed.txId,
            user_id: existingTx.user_id
          })
        }
      }
    }

    // ============================================================
    // Process the top-up
    // ============================================================
    let credited = false
    let creditedUserId = null

    // Use the refCode we found
    const refsToTry = [parsed.refCode, ...parsed.possibleRefs]
    const uniqueRefs = [...new Set(refsToTry)]

    for (const token of uniqueRefs) {
      if (!token) continue

      console.log(`🔍 Looking for topup with reference: ${token}`)

      const { data: topupRows } = await supabaseAdmin
        .from('topups')
        .select('*')
        .eq('reference_code', token)
        .eq('status', 'unclaimed')
        .limit(1)

      if (topupRows && topupRows.length > 0) {
        const matchingTopup = topupRows[0]
        const targetUser = matchingTopup.user_id

        console.log(`✅ Found matching topup for user: ${targetUser}`)

        if (targetUser && parsed.amount && parsed.amount > 0) {
          // Update user balance
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', targetUser)
            .single()

          const originalBalance = Number(profile?.balance || 0)
          const finalizedBalance = originalBalance + parsed.amount

          // Update profile balance
          await supabaseAdmin
            .from('profiles')
            .update({ balance: finalizedBalance })
            .eq('id', targetUser)

          // Mark topup as claimed
          await supabaseAdmin
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

          // Create transaction record
          await supabaseAdmin.from('transactions').insert({
            user_id: targetUser,
            type: 'credit',
            description: `Auto-topup via SMS. Ref: [${token}]. TxID: ${parsed.txId || 'N/A'}`,
            amount: parsed.amount,
            status: 'success'
          })

          // Send notification
          await supabaseAdmin.from('notifications').insert({
            user_id: targetUser,
            title: 'Wallet Credited! 💰',
            message: `₵${parsed.amount.toFixed(2)} added to your wallet.`,
            type: 'topup'
          })

          credited = true
          creditedUserId = targetUser
          console.log(`✅ Successfully credited user ${targetUser} with ₵${parsed.amount}`)
          break
        }
      }
    }

    // ============================================================
    // 🔴 REMOVED: Auto-creation of topups
    // ============================================================
    // We no longer create unclaimed topups automatically.
    // This prevents random SMS from creating phantom records.
    if (!credited) {
      console.log(`⚠️ No matching unclaimed topup found for ref: ${parsed.refCode}`)
      return res.status(200).json({
        success: false,
        message: 'No matching unclaimed topup found',
        extracted: {
          amount: parsed.amount,
          txId: parsed.txId,
          refCode: parsed.refCode,
          possibleRefs: parsed.possibleRefs,
          network: parsed.network
        }
      })
    }

    // ============================================================
    // Success response
    // ============================================================
    return res.status(200).json({
      success: true,
      credited,
      user_id: creditedUserId,
      amount: parsed.amount,
      transaction_id: parsed.txId,
      reference_code: parsed.refCode,
      extracted: {
        amount: parsed.amount,
        txId: parsed.txId,
        refCode: parsed.refCode,
        possibleRefs: parsed.possibleRefs,
        network: parsed.network
      }
    })
  } catch (globalError) {
    console.error('❌ Webhook error:', globalError.message)
    return res.status(500).json({
      error: 'Internal server error',
      message: globalError.message
    })
  }
}
