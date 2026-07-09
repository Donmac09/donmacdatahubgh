// Vercel Serverless Function: POST /api/orders/place
//
// Securely places a data order:
//  1. Verifies the buyer's Supabase session (JWT) server-side
//  2. Validates wallet balance, debits it, creates the order row
//  3. ALL orders are MANUAL delivery — never sent to GHData

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

function generateRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = ''
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
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
  if (profile.status === 'blocked') throw new Error('Your account has been blocked')

  return profile
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
      
      // ALL orders are manual delivery
      const isManual = true

      // 1. Create order row
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
          status: 'pending',  // Manual orders start as pending
          is_manual: true,
          ghdata_type: null,
          ghdata_status: 'manual',
          notes: 'Manual delivery required for all packages'
        })
        .select()
        .single()

      if (orderErr) throw new Error(orderErr.message)

      // 2. Debit wallet
      const { error: debitErr } = await supabaseAdmin.rpc('credit_user', {
        p_user_id: profile.id,
        p_amount: -item.price,
        p_desc: `Purchase ${item.network} ${item.dataLabel} (Ref: ${ref})`,
      })
      if (debitErr) throw new Error(debitErr.message)

      // 3. Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: profile.id,
        title: 'Order Placed!',
        message: `Your order for ${item.network} ${item.dataLabel} (Ref: ${ref}) has been placed. It requires manual processing.`,
        type: 'order',
      })

      // 4. Notify admin about manual order
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
      
      for (const admin of admins || []) {
        await supabaseAdmin.from('notifications').insert({
          user_id: admin.id,
          title: '📦 New Manual Order',
          message: `Order ${ref} (${item.network} ${item.dataLabel}) by ${profile.name} requires manual delivery.`,
          type: 'order',
        })
      }

      placedOrders.push({ ...order, is_manual: true })
    }

    return res.status(201).json({ 
      success: true, 
      orders: placedOrders,
      message: 'All orders are manual delivery. Admin will process them.'
    })

  } catch (err) {
    console.error('place order error:', err.message)
    return res.status(400).json({ error: err.message || 'Failed to place order' })
  }
        }
