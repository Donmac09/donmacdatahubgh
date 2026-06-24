// GET /api — returns the full API documentation as JSON
// External developers can also visit this in their browser

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const base = req.headers.host
    ? `https://${req.headers.host}`
    : 'https://donmacdatahubgh.com'

  return res.status(200).json({
    name: 'Donmac Data Hub — External API',
    version: '1.0',
    base_url: `${base}/api/v1`,
    description: 'Place data bundle orders programmatically. Orders go to GHData for instant delivery (MTN/Telecel/AirtelTigo) or are fulfilled manually by admin (MTN Mashup).',

    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <your_api_token>',
      how_to_get: 'Log in to donmacdatahubgh.com → Profile → API Token → Generate Token',
    },

    endpoints: {
      'GET /api/v1/wallet': {
        description: 'Get your wallet balance',
        auth: true,
        example_request: `curl -H "Authorization: Bearer YOUR_TOKEN" ${base}/api/v1/wallet`,
        example_response: {
          success: true,
          wallet: { balance: '150.00', currency: 'GHS', name: 'John Doe', role: 'customer' },
        },
      },

      'GET /api/v1/packages': {
        description: 'List all available packages with current prices. No auth required.',
        auth: false,
        example_request: `curl ${base}/api/v1/packages`,
        example_response: {
          success: true,
          packages: {
            mtn: {
              label: 'MTN Data',
              network: 'MTN',
              validity: '90 days',
              delivery: 'auto',
              online: true,
              items: [
                { id: 'mtn5', data: '5GB', price: 20.50, currency: 'GHS', online: true },
              ],
            },
          },
          note: 'delivery:"auto" = instantly via GHData. delivery:"manual" = fulfilled by admin.',
        },
      },

      'POST /api/v1/orders': {
        description: 'Place a data bundle order. Wallet is debited immediately. Auto-delivery packages are sent to GHData instantly.',
        auth: true,
        request_body: {
          network: 'string — e.g. "MTN", "Telecel", "AirtelTigo Premium", "AirtelTigo Big Time"',
          package: 'string — e.g. "5GB", "10GB", "20GB"',
          phone: 'string — recipient phone number e.g. "0241234567"',
        },
        example_request: `curl -X POST ${base}/api/v1/orders \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"network":"MTN","package":"5GB","phone":"0241234567"}'`,
        example_response_success: {
          success: true,
          order: {
            ref: 'ABC123',
            network: 'MTN',
            package: '5GB',
            phone: '0241234567',
            amount: 20.50,
            currency: 'GHS',
            status: 'processing',
            ghdata_status: 'dispatched',
            delivery_type: 'auto',
            external_ref: 'GHD-REF-XYZ',
            created_at: '2024-01-01T12:00:00Z',
          },
        },
        example_response_manual: {
          success: true,
          order: { ref: 'DEF456', status: 'pending', delivery_type: 'manual' },
          note: 'This package requires manual delivery by admin.',
        },
        example_response_failure: {
          success: false,
          order: { ref: 'GHI789', status: 'failed' },
          warning: 'Order was placed but GHData dispatch failed. Your wallet has been refunded.',
        },
      },

      'GET /api/v1/orders': {
        description: 'List all your orders, newest first',
        auth: true,
        example_request: `curl -H "Authorization: Bearer YOUR_TOKEN" ${base}/api/v1/orders`,
        query_params: { ref: 'optional — filter by a single order ref (e.g. ?ref=ABC123)' },
        example_response: {
          success: true,
          orders: [
            {
              id: 'uuid', ref: 'ABC123', network: 'MTN', package: '5GB',
              phone: '0241234567', amount: 20.50, status: 'delivered',
              ghdata_status: 'completed', is_manual: false,
              external_id: 'GHD-REF-XYZ', created_at: '2024-01-01T12:00:00Z',
            },
          ],
        },
      },

      'GET /api/v1/status?ref=ABC123': {
        description: 'Check the live delivery status of a specific order. For auto-delivery orders, this syncs the latest status from GHData in real time.',
        auth: true,
        example_request: `curl -H "Authorization: Bearer YOUR_TOKEN" "${base}/api/v1/status?ref=ABC123"`,
        example_response: {
          success: true,
          order: {
            ref: 'ABC123',
            network: 'MTN', package: '5GB', phone: '0241234567',
            amount: 20.50, currency: 'GHS',
            status: 'delivered',
            ghdata_status: 'completed',
            external_ref: 'GHD-REF-XYZ',
            delivery_type: 'auto',
            live_ghdata_status: 'completed',
            created_at: '2024-01-01T12:00:00Z',
            updated_at: '2024-01-01T12:01:00Z',
          },
        },
      },

      'POST /api/webhook': {
        description: 'SMS webhook — forward MoMo payment SMS here to auto-credit user wallets. Used by SMS Forwarder apps on the admin phone.',
        auth: false,
        note: 'Configure your SMS Forwarder app to POST to this URL',
        request_body: { message: 'The full raw SMS text from the MoMo notification' },
        example_request: `curl -X POST ${base}/api/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"message":"You have received GHS 50.00 from 0241234567. Reference: ABC123"}'`,
        example_response_matched: {
          success: true, user_id: 'uuid', amount: 50, ref: 'ABC123',
        },
        example_response_unmatched: {
          success: false,
          message: 'No matching reservation found — saved as unclaimed for manual review',
        },
      },
    },

    order_statuses: {
      pending: 'Order placed, awaiting manual fulfilment by admin',
      processing: 'Sent to GHData, delivery in progress',
      waiting: 'GHData received the order, waiting to process',
      delivered: 'Data bundle successfully delivered to the recipient',
      failed: 'Delivery failed — wallet was automatically refunded',
    },

    delivery_types: {
      auto: 'MTN Data, Telecel, AirtelTigo Premium, AirtelTigo Big Time — delivered instantly via GHData',
      manual: 'MTN Mashup Data, MTN Mashup Minutes+Data — fulfilled manually by admin',
    },

    errors: {
      401: 'Invalid or missing API token',
      400: 'Bad request — check error message for details',
      404: 'Order not found',
      500: 'Server error',
    },

    support: {
      whatsapp: '+233549358359',
      platform: base,
    },
  })
}
