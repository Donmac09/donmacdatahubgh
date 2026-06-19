// Vercel Serverless: POST /api/admin/update-user
// Handles: credit, debit, block/unblock, delete — admin only
// Uses service role key to bypass RLS

import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses ALL RLS policies
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function verifyAdmin(jwt) {
  if (!jwt) throw new Error('Missing authorization token')
  
  // Verify the JWT and get the user
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !user) throw new Error('Invalid or expired session. Please log in again.')

  // Check if admin by email OR by role in profiles
  const ADMIN_EMAIL = 'donmacdatahub@gmail.com'
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === ADMIN_EMAIL || profile?.role === 'admin'
  if (!isAdmin) throw new Error('Admin access required')
  
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Check service role key is configured
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ 
      error: 'SUPABASE_SERVICE_ROLE_KEY is not set in Vercel environment variables. Go to Vercel → Project Settings → Environment Variables and add it.' 
    })
  }

  try {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim()
    await verifyAdmin(jwt)

    const { action, userId, amount } = req.body || {}
    if (!action || !userId) {
      return res.status(400).json({ error: 'action and userId are required' })
    }

    // ── CREDIT or DEBIT ─────────────────────────────────────────
    if (action === 'credit' || action === 'debit') {
      const amt = parseFloat(amount)
      if (!amt || isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: 'A valid amount greater than 0 is required' })
      }

      // Get current balance using service role (bypasses RLS)
      const { data: profile, error: fetchErr } = await supabaseAdmin
        .from('profiles')
        .select('id, name, balance')
        .eq('id', userId)
        .single()

      if (fetchErr || !profile) {
        return res.status(404).json({ error: 'User not found: ' + (fetchErr?.message || '') })
      }

      const currentBalance = parseFloat(profile.balance) || 0
      const newBalance = action === 'credit'
        ? currentBalance + amt
        : Math.max(0, currentBalance - amt)

      // Update balance — service role bypasses RLS
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId)

      if (updateErr) {
        return res.status(500).json({ error: 'Failed to update balance: ' + updateErr.message })
      }

      // Insert transaction record
      const { error: txErr } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          type: action === 'credit' ? 'credit' : 'debit',
          description: `Admin ${action} of ₵${amt.toFixed(2)}`,
          amount: amt,
          status: 'success',
        })

      if (txErr) console.warn('Transaction insert warning:', txErr.message)

      // Insert notification
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: action === 'credit' ? '💰 Wallet Credited' : '💸 Wallet Debited',
        message: `Admin has ${action === 'credit' ? 'added' : 'deducted'} ₵${amt.toFixed(2)} ${action === 'credit' ? 'to' : 'from'} your wallet. New balance: ₵${newBalance.toFixed(2)}`,
        type: 'transaction',
      })

      return res.status(200).json({ 
        success: true, 
        newBalance,
        message: `Successfully ${action}ed ₵${amt.toFixed(2)}. New balance: ₵${newBalance.toFixed(2)}`
      })
    }

    // ── BLOCK / UNBLOCK ──────────────────────────────────────────
    if (action === 'block' || action === 'unblock') {
      const newStatus = action === 'block' ? 'blocked' : 'active'
      
      const { error: blockErr } = await supabaseAdmin
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId)

      if (blockErr) {
        return res.status(500).json({ error: 'Failed to update status: ' + blockErr.message })
      }

      return res.status(200).json({ success: true, status: newStatus })
    }

    // ── DELETE ───────────────────────────────────────────────────
    if (action === 'delete') {
      // Try to delete auth user first (this cascades to profile)
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
      
      if (authDelErr) {
        // If auth user doesn't exist, just delete the profile directly
        const { error: profileDelErr } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)
        
        if (profileDelErr) {
          return res.status(500).json({ error: 'Failed to delete user: ' + profileDelErr.message })
        }
      }

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: `Unknown action: "${action}"` })

  } catch (err) {
    console.error('update-user error:', err.message)
    const status = err.message.includes('Admin') ? 403 : err.message.includes('session') ? 401 : 500
    return res.status(status).json({ error: err.message })
  }
}
