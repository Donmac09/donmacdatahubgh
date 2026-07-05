// Vercel Serverless Function: /api/webhook
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================
// BLOCKED TOKENS - Words that look like ref codes but aren't
// ============================================================
const BLOCKED_TOKENS = new Set([
  'AMOUNT', 'STATUS', 'MOBILE', 'BALANC', 'VOLUME', 'MASHUP',
  'PREMIU', 'BUNDLE', 'VODAFO', 'TELECE', 'AIRTEL', 'MOMOPY',
  'MTN', 'VODA', 'TIGO', 'MOMO', 'CASH', 'GHANA', 'PAY',
  'LUKMAN', 'KOFI', 'AMA', 'YAW', 'KWAME', 'AKUA',
  'JOE', 'MIKE', 'JOHN', 'PETER', 'DAVID', 'PAUL',
  'RECEIV', 'CASHIN', 'CREDIT', 'DEBIT', 'BALANCE',
  'PENDING', 'SUCCESS', 'FAILED', 'DECLINED', 'REFUND',
  'MESSAGE', 'SENDER', 'PHONE', 'NUMBER', 'CALLER',
  'TEST', 'DEMO', 'SAMPLE', 'EXAMPLE', 'DUMMY',
  'TOTAL', 'BONUS', 'PROMO', 'DISCOUNT'
])

// ============================================================
// STRICT VALIDATION: Check if this is actually an SMS
// ============================================================
function isValidSms(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return false
  }

  // Must contain at least one financial indicator
  const indicators = [
    'GHS', 'MTN', 'TELECEL', 'AIRTEL', 'TIGO', 'MOMO',
    'received', 'payment', 'trans', 'txn', 'credited',
    'debit', 'balance', 'cash', 'money', 'wallet',
    'amount', 'paid', 'transfer', 'deposit'
  ]
  
  const lowerText = text.toLowerCase()
  const hasIndicator = indicators.some(ind => lowerText.includes(ind))
  
  // Must also contain a number (amount)
  const hasNumber = /\d+/.test(text)
  
  return hasIndicator && hasNumber
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
// PARSE SMS: Extract amount, txId, refCode (if present)
// ============================================================
function parseSMS(text) {
  const result = {
    amount: null,
    txId: null,
    refCode: null,
    network: 'Unknown',
    sender: null,
    phone: null
  }

  if (!text || !text.trim()) return result

  const trimmedText = text.trim()

  // ============================================================
  // 1. Extract Amount (GHS)
  // ============================================================
  // Try: GHS 50.00 or 50.00 GHS
  const amountMatch = trimmedText.match(/GHS\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    trimmedText.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*GHS/i)
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1])
  }

  // If no GHS found, try any number with currency context
  if (!result.amount) {
    const currencyMatch = trimmedText.match(/(?:amount|payment|transfer|received|credited|paid|deposit).*?([0-9]+(?:\.[0-9]{1,2})?)/i)
    if (currencyMatch) {
      result.amount = parseFloat(currencyMatch[1])
    }
  }

  // ============================================================
  // 2. Extract Transaction ID
  // ============================================================
  const txMatch = trimmedText.match(/(?:Trans|Txn|Transaction|Tx)\s*(?:ID|Id|id)?\s*[:#]?\s*([A-Z0-9]{8,20})/i) ||
    trimmedText.match(/\b([A-Z0-9]{9,15})\b/i)
  if (txMatch) {
    const potential = txMatch[1].toUpperCase()
    // Don't use if it's a blocked token
    if (!BLOCKED_TOKENS.has(potential)) {
      result.txId = potential
    }
  }

  // ============================================================
  // 3. Extract Reference Code (ONLY if explicitly labeled)
  // ============================================================
  const refPatternMatch = trimmedText.match(/(?:Ref|Reference)[:\s#]*([A-Z0-9]{6})\b/i)
  if (refPatternMatch) {
    const refCandidate = refPatternMatch[1].toUpperCase()
    if (!BLOCKED_TOKENS.has(refCandidate) && !/^\d+$/.test(refCandidate)) {
      result.refCode = refCandidate
    }
  }

  // ============================================================
  // 4. Look for 6-character codes in SMS (for reference matching)
  // ============================================================
  // Find all 6-character alphanumeric tokens
  const allSixCharMatches = trimmedText.match(/\b([A-Z0-9]{6})\b/gi) || []
  const possibleRefs = []
  
  for (const match of allSixCharMatches) {
    const token = match.toUpperCase()
    if (!BLOCKED_TOKENS.has(token) && !/^\d+$/.test(token)) {
      possibleRefs.push(token)
    }
  }
  
  // If we found a refCode, also add it to possible refs
  if (result.refCode && !possibleRefs.includes(result.refCode)) {
    possibleRefs.unshift(result.refCode)
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
  // 6. Extract sender/phone if present
  // ============================================================
  const phoneMatch = trimmedText.match(/(?:from|sender|phone|number)[:\s]*([0-9]{10,15})/i) ||
    trimmedText.match(/\b(0[0-9]{9,12})\b/)
  if (phoneMatch) {
    result.phone = phoneMatch[1]
  }

  // Store possible refs for processing
  result.possibleRefs = possibleRefs

  return result
}

// ============================================================
// PROCESS: Try to find and claim a topup
// ============================================================
async function processTopup(parsed, rawSms) {
  let credited = false
  let creditedUserId = null
  let usedRef = null

  // If we have a refCode, try that first
  const refsToTry = []
  if (parsed.refCode) refsToTry.push(parsed.refCode)
  if (parsed.possibleRefs) {
    for (const ref of parsed.possibleRefs) {
      if (!refsToTry.includes(ref)) refsToTry.push(ref)
    }
  }

  console.log(`🔍 Trying refs: ${refsToTry.join(', ') || 'none'}`)

  // If no refs found, try to match by amount and transaction ID
  if (refsToTry.length === 0) {
    console.log('ℹ️ No reference code found, trying amount matching...')
    
    // Look for unclaimed topups with matching amount (within reasonable range)
    const { data: matchingTopups } = await supabaseAdmin
      .from('topups')
      .select('*')
      .eq('status', 'unclaimed')
      .gte('amount', (parsed.amount || 0) - 0.5)
      .lte('amount', (parsed.amount || 0) + 0.5)
      .limit(5)

    if (matchingTopups && matchingTopups.length > 0) {
      // If multiple, use the oldest one
      const topup = matchingTopups[0]
      console.log(`✅ Found matching topup by amount: ${topup.reference_code}`)
      
      const result = await claimTopup(topup, parsed, rawSms)
      if (result.credited) {
        return result
      }
    }
    
    console.log('ℹ️ No matching topup found by amount')
    return { credited: false, userId: null, usedRef: null }
  }

  // Try each reference code
  for (const token of refsToTry) {
    if (!token) continue

    console.log(`🔍 Looking for topup with reference: ${token}`)

    const { data: topupRows } = await supabaseAdmin
      .from('topups')
      .select('*')
      .eq('reference_code', token)
      .eq('status', 'unclaimed')
      .limit(1)

    if (topupRows && topupRows.length > 0) {
      const topup = topupRows[0]
      const result = await claimTopup(topup, parsed, rawSms)
      if (result.credited) {
        return { ...result, usedRef: token }
      }
    }
  }

  return { credited: false, userId: null, usedRef: null }
}

// ============================================================
// CLAIM: Process a specific topup
// ============================================================
async function claimTopup(topup, parsed, rawSms) {
  const targetUser = topup.user_id

  if (!targetUser || !parsed.amount || parsed.amount <= 0) {
    return { credited: false, userId: null }
  }

  try {
    // Get user's current balance
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
        transaction_id: parsed.txId || topup.transaction_id,
        network: parsed.network || topup.network,
        raw_sms: rawSms,
        claimed_at: new Date().toISOString()
      })
      .eq('id', topup.id)

    // Create transaction record
    await supabaseAdmin.from('transactions').insert({
      user_id: targetUser,
      type: 'credit',
      description: `Auto-topup via SMS. Ref: ${topup.reference_code}. TxID: ${parsed.txId || 'N/A'}`,
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

    console.log(`✅ Successfully credited user ${targetUser} with ₵${parsed.amount}`)
    return { credited: true, userId: targetUser }
  } catch (error) {
    console.error('❌ Error claiming topup:', error.message)
    return { credited: false, userId: null }
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  // Handle GET requests (health checks)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Webhook endpoint is active',
      tip: 'Send SMS in fields: message, sms, text, body, payload, or data'
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
      console.log('⚠️ No valid SMS text found. Ignoring request.')
      return res.status(200).json({
        success: false,
        message: 'No SMS text found - ignored',
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
    console.log('🔍 Parsed:', {
      amount: parsed.amount,
      txId: parsed.txId,
      refCode: parsed.refCode,
      possibleRefs: parsed.possibleRefs,
      network: parsed.network
    })

    // ✅ If no amount, can't process
    if (!parsed.amount || parsed.amount <= 0) {
      console.log('⚠️ No valid amount found. Skipping.')
      return res.status(200).json({
        success: false,
        message: 'No valid amount found - ignored',
        extracted: { amount: parsed.amount }
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
    // 🔴 CRITICAL: Process the topup WITHOUT auto-creating
    // ============================================================
    const result = await processTopup(parsed, rawSms)

    // ============================================================
    // 🔴 NEVER auto-create topups - just return the result
    // ============================================================
    if (!result.credited) {
      console.log(`ℹ️ No matching topup found. SMS logged but no action taken.`)
      return res.status(200).json({
        success: false,
        message: 'No matching unclaimed topup found',
        extracted: {
          amount: parsed.amount,
          txId: parsed.txId,
          refCode: parsed.refCode,
          possibleRefs: parsed.possibleRefs || [],
          network: parsed.network
        },
        suggestion: 'A topup record with this reference or amount does not exist in the system.'
      })
    }

    // ============================================================
    // Success response
    // ============================================================
    return res.status(200).json({
      success: true,
      credited: true,
      user_id: result.userId,
      amount: parsed.amount,
      transaction_id: parsed.txId,
      reference_code: result.usedRef,
      extracted: {
        amount: parsed.amount,
        txId: parsed.txId,
        refCode: parsed.refCode,
        possibleRefs: parsed.possibleRefs || [],
        network: parsed.network,
        phone: parsed.phone,
        sender: parsed.sender
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
