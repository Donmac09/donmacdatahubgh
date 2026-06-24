// External API: GET /api/v1/status?ref=ABC123
// Check the delivery status of a specific order by its reference code
// Authentication: Bearer <api_token>

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GHDATA_BASE = 'https://ghdataconnect.com/api'
const GHDATA_TOKEN = process.env.GHDATA_API_TOKEN || '144|Upj7FsClobi8bIWLBWozmXOTRUzSDK2DCx0u2vuD3f64701d'

async function authenticate(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) throw new Error('Missing Authorization header')
  const { data: profile, error } = await supabase
    .from('profiles').select('id,name,role,status').eq('api_token', token).single()
  if (error || !profile) throw new Error('Invalid API token')
  if (profile.status === 'blocked') throw new Error('Account blocked')
  return profile
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const profile = await authenticate(req)
    const ref = (req.query?.ref || '').toUpperCase().trim()

    if (!ref) {
      return res.status(400).json({
        error: 'ref query parameter is required. Example: GET /api/v1/status?ref=ABC123',
      })
    }

    // Fetch the order — must belong to the authenticated user
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id,ref,network,package,phone,amount,status,ghdata_status,ghdata_ref,external_id,is_manual,created_at,updated_at,notes')
      .eq('ref', ref)
      .eq('user_id', profile.id)
      .single()

    if (orderErr || !order) {
      return res.status(404).json({
        error: `Order with ref "${ref}" not found for your account.`,
      })
    }

    // For auto-delivery orders that are processing, optionally sync status from GHData
    let liveGhdataStatus = null
    if (!order.is_manual && order.ghdata_ref && order.status === 'processing') {
      try {
        const ghRes = await fetch(`${GHDATA_BASE}/v1/checkTransactionStatus?reference=${order.ghdata_ref}`, {
          headers: {
            'Authorization': `Bearer ${GHDATA_TOKEN}`,
            'Accept': 'application/json',
          },
        })
        if (ghRes.ok) {
          const ghData = await ghRes.json()
          liveGhdataStatus = ghData?.data?.status ?? ghData?.status ?? null

          // Map GHData status to our status and update if changed
          const ghdataStatusMap = {
            completed: 'delivered',
            successful: 'delivered',
            success: 'delivered',
            failed: 'failed',
            pending: 'processing',
            processing: 'processing',
            waiting: 'waiting',
          }
          const mappedStatus = ghdataStatusMap[String(liveGhdataStatus).toLowerCase()]

          if (mappedStatus && mappedStatus !== order.status) {
            await supabase.from('orders')
              .update({ status: mappedStatus, ghdata_status: String(liveGhdataStatus).toLowerCase(), updated_at: new Date().toISOString() })
              .eq('id', order.id)

            // If now delivered, trigger profit for reseller via the on_order_delivered trigger
            // (the DB trigger fires automatically on UPDATE to status='delivered')
            order.status = mappedStatus
            order.ghdata_status = String(liveGhdataStatus).toLowerCase()
          }
        }
      } catch (syncErr) {
        // Non-fatal — just return the stored status if GHData live check fails
        console.warn('GHData status sync failed for ref', ref, syncErr.message)
      }
    }

    return res.status(200).json({
      success: true,
      order: {
        ref: order.ref,
        network: order.network,
        package: order.package,
        phone: order.phone,
        amount: order.amount,
        currency: 'GHS',
        status: order.status,
        ghdata_status: order.ghdata_status,
        external_ref: order.ghdata_ref || order.external_id || null,
        delivery_type: order.is_manual ? 'manual' : 'auto',
        created_at: order.created_at,
        updated_at: order.updated_at,
        ...(liveGhdataStatus ? { live_ghdata_status: liveGhdataStatus } : {}),
      },
    })

  } catch (err) {
    const code = err.message.includes('Invalid API token') || err.message.includes('Missing') ? 401 : 500
    return res.status(code).json({ success: false, error: err.message })
  }
}
