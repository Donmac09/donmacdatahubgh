import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // GET request - Fetch balance
  if (req.method === 'GET') {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance, name, role')
        .eq('api_token', token)
        .single()
      
      if (error || !profile) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      return res.status(200).json({ 
        balance: profile.balance, 
        name: profile.name,
        role: profile.role
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST request
  if (req.method === 'POST') {
    try {
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
      
      // Wallet operations
      if (action === 'credit' || action === 'debit') {
        if (!userId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          return res.status(400).json({ error: 'Valid userId and amount required' })
        }
        
        const numericAmount = Number(amount)
        
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
        
        if (action === 'credit') {
          newBalance = currentBalance + numericAmount
          const { error } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', userId)
          updateError = error
        } else {
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
        
        if (updateError) throw updateError
        
        return res.status(200).json({
          success: true,
          message: `Wallet ${action}ed successfully`,
          action: action,
          amount: numericAmount,
          previousBalance: currentBalance,
          newBalance: newBalance
        })
      }
      
      // NEW: Process manual order
      if (action === 'complete_manual_order') {
        const { orderId, status, notes } = req.body
        
        if (!orderId) {
          return res.status(400).json({ error: 'orderId required' })
        }
        
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .update({ 
            status: status || 'completed',
            notes: notes || 'Manual delivery completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select()
          .single()
        
        if (orderError) throw orderError
        
        return res.status(200).json({
          success: true,
          message: 'Order marked as completed',
          order: order
        })
      }
      
      return res.status(400).json({ error: 'Invalid action' })
      
    } catch (err) {
      console.error('Admin action error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
