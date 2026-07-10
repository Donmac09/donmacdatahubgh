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

  // ============================================================
  // GET: Check balance (authenticated user)
  // ============================================================
  if (req.method === 'GET') {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance, name, role, status')
        .eq('api_token', token)
        .single()
      
      if (error || !profile) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      // Check if user is blocked
      if (profile.status === 'blocked') {
        return res.status(403).json({ error: 'Account blocked' })
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

  // ============================================================
  // POST: Admin actions (requires admin role)
  // ============================================================
  if (req.method === 'POST') {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
      
      // Verify admin
      const { data: admin, error: adminError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('api_token', token)
        .single()
      
      if (adminError || !admin) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      if (admin.status === 'blocked') {
        return res.status(403).json({ error: 'Account blocked' })
      }
      
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const { action, userId, amount } = req.body
      
      // ============================================================
      // Credit / Debit Wallet
      // ============================================================
      if (action === 'credit' || action === 'debit') {
        if (!userId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          return res.status(400).json({ error: 'Valid userId and amount required' })
        }
        
        const numericAmount = Number(amount)
        
        // Check if target user exists
        const { data: user, error: userError } = await supabase
          .from('profiles')
          .select('balance, name, email')
          .eq('id', userId)
          .single()
        
        if (userError || !user) {
          return res.status(404).json({ error: 'User not found' })
        }
        
        const currentBalance = user.balance || 0
        let newBalance
        
        if (action === 'credit') {
          newBalance = currentBalance + numericAmount
          const { error } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', userId)
          if (error) throw error
        } else {
          if (currentBalance < numericAmount) {
            return res.status(400).json({ error: 'Insufficient balance' })
          }
          newBalance = currentBalance - numericAmount
          const { error } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', userId)
          if (error) throw error
        }
        
        // Record transaction
        await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            type: action,
            description: `Admin ${action}: ${action === 'credit' ? 'added' : 'deducted'} ₵${numericAmount}`,
            amount: numericAmount,
            status: 'success'
          })
        
        return res.status(200).json({
          success: true,
          message: `Wallet ${action}ed successfully`,
          action: action,
          amount: numericAmount,
          previousBalance: currentBalance,
          newBalance: newBalance
        })
      }
      
      // ============================================================
      // Complete Manual Order
      // ============================================================
      if (action === 'complete_manual_order') {
        const { orderId, status, notes } = req.body
        
        if (!orderId) {
          return res.status(400).json({ error: 'orderId required' })
        }
        
        // Check if order exists
        const { data: existingOrder, error: checkError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .single()
        
        if (checkError || !existingOrder) {
          return res.status(404).json({ error: 'Order not found' })
        }
        
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .update({ 
            status: status || 'completed',
            notes: notes || 'Manual delivery completed by admin',
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
