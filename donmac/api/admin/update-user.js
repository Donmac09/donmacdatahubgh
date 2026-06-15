export default async function handler(req, res) {
  // Ensure we only handle POST requests
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' })
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
    if (!userId || !action) {
      return res.status(400).json({ error: 'Missing mandatory fields: userId or action' })
    }

    // 5. Fetch target user profile balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single()

    if (fetchError || !profile) {
      return res.status(404).json({ error: 'Target user profile not found' })
    }

    // 6. Process financial logic cleanly
    const currentBalance = Number(profile.balance || 0)
    const numericAmount = Number(amount || 0)
    let newBalance = currentBalance

    if (action === 'credit') {
      newBalance = currentBalance + numericAmount
    } else if (action === 'debit') {
      newBalance = Math.max(0, currentBalance - numericAmount) // Prevent negative balances
    } else if (action === 'block' || action === 'unblock') {
      // Handle account status updating
      const targetStatus = action === 'block' ? 'blocked' : 'active'
      const { error: statusError } = await supabaseAdmin
        .from('profiles')
        .update({ status: targetStatus })
        .eq('id', userId)

      if (statusError) throw statusError
      return res.status(200).json({ message: `User status changed to ${targetStatus} successfully` })
    } else if (action === 'delete') {
      // Optional: Delete user from public profile and auth table
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError
      return res.status(200).json({ message: 'User deleted successfully from auth instance' })
    } else {
      return res.status(400).json({ error: 'Invalid action provided' })
    }

    // 7. Commit new balance back to the database
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId)

    if (updateError) throw updateError

    return res.status(200).json({ 
      message: `Wallet updated successfully`, 
      previousBalance: currentBalance, 
      newBalance 
    })

  } catch (err) {
    console.error('⚠️ Admin endpoint execution error:', err.message)
    return res.status(401).json({ error: err.message || 'Unauthorized transaction context' })
  }
}

// Adjust your helper slightly to expect the raw, cleaned JWT string directly
async function verifyAdmin(cleanJwt) {
  if (!cleanJwt) throw new Error('Missing authentication token string')
  
  const { data, error } = await supabaseAdmin.auth.getUser(cleanJwt)
  if (error || !data?.user) {
    throw new Error('Invalid session validation')
  }

  const { data: p } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (p?.role !== 'admin') {
    throw new Error('Admin access tier required')
  }

  return data.user
}
