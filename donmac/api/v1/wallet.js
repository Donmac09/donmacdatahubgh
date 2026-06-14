import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*')
  if(req.method==='OPTIONS')return res.status(200).end()
  try{const t=(req.headers.authorization||'').replace('Bearer ','').trim();const{data:p}=await supabase.from('profiles').select('balance,name').eq('api_token',t).single();if(!p)return res.status(401).json({error:'Invalid token'});return res.status(200).json({balance:p.balance,name:p.name})}
  catch(e){return res.status(500).json({error:e.message})}
}
