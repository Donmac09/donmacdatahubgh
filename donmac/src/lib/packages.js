// All packages data — single source of truth
export const PACKAGES = {
  mtn_mashup: {
    label: 'MTN Mashup Data',
    network: 'MTN',
    networkKey: 'mtn',
    validity: 'Non-expiry',
    ghdata_type: 'mtn-ishare',
    color: '#FFCC00', 
    textColor: '#000000', 
    bgColor: 'rgba(255, 204, 0, 0.1)',
    borderColor: 'rgba(255, 204, 0, 0.3)',
    gradientFrom: '#FFCC00', 
    gradientTo: '#E6B800',
    items: [
      { id: 'mm1', data: '1.7GB', price: 6 },
      { id: 'mm2', data: '3.4GB', price: 12 },
      { id: 'mm3', data: '5.1GB', price: 18 },
      { id: 'mm4', data: '6.8GB', price: 24 },
      { id: 'mm5', data: '8.5GB', price: 30 },
      { id: 'mm6', data: '10.2GB', price: 36 },
      { id: 'mm7', data: '15.3GB', price: 50 },
      { id: 'mm8', data: '20.4GB', price: 68 },
    ],
  },
  mtn_mashup_min: {
    label: 'MTN Mashup Minutes + Data',
    network: 'MTN',
    networkKey: 'mtn',
    validity: 'Non-expiry',
    ghdata_type: 'mtn-ishare',
    color: '#FFCC00', 
    textColor: '#000000', 
    bgColor: 'rgba(255, 204, 0, 0.1)',
    borderColor: 'rgba(255, 204, 0, 0.3)',
    gradientFrom: '#FFCC00', 
    gradientTo: '#D4A400',
    items: [
      { id: 'mmm1', data: '350mins + 870MB', price: 20 },
      { id: 'mmm2', data: '700mins + 1.6GB', price: 30 },
      { id: 'mmm3', data: '1000mins + 2.6GB', price: 40 },
      { id: 'mmm4', data: '1400mins + 3.5GB', price: 50 },
    ],
  },
  mtn: {
    label: 'MTN Data',
    network: 'MTN',
    networkKey: 'mtn',
    validity: '90 days',
    ghdata_type: 'mtn',
    color: '#FFCC00', 
    textColor: '#000000', 
    bgColor: 'rgba(255, 204, 0, 0.1)',
    borderColor: 'rgba(255, 204, 0, 0.3)',
    gradientFrom: '#FFCC00', 
    gradientTo: '#E6B800',
    items: [
      { id: 'mtn1', data: '1GB', price: 4.00 },
      { id: 'mtn2', data: '2GB', price: 8.00 },
      { id: 'mtn3', data: '3GB', price: 12.00 },
      { id: 'mtn4', data: '4GB', price: 16.00 },
      { id: 'mtn5', data: '5GB', price: 20.00 },
      { id: 'mtn6', data: '6GB', price: 24.00 },
      { id: 'mtn7', data: '7GB', price: 28.00 },
      { id: 'mtn8', data: '8GB', price: 32.00 },
      { id: 'mtn9', data: '10GB', price: 40 },
      { id: 'mtn10', data: '15GB', price: 60 },
      { id: 'mtn11', data: '20GB', price: 80 },
      { id: 'mtn12', data: '25GB', price: 100 },
      { id: 'mtn13', data: '30GB', price: 120 },
      { id: 'mtn14', data: '40GB', price: 160 },
      { id: 'mtn15', data: '50GB', price: 200 },
    ],
  },
  telecel: {
    label: 'Telecel Data',
    network: 'Telecel',
    networkKey: 'telecel',
    validity: '60 days',
    ghdata_type: 'telecel',
    color: '#E60000', 
    textColor: '#ffffff', 
    bgColor: 'rgba(230, 0, 0, 0.1)',
    borderColor: 'rgba(230, 0, 0, 0.2)',
    gradientFrom: '#E60000', 
    gradientTo: '#B30000',
    items: [
      { id: 'tel1', data: '2GB', price: 9.50 },
      { id: 'tel2', data: '3GB', price: 14.20 },
      { id: 'tel3', data: '5GB', price: 21.20 },
      { id: 'tel4', data: '10GB', price: 40 },
      { id: 'tel5', data: '15GB', price: 59 },
      { id: 'tel6', textData: '20GB', price: 79 },
      { id: 'tel7', data: '25GB', price: 97 },
      { id: 'tel8', data: '30GB', price: 116 },
      { id: 'tel9', data: '40GB', price: 154 },
      { id: 'tel10', data: '50GB', price: 189 },
    ],
  },
  airtel_premium: {
    label: 'AirtelTigo Premium',
    network: 'AirtelTigo',
    networkKey: 'airtel',
    validity: '60 days',
    ghdata_type: 'atishare',
    color: '#005A9C', 
    textColor: '#ffffff', 
    bgColor: 'rgba(0, 90, 156, 0.1)',
    borderColor: 'rgba(0, 90, 156, 0.2)',
    gradientFrom: '#005A9C', 
    gradientTo: '#E21225',
    items: [
      { id: 'ap1', data: '1GB', price: 4 },
      { id: 'ap2', data: '2GB', price: 8 },
      { id: 'ap3', data: '3GB', price: 12.10 },
      { id: 'ap4', data: '4GB', price: 16.10 },
      { id: 'ap5', data: '5GB', price: 20.10 },
      { id: 'ap6', data: '6GB', price: 24.10 },
      { id: 'ap7', data: '7GB', price: 28.10 },
      { id: 'ap8', data: '8GB', price: 32.10 },
      { id: 'ap9', data: '10GB', price: 40 },
      { id: 'ap10', data: '12GB', price: 48.10 },
      { id: 'ap11', data: '15GB', price: 60.20 },
      { id: 'ap12', data: '20GB', price: 80.30 },
      { id: 'ap13', data: '25GB', price: 100.30 },
      { id: 'ap14', data: '30GB', price: 120.40 },
    ],
  },
  airtel_bigtime: {
    label: 'AirtelTigo Big Time',
    network: 'AirtelTigo',
    networkKey: 'airtel',
    validity: 'Non-expiry',
    ghdata_type: 'atbigtime',
    color: '#005A9C', 
    textColor: '#ffffff', 
    bgColor: 'rgba(0, 90, 156, 0.1)',
    borderColor: 'rgba(0, 90, 156, 0.2)',
    gradientFrom: '#005A9C', 
    gradientTo: '#E21225',
    items: [
      { id: 'ab1', data: '15GB', price: 57 },
      { id: 'ab2', data: '20GB', price: 63 },
      { id: 'ab3', data: '30GB', price: 74 },
      { id: 'ab4', data: '40GB', price: 85 },
      { id: 'ab5', data: '50GB', price: 94 },
      { id: 'ab6', data: '60GB', price: 105 },
      { id: 'ab7', data: '70GB', price: 137 },
      { id: 'ab8', data: '80GB', price: 151 },
      { id: 'ab9', data: '90GB', price: 162 },
      { id: 'ab10', data: '100GB', price: 176 },
      { id: 'ab11', data: '130GB', price: 220 },
      { id: 'ab12', data: '140GB', price: 245 },
      { id: 'ab13', data: '150GB', price: 273 },
      { id: 'ab14', data: '200GB', price: 367 },
    ],
  },
};

export const PKG_GROUPS = Object.keys(PACKAGES);

export function getItemById(itemId) {
  for (const [groupKey, group] of Object.entries(PACKAGES)) {
    const item = group.items.find(i => i.id === itemId);
    if (item) return { ...item, groupKey, group };
  }
  return null;
}

export function getPriceForUser(itemId, resellerPrices) {
  if (!resellerPrices || !resellerPrices[itemId]) {
    const found = getItemById(itemId);
    return found ? found.price : 0;
  }
  return resellerPrices[itemId];
}

export const GHDATA_TOKEN = '144|Upj7FsClobi8bIWLBWozmXOTRUzSDK2DCx0u2vuD3f64701d';
export const GHDATA_BASE = 'https://ghdataconnect.com/api';

export async function placeGHDataOrder({ network, phone, dataAmount, token = GHDATA_TOKEN }) {
  const response = await fetch(`${GHDATA_BASE}/v1/purchaseBundle`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ network, phone, amount: dataAmount, bypass: false, 'sim-type': 'Noraml SIM' })
  });
  const data = await response.json();
  return data;
}
if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHData API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data;
}

// For iShare bundles (MTN Mashup)
export async function placeIshareOrder({ network, phone, dataAmount, token = GHDATA_TOKEN }) {
  const response = await fetch(`${GHDATA_BASE}/v1/createIshareBundleOrder`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      network: network, 
      phone: phone, 
      amount: dataAmount // Amount in MB
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`iShare API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data;
}

// Get wallet balance
export async function getGHDataWalletBalance(token = GHDATA_TOKEN) {
  const response = await fetch(`${GHDATA_BASE}/v1/getWalletBalance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get wallet balance: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Check transaction status
export async function checkGHDataOrderStatus(reference, token = GHDATA_TOKEN) {
  const response = await fetch(`${GHDATA_BASE}/v1/checkOrderStatus/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to check order status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}
