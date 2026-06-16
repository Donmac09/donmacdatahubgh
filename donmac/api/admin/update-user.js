import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Log incoming request
    console.log('=== UPDATE USER REQUEST ===')
    console.log('Headers:', req.headers)
    console.log('Body:', req.body)
    
    // Get token
    const authHeader = req.headers.authorization
    console.log('Authorization header:', authHeader)
    
    if (!authHeader) {
      console.log('No authorization header found')
      return res.status(401).json({ 
        error: 'No authorization header',
        details: 'Authorization header is required'
      })
    }
    
    const adminToken = authHeader.replace('Bearer ', '').trim()
    console.log('Token extracted:', adminToken.substring(0, 20) + '...')
    
    if (!adminToken) {
      console.log('Empty token after Bearer removal')
      return res.status(401).json({ 
        error: 'Empty token',
        details: 'Bearer token is empty'
      })
    }
    
    // Get admin user from profiles
    console.log('Looking up admin with token:', adminToken.substring(0, 20) + '...')
    
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role, api_token')
      .eq('api_token', adminToken)
      .single()
    
    console.log('Admin lookup result:', { 
      adminFound: !!admin, 
      adminId: admin?.id,
      adminEmail: admin?.email,
      adminRole: admin?.role,
      adminToken: admin?.api_token?.substring(0, 20) + '...',
      error: adminError
    })
    
    if (adminError) {
      console.error('Admin lookup error:', adminError)
      return res.status(403).json({ 
        error: 'Invalid admin token',
        details: adminError.message,
        code: adminError.code
      })
    }
    
    if (!admin) {
      console.log('No admin found with this token')
      return res.status(403).json({ 
        error: 'Admin access required',
        details: 'No profile found with this API token'
      })
    }
    
    if (admin.role !== 'admin') {
      console.log('User is not admin, role:', admin.role)
      return res.status(403).json({ 
        error: 'Admin access required',
        details: `User role is "${admin.role}", expected "admin"`
      })
    }
    
    console.log('Admin verified successfully:', admin.email)
    
    // Process actions
    const { action, userId } = req.body
    
    if (!action || !userId) {
      return res.status(400).json({ 
        error: 'Missing action or userId',
        details: 'Both action and userId are required'
      })
    }
    
    if (action === 'block' || action === 'unblock') {
      const newStatus = action === 'block' ? 'blocked' : 'active'
      
      console.log(`Updating user ${userId} status to ${newStatus}`)
      
      // Check if user exists
      const { data: targetUser, error: userCheckError } = await supabase
        .from('profiles')
        .select('id, email, status')
        .eq('id', userId)
        .single()
      
      if (userCheckError || !targetUser) {
        return res.status(404).json({ 
          error: 'User not found',
          details: `User with ID ${userId} does not exist`
        })
      }
      
      console.log('Target user found:', targetUser)
      
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId)
        .select()
      
      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `User ${action}ed successfully`,
        status: newStatus,
        user: updatedUser
      })
    }
    
    if (action === 'delete') {
      console.log(`Deleting user ${userId}`)
      
      // Check if user exists
      const { data: targetUser, error: userCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()
      
      if (userCheckError || !targetUser) {
        return res.status(404).json({ 
          error: 'User not found',
          details: `User with ID ${userId} does not exist`
        })
      }
      
      // Delete from auth (requires service role)
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)
      
      if (authDeleteError) {
        console.error('Auth delete error:', authDeleteError)
        throw new Error(`Failed to delete user: ${authDeleteError.message}`)
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'User deleted successfully' 
      })
    }
    
    return res.status(400).json({ 
      error: 'Invalid action',
      details: 'Action must be "block", "unblock", or "delete"'
    })
    
  } catch (error) {
    console.error('Update user error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
