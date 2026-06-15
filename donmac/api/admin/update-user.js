import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req, res) {
  // Ensure we only handle POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1. Grab the auth header from incoming request
    const authHeader = req.headers.authorization
    if (!authHeader) throw new Error('Missing Authorization header')

    // 2. Safely split out "Bearer " to extract the true raw JWT
    const jwt = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7, authHeader.length) 
      : authHeader

    // 3. Authenticate against Supabase
    const adminUser = await verifyAdmin(jwt)
    
    // 4. Extract parameters from your request body
    const { action, userId, amount } = req.body
    
    // Validate required fields
    if (!userId || !action) {
      return res.status(400).json({ error: 'Missing mandatory fields: userId or action' })
    }

    // Validate amount for financial actions
    if ((action === 'credit' || action === 'debit') && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
      return res.status(400).json({ error: 'Valid amount is required for credit/debit operations' })
    }

    // 5. Handle different actions
    if (action === 'block' || action === 'unblock') {
      const targetStatus = action === 'block' ? 'blocked' : 'active'
      const { error: statusError } = await supabaseAdmin
        .from('profiles')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (statusError) throw statusError
      return res.status(200).json({ message: `User status changed to ${targetStatus} successfully` })
    } 
    
    if (action === 'delete') {
      // Delete user from auth and profiles
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (deleteAuthError) throw deleteAuthError
      
      // Also delete from profiles if not automatically deleted by trigger
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)
      
      if (deleteProfileError) console.warn('Profile deletion warning:', deleteProfileError)
      
      return res.status(200).json({ message: 'User deleted successfully' })
    }
    
    if (action === 'credit' || action === 'debit') {
      // Use transaction for balance updates to prevent race conditions
      const numericAmount = Number(amount)
      let newBalance
      let operationError
      
      // For debit, check if sufficient funds exist first
      if (action === 'debit') {
        const { data: profile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select('balance')
          .eq('id', userId)
          .single()
          
        if (fetchError || !profile) {
          return res.status(404).json({ error: 'Target user profile not found' })
        }
        
        if (Number(profile.balance) < numericAmount) {
          return res.status(400).json({ error: 'Insufficient balance for debit operation' })
        }
      }
      
      // Perform the update with atomic operation
      if (action === 'credit') {
        const { data, error } = await supabaseAdmin.rpc('credit_user_balance', {
          user_id: userId,
          credit_amount: numericAmount
        })
        operationError = error
        if (!error) newBalance = data
      } else {
        const { data, error } = await supabaseAdmin.rpc('debit_user_balance', {
          user_id: userId,
          debit_amount: numericAmount
        })
        operationError = error
        if (!error) newBalance = data
      }
      
      if (operationError) throw operationError
      
      // Get final balance for response
      const { data: finalProfile } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single()
      
      return res.status(200).json({ 
        message: `Wallet ${action}ed successfully`, 
        newBalance: finalProfile?.balance || newBalance
      })
    }
    
    return res.status(400).json({ error: 'Invalid action provided' })

  } catch (err) {
    console.error('⚠️ Admin endpoint execution error:', err.message)
    return res.status(401).json({ error: err.message || 'Unauthorized transaction context' })
  }
}

async function verifyAdmin(cleanJwt) {
  if (!cleanJwt) throw new Error('Missing authentication token string')
  
  const { data, error } = await supabaseAdmin.auth.getUser(cleanJwt)
  if (error || !data?.user) {
    throw new Error('Invalid session validation')
  }

  const { data: p, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError || p?.role !== 'admin') {
    throw new Error('Admin access tier required')
  }

  return data.user
}
