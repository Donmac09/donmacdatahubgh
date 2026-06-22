// Vercel Serverless: GET /api/admin/ghdata-balance
// Fetches the GHData wholesale wallet balance — admin only.
// Token never reaches the browser.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

const GHDATA_BASE = 'https://ghdataconnect.com/api'
const GHDATA_TOKEN = process.env.GHDATA_API_TOKEN || '144|Upj7FsClobi8bIWLBWozmXOTRUzSDK2DCx0u2vuD3f64701d'

async function verifyAdmin(jwt) {
  if (!jwt) throw new Error('Missing Authorization header')
  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  })
  const { data: { user }, error } = await supabaseAuth.auth.getUser(jwt)
  if (error || !user) throw new Error('Invalid or expired session')

  const { data: profile } = await supabaseAdmin.from('profiles').select('role, email, balance, name').eq('id', user.id).single()
  const isAdmin = user.email === 'donmacdatahub@gmail.com' || profile?.role === 'admin'
  if (!isAdmin) throw new Error('Admin access required')
  return profile
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim()
    const adminProfile = await verifyAdmin(jwt)

    let ghdataBalance = null
    let ghdataError = null

    try {
      const ghRes = await fetch(`${GHDATA_BASE}/v1/getWalletBalance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GHDATA_TOKEN}`,
          'Accept': 'application/json',
        },
      })
      const text = await ghRes.text()
      let json
      try { json = JSON.parse(text) } catch { json = { raw: text } }

      if (!ghRes.ok) {
        ghdataError = json?.message || json?.error || `GHData responded ${ghRes.status}`
      } else {
        // Parse the real GHDataConnect response shape (verified from Lovable integration)
        ghdataBalance =
          json?.data?.balance ??
          json?.data?.wallet_balance ??
          json?.balance ??
          json?.wallet?.balance ??
          json?.data?.available_balance ??
          null
      }
    } catch (e) {
      ghdataError = e.message
    }

    return res.status(200).json({
      success: true,
      platform_balance: parseFloat(adminProfile.balance) || 0,
      ghdata_balance: ghdataBalance,
      ghdata_error: ghdataError,
    })

  } catch (err) {
    return res.status(403).json({ error: err.message })
  }
}
