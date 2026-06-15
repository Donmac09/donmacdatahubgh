import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // GET request - Fetch balance (existing functionality)
  if (req.method === 'GET') {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance, name')
        .eq('api_token', token)
        .single()
      
      if (error || !profile) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      return res.status(200).json({ 
        balance: profile.balance, 
        name: profile.name 
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST request - Credit/Debit operations (NEW functionality)
  if (req.method === 'POST') {
    try {
      // Verify admin using API token
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
      
      // Check if the requester is an admin
      const { data: admin, error: adminError } = await supabase
        .from('profiles')
        .select('role')
        .eq('api_token', token)
        .single()
      
      if (adminError || !admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      // Get action details
      const { action, userId, amount } = req.body
      
      // Validate required fields
      if (!userId || !action) {
        return res.status(400).json({ error: 'Missing userId or action' })
      }
      
      // Validate action type
      if (!['credit', 'debit'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "credit" or "debit"' })
      }
      
      // Validate amount
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' })
      }
      
      const numericAmount = Number(amount)
      
      // Get current user balance
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single()
      
      if (userError || !user) {
        return res.status(404).json({ error: 'User not found' })
      }
      
      const currentBalance = user.balance || 0
      let newBalance
      let updateError
      
      // Process credit or debit
      if (action === 'credit') {
        newBalance = currentBalance + numericAmount
        const { error } = await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', userId)
        updateError = error
      } else { // debit
        if (currentBalance < numericAmount) {
          return res.status(400).json({ error: 'Insufficient balance' })
        }
        newBalance = currentBalance - numericAmount
        const { error } = await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', userId)
        updateError = error
      }
      
      if (updateError) {
        throw updateError
      }
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: `Wallet ${action}ed successfully`,
        action: action,
        amount: numericAmount,
        previousBalance: currentBalance,
        newBalance: newBalance
      })
      
    } catch (err) {
      console.error('Admin action error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' })
}
