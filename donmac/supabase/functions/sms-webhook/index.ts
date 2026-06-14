// Supabase Edge Function: SMS Webhook
// Deploy: supabase functions deploy sms-webhook
// URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/sms-webhook
// This receives forwarded SMS messages and auto-credits wallets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let rawSms = "";
    let transactionId: string | null = null;
    let amount: number | null = null;
    let network: string | null = null;
    let referenceCode: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      // Support multiple SMS forwarder formats
      rawSms = body.message || body.sms || body.text || body.body || JSON.stringify(body);
      transactionId = body.transaction_id || body.txid || null;
      amount = body.amount ? parseFloat(body.amount) : null;
      network = body.network || body.sender || null;
      referenceCode = body.reference || body.ref || null;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      rawSms = params.get("message") || params.get("sms") || params.get("text") || params.get("body") || text;
      transactionId = params.get("transaction_id") || params.get("txid");
      amount = params.get("amount") ? parseFloat(params.get("amount")!) : null;
      network = params.get("network") || params.get("sender");
      referenceCode = params.get("reference") || params.get("ref");
    } else {
      rawSms = await req.text();
    }

    // Parse SMS text for Ghanaian MoMo patterns
    // Example MTN: "You have received GHS 50.00 from 0549358359 on your Mobile Money wallet. Your new balance is GHS 100.00. Transaction ID: GH123456789012. Reference: ABCD12"
    if (!transactionId) {
      const txMatch = rawSms.match(/(?:Transaction\s*ID|TxID|Trans\s*ID)[:\s]+([A-Z0-9]{8,20})/i);
      transactionId = txMatch ? txMatch[1] : null;
    }
    if (!amount) {
      const amtMatch = rawSms.match(/(?:received|amount|GHS)[:\s]+(?:GHS\s*)?([0-9]+\.?[0-9]*)/i);
      amount = amtMatch ? parseFloat(amtMatch[1]) : null;
    }
    if (!referenceCode) {
      // Look for 6-char alphanumeric reference (our format)
      const refMatch = rawSms.match(/\b([A-Z0-9]{6})\b/g);
      referenceCode = refMatch ? refMatch[refMatch.length - 1] : null;
    }
    if (!network) {
      if (/MTN|mtn/i.test(rawSms)) network = "MTN";
      else if (/Telecel|Voda|vodafone/i.test(rawSms)) network = "Telecel";
      else if (/Airtel|Tigo/i.test(rawSms)) network = "AirtelTigo";
      else network = "MoMo";
    }

    // Call database function to process and credit
    const { data, error } = await supabase.rpc("process_sms_webhook", {
      p_raw_sms: rawSms,
      p_transaction_id: transactionId,
      p_amount: amount,
      p_network: network,
      p_reference_code: referenceCode,
    });

    if (error) throw error;

    // If user has a webhook URL, forward the notification
    if (data?.success && data?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("webhook_url")
        .eq("id", data.user_id)
        .single();

      if (profile?.webhook_url) {
        try {
          await fetch(profile.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "wallet_credited", ...data }),
          });
        } catch (_) { /* ignore external webhook errors */ }
      }
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
