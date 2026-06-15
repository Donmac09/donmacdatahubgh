import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify admin
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('role')
      .eq('api_token', token)
      .single()
    
    if (adminError || !admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { action, userId, amount } = req.body
    
    if (!userId || !action) {
      return res.status(400).json({ error: 'Missing userId or action' })
    }
    
    if (!['credit', 'debit'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "credit" or "debit"' })
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount required' })
    }
    
    const numericAmount = Number(amount)
    
    // Get current balance
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
    
    if (action === 'credit') {
      newBalance = currentBalance + numericAmount
    } else {
      if (currentBalance < numericAmount) {
        return res.status(400).json({ error: 'Insufficient balance' })
      }
      newBalance = currentBalance - numericAmount
    }
    
    // Update balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId)
    
    if (updateError) throw updateError
    
    return res.status(200).json({
      success: true,
      message: `Wallet ${action}ed successfully`,
      action,
      amount: numericAmount,
      previousBalance: currentBalance,
      newBalance
    })
    
  } catch (err) {
    console.error('Admin wallet error:', err)
    return res.status(500).json({ error: err.message })
  }
}
