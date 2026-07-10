// Vercel Serverless Function: POST /api/orders/place
//
// Securely places a data order:
//  1. Verifies the buyer's Supabase session (JWT) server-side
//  2. Validates wallet balance, debits it, creates the order row
//  3. Dispatches to GHData ONLY for auto-delivery networks
//     (MTN, Telecel, AirtelTigo Premium, AirtelTigo Big Time)
//  4. MTN Mashup Data & MTN Mashup Minutes+Data are MANUAL delivery —
//     never sent to GHData, order just sits as 'pending' for admin to fulfil
//
// The GHData API token NEVER reaches the browser — it lives only here.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

const GHDATA_BASE = 'https://ghdataconnect.com/api'
const GHDATA_TOKEN = process.env.GHDATA_API_TOKEN || '144|Upj7FsClobi8bIWLBWozmXOTRUzSDK2DCx0u2vuD3f64701d'

// Package groups that are fulfilled manually by admin — NEVER sent to GHData
const MANUAL_DELIVERY_GROUPS = new Set(['mtn_mashup', 'mtn_mashup_min'])

// GHData network candidates - corrected values
const GHDATA_NETWORK_CANDIDATES = {
  mtn:             ['MTN', 'mtn'],
  telecel:         ['TELECEL', 'telecel', 'VODAFONE', 'vodafone'],
  airtel_bigtime:  ['AT_BIGTIME', 'AT-BIGTIME', 'atbigtime', 'at_bigtime', 'at-bigtime', 'AIRTELTIGO_BIGTIME', 'AIRTELTIGO'],
  airtel_premium:  [
    'AT_PREMIUM', 'AT-PREMIUM', 'AIRTELTIGO_PREMIUM', 'AIRTELTIGOPREMIUM',
    'AT_PREMIUM_BUNDLE', 'AIRTELTIGO_PREMIUM_BUNDLE', 'premium', 'PREMIUM',
    'atpremium', 'at_premium', 'at-premium', 'airteltigo_premium', 'airteltigopremium',
    'AIRTELTIGO', 'airteltigo',
  ],
}

function generateRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = ''
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function parseCapacityGB(dataLabel) {
  if (!dataLabel) return null
  const match = String(dataLabel).match(/([0-9]+(?:\.[0-9]+)?)\s*GB/i)
  if (!match) return null
  return parseFloat(match[1])
}

async function getAuthedUser(req) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!jwt) throw new Error('Missing Authorization header')

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  })
  const { data: { user }, error } = await supabaseAuth.auth.getUser(jwt)
  if (error || !user) throw new Error('Invalid or expired session')

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileErr || !profile) throw new Error('Profile not found')
  
  if (profile.status === 'blocked') {
    throw new Error('Your account has been blocked')
  }

  return profile
}

async function dispatchToGHData({ groupKey, phone, capacity, ref }) {
  const candidates = GHDATA_NETWORK_CANDIDATES[groupKey]
  if (!candidates) throw new Error(`No GHData network mapping for group "${groupKey}"`)

  // Ensure capacity is a number
  const numericCapacity = Number(capacity)
  if (isNaN(numericCapacity) || numericCapacity <= 0) {
    throw new Error(`Invalid capacity: ${capacity} (must be a positive number)`)
  }

  const diagnostics = []
  let lastResult = null
  let lastStatus = 0

  for (const networkKey of candidates) {
    const url = `${GHDATA_BASE}/v1/purchaseBundle`
    const requestBody = {
      network: networkKey,
      reference: ref,
      msisdn: phone,
      capacity: numericCapacity,
    }

    console.log(`📤 GHData attempt ${networkKey}:`, JSON.stringify(requestBody))

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHDATA_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const text = await res.text()
      lastStatus = res.status
      
      let json
      try { json = JSON.parse(text) } catch { json = { raw: text } }
      lastResult = json

      console.log(`📥 GHData response ${networkKey}:`, { status: res.status, body: json })

      diagnostics.push({ networkKey, requestBody, status: res.status, response: json })

      // Check if successful
      if (res.ok && json?.success) {
        const actualRef = json.data?.reference ?? json.data?.id ?? json.reference ?? ref
        return {
          success: true,
          externalRef: String(actualRef),
          matchedNetworkKey: networkKey,
          debug: { url, diagnostics },
        }
      }

      // Check if this is a network validation error (try next candidate)
      const message = String(json?.message ?? '').toLowerCase()
      const networkErrors = Array.isArray(json?.errors?.network)
        ? json.errors.network.join(' ').toLowerCase()
        : String(json?.errors?.network ?? '').toLowerCase()
      
      const looksLikeNetworkKeyError =
        res.status === 422 ||
        message.includes('validation') ||
        networkErrors.includes('network') ||
        networkErrors.includes('invalid') ||
        networkErrors.includes('selected') ||
        message.includes('network') ||
        message.includes('not found') ||
        message.includes('unsupported')

      if (!looksLikeNetworkKeyError) break

    } catch (error) {
      console.error(`❌ GHData fetch error for ${networkKey}:`, error.message)
      diagnostics.push({ networkKey, error: error.message })
      // Continue to next candidate if it's a network error
    }
  }

  // All candidates exhausted
  const err = new Error(lastResult?.message || `GHData responded ${lastStatus} for all network key variants`)
  err.ghdataDebug = { lastStatus, lastResult, diagnostics }
  throw err
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const profile = await getAuthedUser(req)
    const { items } = req.body || {}

    console.log('📦 Order request:', { user: profile.id, items: items?.length })

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' })
    }

    const totalAmount = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

    if (parseFloat(profile.balance) < totalAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' })
    }

    const placedOrders = []

    for (const item of items) {
      const ref = generateRef()
      const isManual = MANUAL_DELIVERY_GROUPS.has(item.groupKey)
      const capacity = isManual ? null : parseCapacityGB(item.dataLabel)

      console.log(`📦 Order ${ref}:`, { 
        groupKey: item.groupKey, 
        isManual, 
        capacity, 
        phone: item.phone,
        dataLabel: item.dataLabel
      })

      // Check if this is an auto-delivery package but capacity couldn't be parsed
      if (!isManual && capacity === null) {
        console.warn(`⚠️ Could not parse capacity from "${item.dataLabel}" for group ${item.groupKey} — falling back to manual delivery`)
      }
      const effectiveIsManual = isManual || capacity === null

      // Create order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          ref,
          user_id: profile.id,
          reseller_id: profile.reseller_id || null,
          network: item.network,
          package: item.dataLabel,
          package_key: item.itemId,
          phone: item.phone,
          amount: item.price,
          cost_price: item.costPrice || item.price,
          status: effectiveIsManual ? 'pending' : 'processing',
          is_manual: effectiveIsManual,
          ghdata_type: effectiveIsManual ? null : item.groupKey,
          ghdata_status: effectiveIsManual ? 'manual' : 'pending_dispatch',
        })
        .select()
        .single()

      if (orderErr) throw new Error(orderErr.message)

      // Debit wallet
      const { error: debitErr } = await supabaseAdmin.rpc('credit_user', {
        p_user_id: profile.id,
        p_amount: -item.price,
        p_desc: `Purchase ${item.network} ${item.dataLabel} (Ref: ${ref})`,
      })
      if (debitErr) throw new Error(debitErr.message)

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: profile.id,
        title: 'Order Placed!',
        message: `Your order for ${item.network} ${item.dataLabel} (Ref: ${ref}) has been placed.`,
        type: 'order',
      })

      // Dispatch to GHData if not manual
      if (!effectiveIsManual) {
        try {
          console.log(`🚀 Dispatching to GHData: ${ref}`)
          
          // Ensure capacity is a valid number before dispatching
          if (!capacity || isNaN(capacity) || capacity <= 0) {
            throw new Error(`Invalid capacity value: ${capacity}`)
          }

          const result = await dispatchToGHData({
            groupKey: item.groupKey,
            phone: item.phone,
            capacity: capacity,
            ref,
          })

          console.log(`✅ GHData success for ${ref}:`, result)

          await supabaseAdmin
            .from('orders')
            .update({
              external_id: result.externalRef,
              ghdata_ref: result.externalRef,
              ghdata_status: 'dispatched',
              status: 'processing',
              notes: JSON.stringify({ matchedNetworkKey: result.matchedNetworkKey, ...result.debug }).slice(0, 2000),
            })
            .eq('id', order.id)

        } catch (ghErr) {
          console.error('❌ GHData dispatch failed for order', ref, ghErr.message)

          const debugInfo = ghErr.ghdataDebug
            ? JSON.stringify(ghErr.ghdataDebug)
            : JSON.stringify({ error: ghErr.message })

          await supabaseAdmin
            .from('orders')
            .update({
              status: 'failed',
              ghdata_status: 'failed',
              notes: debugInfo.slice(0, 2000),
            })
            .eq('id', order.id)

          // Refund
          const { error: refundErr } = await supabaseAdmin.rpc('refund_failed_order', { p_order_id: order.id })
          if (refundErr) console.error('Auto-refund failed for order', ref, refundErr.message)

          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Order Failed — Refunded',
            message: `Order ${ref} could not be auto-delivered and has been refunded to your wallet.`,
            type: 'order',
          })

          const { data: admins } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
          for (const admin of admins || []) {
            await supabaseAdmin.from('notifications').insert({
              user_id: admin.id,
              title: '⚠️ GHData Dispatch Failed',
              message: `Order ${ref} (${item.network} ${item.dataLabel}) failed to auto-deliver and was refunded: ${ghErr.message}`,
              type: 'order',
            })
          }
        }
      }

      placedOrders.push({ ...order, is_manual: effectiveIsManual })
    }

    return res.status(201).json({ success: true, orders: placedOrders })

  } catch (err) {
    console.error('❌ place order error:', err.message)
    return res.status(400).json({ error: err.message || 'Failed to place order' })
  }
}
