// Vercel Serverless Function: /api/webhook
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

function parseSMS(text) {
  const result = { 
    amount: null, 
    txId: null, 
    refCode: null, 
    network: 'MoMo', 
    possibleRefs: [] 
  }
  
  if (!text) return result

  console.log('🔍 Parsing SMS:', text)

  // ============================================================
  // 1. Extract Amount
  // ============================================================
  const amountMatch = text.match(/GHS\s*([0-9]+(?:\.[0-9]{1,2})?)/i) || 
                      text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*GHS/i)
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1])
    console.log('✅ Amount found:', result.amount)
  }

  // ============================================================
  // 2. Extract Transaction ID
  // ============================================================
  const txMatch = text.match(/(?:Trans|Txn|Transaction|Tx)\s*(?:ID|Id|id)?\s*[:#]?\s*([A-Z0-9]{8,20})/i) ||
                  text.match(/\b([A-Z0-9]{9,15})\b/i)
  if (txMatch) {
    result.txId = txMatch[1].toUpperCase()
    console.log('✅ Transaction ID found:', result.txId)
  }

  // ============================================================
  // 3. Extract Reference Code (6 characters)
  // ============================================================
  const allSixCharMatches = text.match(/\b([A-Z0-9]{6})\b/gi)
  console.log('🔍 All 6-char matches:', allSixCharMatches)
  
  const BLOCKED_TOKENS = new Set([
    'AMOUNT', 'STATUS', 'MOBILE', 'BALANC', 'VOLUME', 'MASHUP', 
    'PREMIU', 'BUNDLE', 'VODAFO', 'TELECE', 'AIRTEL', 'MOMOPY',
    'MTN', 'VODA', 'TIGO', 'MOMO', 'CASH', 'GHANA', 'PAY',
    'LUKMAN', 'KOFI', 'AMA', 'YAW', 'KWAME', 'AKUA',
    'JOE', 'MIKE', 'JOHN', 'PETER', 'DAVID', 'PAUL'
  ])

  if (allSixCharMatches) {
    const cleanTokens = allSixCharMatches
      .map(t => t.toUpperCase())
      .filter(t => {
        if (t.length !== 6) return false
        if (/^\d+$/.test(t)) return false
        if (BLOCKED_TOKENS.has(t)) return false
        return true
      })

    result.possibleRefs = [...new Set(cleanTokens)]
    console.log('✅ Clean reference tokens:', result.possibleRefs)
    
    // Prefer reference that appears after "Ref:" or "Reference:"
    const refPatternMatch = text.match(/(?:Ref|Reference)[:\s#]*([A-Z0-9]{6})\b/i)
    if (refPatternMatch) {
      const refFromPattern = refPatternMatch[1].toUpperCase()
      if (result.possibleRefs.includes(refFromPattern)) {
        result.refCode = refFromPattern
      } else {
        result.refCode = result.possibleRefs[0] || null
      }
    } else {
      result.refCode = result.possibleRefs[0] || null
    }
    console.log('✅ Selected refCode:', result.refCode)
  }

  // ============================================================
  // 4. Detect Network
  // ============================================================
  const lowerText = text.toLowerCase()
  if (lowerText.includes('mtn') || lowerText.includes('momo')) {
    result.network = 'MTN MoMo'
  } else if (lowerText.includes('vodafone') || lowerText.includes('telecel') || lowerText.includes('cash')) {
    result.network = 'Telecel Cash'
  } else if (lowerText.includes('airtel') || lowerText.includes('tigo') || lowerText.includes('at money')) {
    result.network = 'AirtelTigo Money'
  }

  return result
}

function extractSmsText(body) {
  const possibleFields = [
    'message', 'sms', 'text', 'body', 'Content', 'Body', 
    'content', 'msg', 'payload', 'data', 'MESSAGE', 
    'SMS', 'Text', 'Message'
  ]
  
  for (const field of possibleFields) {
    if (body[field] && typeof body[field] === 'string' && body[field].length > 5) {
      console.log('📝 Found SMS in field:', field, body[field])
      return body[field]
    }
  }
  
  if (body.data && typeof body.data === 'object') {
    for (const field of possibleFields) {
      if (body.data[field] && typeof body.data[field] === 'string' && body.data[field].length > 5) {
        console.log('📝 Found SMS in data.' + field, body.data[field])
        return body.data[field]
      }
    }
  }
  
  if (body.payload && typeof body.payload === 'object') {
    for (const field of possibleFields) {
      if (body.payload[field] && typeof body.payload[field] === 'string' && body.payload[field].length > 5) {
        console.log('📝 Found SMS in payload.' + field, body.payload[field])
        return body.payload[field]
      }
    }
  }
  
  if (typeof body === 'object') {
    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'string' && body[key].length > 20) {
        if (body[key].match(/GHS|REF|MOMO|MTN|TELECEL|AIRTEL|TIGO|Ghana|received|payment/i)) {
          console.log('📝 Found SMS in key:', key, body[key])
          return body[key]
        }
      }
    }
  }
  
  console.log('❌ No SMS text found in payload')
  return ''
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook endpoint is active. Send POST requests with SMS content.' 
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method access denied' })
  }

  try {
    const body = req.body
    console.log('📥 Webhook received:', JSON.stringify(body, null, 2))
    
    const rawSms = extractSmsText(body)

    if (!rawSms || !rawSms.trim()) {
      return res.status(400).json({ 
        error: 'Payload body cannot be blank',
        received: body,
        hint: 'Send SMS text in field: message, sms, text, body, Content, payload, or data'
      })
    }

    console.log('📝 SMS text:', rawSms)

    const parsed = parseSMS(rawSms)
    console.log('🔍 Parsed result:', JSON.stringify(parsed, null, 2))

    // ============================================================
    // DEBUG: Check if there's a matching topup
    // ============================================================
    if (parsed.refCode) {
      console.log('🔍 Looking for topup with refCode:', parsed.refCode)
      const { data: topupCheck } = await supabaseAdmin
        .from('topups')
        .select('*')
        .eq('reference_code', parsed.refCode)
        .eq('status', 'unclaimed')
        .maybeSingle()
      
      console.log('🔍 Topup check result:', topupCheck ? 'FOUND' : 'NOT FOUND')
      if (topupCheck) {
        console.log('🔍 Topup details:', JSON.stringify(topupCheck, null, 2))
      }
    }

    // Check if transaction already exists
    if (parsed.txId) {
      console.log('🔍 Looking for existing txId:', parsed.txId)
      const { data: existingTx } = await supabaseAdmin
        .from('topups')
        .select('id, status, user_id')
        .eq('transaction_id', parsed.txId)
        .maybeSingle()

      if (existingTx) {
        console.log('🔍 Existing transaction found:', existingTx)
        if (existingTx.status === 'claimed') {
          return res.status(200).json({ success: true, message: 'Transaction already settled' })
        }
      }
    }

    let credited = false
    let creditedUserId = null

    // Try each possible reference code
    const refsToTry = parsed.refCode ? [parsed.refCode, ...parsed.possibleRefs] : parsed.possibleRefs
    const uniqueRefs = [...new Set(refsToTry)]
    console.log('🔍 Trying reference codes:', uniqueRefs)

    for (const token of uniqueRefs) {
      if (!token) continue
      
      console.log('🔍 Checking token:', token)
      const { data: topupRows } = await supabaseAdmin
        .from('topups')
        .select('*')
        .eq('reference_code', token)
        .eq('status', 'unclaimed')
        .limit(1)

      if (topupRows && topupRows.length > 0) {
        console.log('✅ Found matching topup for token:', token)
        const matchingTopup = topupRows[0]
        console.log('✅ Topup details:', JSON.stringify(matchingTopup, null, 2))
        const targetUser = matchingTopup.user_id

        if (targetUser && parsed.amount && parsed.amount > 0) {
          console.log('✅ Crediting user:', targetUser, 'Amount:', parsed.amount)
          
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('balance')
            .eq('id', targetUser)
            .single()

          const originalBalance = Number(profile?.balance || 0)
          const finalizedBalance = originalBalance + parsed.amount

          await supabaseAdmin
            .from('profiles')
            .update({ balance: finalizedBalance })
            .eq('id', targetUser)

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

          await supabaseAdmin.from('transactions').insert({
            user_id: targetUser,
            type: 'credit',
            description: `Auto-topup via webhook. Ref: [${token}]. TxID: ${parsed.txId || 'N/A'}`,
            amount: parsed.amount,
            status: 'success'
          })

          await supabaseAdmin.from('notifications').insert({
            user_id: targetUser,
            title: 'Wallet Credited! 💰',
            message: `₵${parsed.amount.toFixed(2)} added to your wallet.`,
            type: 'topup'
          })

          credited = true
          creditedUserId = targetUser
          console.log('✅ Credit successful!')
          break
        } else {
          console.log('❌ No target user or amount:', { targetUser, amount: parsed.amount })
        }
      } else {
        console.log('❌ No topup found for token:', token)
      }
    }

    if (!credited) {
      console.log('📝 Storing as unclaimed topup')
      await supabaseAdmin.from('topups').insert({
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
        refCode: parsed.refCode,
        possibleRefs: parsed.possibleRefs
      }
    })

  } catch (globalError) {
    console.error('Webhook error:', globalError.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
