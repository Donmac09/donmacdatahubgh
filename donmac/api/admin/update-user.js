// Vercel Serverless: POST /api/admin/update-user
// Handles: credit, debit, block/unblock, delete — all require admin
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function verifyAdmin(jwt) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !user) throw new Error('Invalid session')
  const { data: p } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') throw new Error('Admin access required')
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim()
    await verifyAdmin(jwt)

    const { action, userId, amount, status } = req.body || {}
    if (!action || !userId) return res.status(400).json({ error: 'action and userId required' })

    if (action === 'credit' || action === 'debit') {
      const amt = parseFloat(amount)
      if (!amt || amt <= 0) return res.status(400).json({ error: 'Valid amount required' })

      // Get current balance
      const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('id', userId).single()
      if (!profile) return res.status(404).json({ error: 'User not found' })

      const newBalance = action === 'credit'
        ? (profile.balance || 0) + amt
        : Math.max(0, (profile.balance || 0) - amt)

      await supabaseAdmin.from('profiles').update({ balance: newBalance }).eq('id', userId)
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: action === 'credit' ? 'credit' : 'debit',
        description: `Admin ${action} of ₵${amt.toFixed(2)}`,
        amount: amt,
        status: 'success',
      })
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: action === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
        message: `Admin has ${action === 'credit' ? 'added' : 'deducted'} ₵${amt.toFixed(2)} ${action === 'credit' ? 'to' : 'from'} your wallet.`,
        type: 'transaction',
      })
      return res.status(200).json({ success: true, newBalance })
    }

    if (action === 'block' || action === 'unblock') {
      const newStatus = action === 'block' ? 'blocked' : 'active'
      await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('id', userId)
      return res.status(200).json({ success: true, status: newStatus })
    }

    if (action === 'delete') {
      // Delete auth user (cascades to profile via FK)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) {
        // If no auth user (manually inserted profile), just delete the profile
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
      }
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (err) {
    console.error('update-user error:', err)
    return res.status(err.message.includes('Admin') ? 403 : 500).json({ error: err.message })
  }
}
