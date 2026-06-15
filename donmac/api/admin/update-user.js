// Vercel Serverless: POST /api/admin/update-user
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function verifyAdmin(jwt) {
  if (!jwt) throw new Error('Missing authentication token')

  // Safe destructuring: capture the raw payload response first
  const { data, error } = await supabaseAdmin.auth.getUser(jwt)
  
  if (error || !data || !data.user) {
    throw new Error('Invalid session')
  }

  const { data: p, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError || p?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return data.user
}

export default async function handler(req, res) {
  // CORS configuration
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

    // --- Action: Wallet Transactions ---
    if (action === 'credit' || action === 'debit') {
      const amt = parseFloat(amount)
      if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Valid positive amount required' })

      // Get current balance
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single()
        
      if (fetchError || !profile) return res.status(404).json({ error: 'User profile not found' })

      const currentBalance = profile.balance || 0
      const newBalance = action === 'credit' 
        ? currentBalance + amt 
        : Math.max(0, currentBalance - amt)

      // Step 1: Update user wallet balance safely
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId)

      if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`)

      // Step 2: Write transaction trail ledger
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: action,
        description: `Admin ${action} of ₵${amt.toFixed(2)}`,
        amount: amt,
        status: 'success',
      })

      // Step 3: Write notification banner
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: action === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
        message: `Admin has ${action === 'credit' ? 'added' : 'deducted'} ₵${amt.toFixed(2)} ${action === 'credit' ? 'to' : 'from'} your wallet.`,
        type: 'transaction',
      })

      return res.status(200).json({ success: true, newBalance })
    }

    // --- Action: Account Suspension Modifiers ---
    if (action === 'block' || action === 'unblock') {
      const newStatus = action === 'block' ? 'blocked' : 'active'
      
      const { error: statusError } = await supabaseAdmin
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId)

      if (statusError) throw new Error(`Status update failed: ${statusError.message}`)
      return res.status(200).json({ success: true, status: newStatus })
    }

    // --- Action: Complete Account Erasure ---
    if (action === 'delete') {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      
      if (authDeleteError) {
        // Fallback: If no auth layer user mapping, wipe profile record directly
        const { error: profileDeleteError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)
          
        if (profileDeleteError) throw new Error(`Total deletion trace failed: ${profileDeleteError.message}`)
      }
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action target' })

  } catch (err) {
    console.error('update-user backend error event:', err.message)
    
    // Determine context category for semantic error code generation
    const isAuthError = err.message.includes('session') || err.message.includes('token')
    const isAdminError = err.message.includes('Admin')

    if (isAuthError) return res.status(401).json({ error: err.message })
    if (isAdminError) return res.status(403).json({ error: err.message })
    
    return res.status(500).json({ error: err.message || 'Internal Operations Failure' })
  }
}
