// Supabase Edge Function: fulfill-order
// Deploy: supabase functions deploy fulfill-order
// URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/fulfill-order

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GH_API_BASE = "https://ghdataconnect.com/api";
const GH_API_TOKEN = Deno.env.get("GHDATACONNECT_API_KEY") || "";

function extractNumericAmount(dataString: string): number {
  const gbMatch = dataString.match(/([\d.]+)\s*GB/i);
  if (gbMatch) return parseFloat(gbMatch[1]);
  const mbMatch = dataString.match(/([\d.]+)\s*MB/i);
  if (mbMatch) return parseFloat(mbMatch[1]);
  const numMatch = dataString.match(/([\d.]+)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return 1;
}

async function callGHData(network: string, phone: string, amount: number, reference: string) {
  const requestBody = {
    network: network,
    reference: reference,
    msisdn: phone,
    capacity: amount
  };

  console.log("📤 GHData request:", JSON.stringify(requestBody));

  const response = await fetch(`${GH_API_BASE}/v1/purchaseBundle`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GH_API_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log("📥 GHData response:", response.status, responseText);

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { success: false, message: responseText };
  }

  return { status: response.status, result };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the request has a valid API key or is authenticated
    const authHeader = req.headers.get("Authorization");
    const apiKey = authHeader?.replace("Bearer ", "").trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user from the API token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, balance")
      .eq("api_token", apiKey)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid API token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, message: "order_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the order belongs to the user
    if (order.user_id !== profile.id) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if order is already processed
    if (order.status === "completed" || order.status === "processing") {
      return new Response(
        JSON.stringify({ success: true, message: "Order already processed", status: order.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a manual package (MTN Mashup)
    if (order.is_manual || order.ghdata_type === "mtn-ishare") {
      await supabase
        .from("orders")
        .update({ 
          status: "processing",
          ghdata_status: "manual",
          notes: "MTN Mashup package requires manual delivery"
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Manual delivery required",
          status: "processing",
          order_id: order_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract numeric amount from the package data
    const numericAmount = extractNumericAmount(order.package || "");

    // Generate reference if not present
    const reference = order.ref || `DMH${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    console.log(`🚀 Fulfilling order ${order_id}: ${order.ghdata_type} ${numericAmount}GB to ${order.phone}`);

    // Call GHData API
    const { status, result } = await callGHData(
      order.ghdata_type || "mtn",
      order.phone,
      numericAmount,
      reference
    );

    // Update order based on response
    if (result?.success) {
      const actualRef = result.data?.reference || result.reference || reference;
      await supabase
        .from("orders")
        .update({
          status: "completed",
          gh_reference: String(actualRef),
          ghdata_status: "sent"
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Order fulfilled successfully",
          status: "completed",
          reference: actualRef,
          order_id: order_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Order failed - mark as failed and refund
      await supabase
        .from("orders")
        .update({
          status: "failed",
          ghdata_status: "failed",
          notes: `GHData error: ${result?.message || "Unknown error"}`
        })
        .eq("id", order_id);

      // Refund the wallet
      await supabase.rpc("credit_user", {
        p_user_id: profile.id,
        p_amount: order.amount,
        p_desc: `Refund for failed order #${order.ref || order_id}`
      });

      await supabase.from("transactions").insert({
        user_id: profile.id,
        type: "credit",
        description: `Refund for failed order #${order.ref || order_id}`,
        amount: order.amount,
        status: "success"
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Order failed - refunded",
          status: "failed",
          provider_message: result?.message,
          order_id: order_id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("💥 Fulfill order error:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
