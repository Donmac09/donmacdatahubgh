// External API: GET /api/v1/packages
// Returns all available packages with current prices (admin DB prices take precedence)
// No authentication required — public endpoint so external sites can display packages

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CATALOG = {
  mtn_mashup: {
    label: 'MTN Mashup Data', network: 'MTN', validity: 'Non-expiry', delivery: 'manual',
    items: [
      { id: 'mm1', data: '1.7GB', default_price: 6 },
      { id: 'mm2', data: '3.4GB', default_price: 12 },
      { id: 'mm3', data: '5.1GB', default_price: 18 },
      { id: 'mm4', data: '6.8GB', default_price: 24 },
      { id: 'mm5', data: '8.5GB', default_price: 30 },
      { id: 'mm6', data: '10.2GB', default_price: 36 },
      { id: 'mm7', data: '15.3GB', default_price: 54 },
      { id: 'mm8', data: '20.4GB', default_price: 72 },
    ],
  },
  mtn_mashup_min: {
    label: 'MTN Mashup Minutes + Data', network: 'MTN', validity: 'Non-expiry', delivery: 'manual',
    items: [
      { id: 'mmm1', data: '350mins + 870MB', default_price: 20 },
      { id: 'mmm2', data: '700mins + 1.6GB', default_price: 30 },
      { id: 'mmm3', data: '1000mins + 2.6GB', default_price: 40 },
      { id: 'mmm4', data: '1400mins + 3.5GB', default_price: 50 },
    ],
  },
  mtn: {
    label: 'MTN Data', network: 'MTN', validity: '90 days', delivery: 'auto',
    items: [
      { id: 'mtn1', data: '1GB', default_price: 4.10 },
      { id: 'mtn2', data: '2GB', default_price: 8.20 },
      { id: 'mtn3', data: '3GB', default_price: 12.30 },
      { id: 'mtn4', data: '4GB', default_price: 16.40 },
      { id: 'mtn5', data: '5GB', default_price: 20.50 },
      { id: 'mtn6', data: '6GB', default_price: 24.60 },
      { id: 'mtn7', data: '7GB', default_price: 28.70 },
      { id: 'mtn8', data: '8GB', default_price: 32.80 },
      { id: 'mtn9', data: '10GB', default_price: 41 },
      { id: 'mtn10', data: '15GB', default_price: 61.50 },
      { id: 'mtn11', data: '20GB', default_price: 82 },
      { id: 'mtn12', data: '25GB', default_price: 102.50 },
      { id: 'mtn13', data: '30GB', default_price: 123 },
      { id: 'mtn14', data: '40GB', default_price: 164 },
      { id: 'mtn15', data: '50GB', default_price: 200 },
    ],
  },
  telecel: {
    label: 'Telecel Data', network: 'Telecel', validity: '60 days', delivery: 'auto',
    items: [
      { id: 'tel1', data: '2GB', default_price: 9.50 },
      { id: 'tel2', data: '3GB', default_price: 14.20 },
      { id: 'tel3', data: '5GB', default_price: 21.20 },
      { id: 'tel4', data: '10GB', default_price: 40 },
      { id: 'tel5', data: '15GB', default_price: 59 },
      { id: 'tel6', data: '20GB', default_price: 79 },
      { id: 'tel7', data: '25GB', default_price: 97 },
      { id: 'tel8', data: '30GB', default_price: 116 },
      { id: 'tel9', data: '40GB', default_price: 154 },
      { id: 'tel10', data: '50GB', default_price: 189 },
    ],
  },
  airtel_premium: {
    label: 'AirtelTigo Premium', network: 'AirtelTigo', validity: '60 days', delivery: 'auto',
    items: [
      { id: 'ap1', data: '1GB', default_price: 4 },
      { id: 'ap2', data: '2GB', default_price: 8 },
      { id: 'ap3', data: '3GB', default_price: 12.10 },
      { id: 'ap4', data: '4GB', default_price: 16.10 },
      { id: 'ap5', data: '5GB', default_price: 20.10 },
      { id: 'ap6', data: '6GB', default_price: 24.10 },
      { id: 'ap7', data: '7GB', default_price: 28.10 },
      { id: 'ap8', data: '8GB', default_price: 32.10 },
      { id: 'ap9', data: '10GB', default_price: 40 },
      { id: 'ap10', data: '12GB', default_price: 48.10 },
      { id: 'ap11', data: '15GB', default_price: 60.20 },
      { id: 'ap12', data: '20GB', default_price: 80.30 },
      { id: 'ap13', data: '25GB', default_price: 100.30 },
      { id: 'ap14', data: '30GB', default_price: 120.40 },
    ],
  },
  airtel_bigtime: {
    label: 'AirtelTigo Big Time', network: 'AirtelTigo', validity: 'Non-expiry', delivery: 'auto',
    items: [
      { id: 'ab1', data: '15GB', default_price: 57 },
      { id: 'ab2', data: '20GB', default_price: 63 },
      { id: 'ab3', data: '30GB', default_price: 74 },
      { id: 'ab4', data: '40GB', default_price: 85 },
      { id: 'ab5', data: '50GB', default_price: 94 },
      { id: 'ab6', data: '60GB', default_price: 105 },
      { id: 'ab7', data: '70GB', default_price: 137 },
      { id: 'ab8', data: '80GB', default_price: 151 },
      { id: 'ab9', data: '90GB', default_price: 162 },
      { id: 'ab10', data: '100GB', default_price: 176 },
      { id: 'ab11', data: '130GB', default_price: 220 },
      { id: 'ab12', data: '140GB', default_price: 245 },
      { id: 'ab13', data: '150GB', default_price: 273 },
      { id: 'ab14', data: '200GB', default_price: 367 },
    ],
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Fetch all admin-configured prices and visibility settings from DB
    const { data: configs } = await supabase
      .from('packages_config')
      .select('package_group, package_key, selling_price, visible, online, group_visible, group_online')

    // Build a lookup map: "groupKey__itemId" -> config row
    const cfgMap = {}
    for (const c of configs || []) {
      cfgMap[c.package_group + '__' + c.package_key] = c
    }

    const result = {}

    for (const [groupKey, group] of Object.entries(CATALOG)) {
      const groupCfg = cfgMap[groupKey + '____group__'] || {}

      // Skip hidden groups
      if (groupCfg.group_visible === false) continue

      const groupOnline = groupCfg.group_online !== false

      const items = []
      for (const item of group.items) {
        const itemCfg = cfgMap[groupKey + '__' + item.id] || {}
        if (itemCfg.visible === false) continue

        const price = itemCfg.selling_price ?? item.default_price
        const online = itemCfg.online !== false && groupOnline

        items.push({
          id: item.id,
          data: item.data,
          price: parseFloat(price.toFixed(2)),
          currency: 'GHS',
          online,
        })
      }

      if (items.length === 0) continue

      result[groupKey] = {
        label: group.label,
        network: group.network,
        validity: group.validity,
        delivery: group.delivery,
        online: groupOnline,
        items,
      }
    }

    return res.status(200).json({
      success: true,
      packages: result,
      note: 'delivery:"auto" = instantly delivered via GHData. delivery:"manual" = fulfilled by admin (may take longer).',
    })

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}
