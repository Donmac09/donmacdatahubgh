// api/ghdata/sync-status.js
// Cron job or manual call to sync GHData status for pending orders

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

const GHDATA_BASE = 'https://ghdataconnect.com/api'
const GHDATA_TOKEN = process.env.GHDATA_API_TOKEN || '144|Upj7FsClobi8bIWLBWozmXOTRUzSDK2DCx0u2vuD3f64701d'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Get pending orders that have ghdata_ref
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, ref, ghdata_ref, status, ghdata_status')
      .eq('status', 'pending')
      .not('ghdata_ref', 'is', null)
      .limit(50)

    if (!orders || orders.length === 0) {
      return res.status(200).json({ success: true, message: 'No pending orders to sync', synced: 0 })
    }

    const results = []

    for (const order of orders) {
      try {
        const response = await fetch(`${GHDATA_BASE}/v1/checkTransactionStatus?reference=${order.ghdata_ref}`, {
          headers: {
            'Authorization': `Bearer ${GHDATA_TOKEN}`,
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          results.push({ ref: order.ref, status: 'error', message: `HTTP ${response.status}` })
          continue
        }

        const data = await response.json()
        const ghdataStatus = data?.data?.status || data?.status || null

        // Map GHData status to our status
        const statusMap = {
          completed: 'completed',
          successful: 'completed',
          success: 'completed',
          delivered: 'delivered',
          failed: 'failed',
          rejected: 'failed',
          pending: 'pending',
          processing: 'processing',
          waiting: 'waiting',
        }

        const mappedStatus = statusMap[String(ghdataStatus).toLowerCase()] || 'pending'

        if (mappedStatus !== order.status) {
          await supabaseAdmin
            .from('orders')
            .update({
              status: mappedStatus,
              ghdata_status: String(ghdataStatus).toLowerCase(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)

          results.push({ 
            ref: order.ref, 
            old_status: order.status, 
            new_status: mappedStatus, 
            ghdata_status: ghdataStatus 
          })
        } else {
          results.push({ ref: order.ref, status: 'unchanged' })
        }

      } catch (error) {
        results.push({ ref: order.ref, status: 'error', message: error.message })
      }
    }

    return res.status(200).json({
      success: true,
      synced: orders.length,
      results: results,
    })

  } catch (error) {
    console.error('Sync error:', error)
    return res.status(500).json({ error: error.message })
  }
}
