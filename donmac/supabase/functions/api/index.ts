// Supabase Edge Function: External API
// Deploy: supabase functions deploy api
// URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
// External sites use this to place orders via Donmac Data Hub

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function generateRef(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace("/functions/v1/api", "");
  const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");

  // Verify API key
  const { data: profile, error: authErr } = await supabase
    .from("profiles")
    .select("id,name,balance,role,status")
    .eq("api_token", apiKey)
    .single();

  if (authErr || !profile) {
    return new Response(JSON.stringify({ success: false, message: "Invalid API key" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (profile.status === "blocked") {
    return new Response(JSON.stringify({ success: false, message: "Account blocked" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // GET /balance
    if (req.method === "GET" && path === "/balance") {
      return new Response(JSON.stringify({ success: true, balance: profile.balance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /packages
    if (req.method === "GET" && path === "/packages") {
      const { data: configs } = await supabase.from("packages_config").select("*");
      return new Response(JSON.stringify({ success: true, packages: configs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /orders — place an order
    if (req.method === "POST" && path === "/orders") {
      const body = await req.json();
      const { network, package: pkg, phone, amount, package_key } = body;
      if (!network || !pkg || !phone || !amount) {
        return new Response(JSON.stringify({ success: false, message: "network, package, phone, amount required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (profile.balance < amount) {
        return new Response(JSON.stringify({ success: false, message: "Insufficient balance" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const ref = generateRef();
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        ref, user_id: profile.id, network, package: pkg, package_key,
        phone, amount, status: "pending"
      }).select().single();

      if (orderErr) throw orderErr;

      // Debit wallet
      await supabase.from("profiles").update({ balance: profile.balance - amount }).eq("id", profile.id);
      await supabase.from("transactions").insert({
        user_id: profile.id, type: "debit",
        description: `API Order: ${network} ${pkg}`, amount, status: "success"
      });

      return new Response(JSON.stringify({ success: true, order }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /orders — list orders
    if (req.method === "GET" && path === "/orders") {
      const { data: orders } = await supabase
        .from("orders").select("*").eq("user_id", profile.id)
        .order("created_at", { ascending: false }).limit(50);
      return new Response(JSON.stringify({ success: true, orders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /orders/:id
    if (req.method === "GET" && path.startsWith("/orders/")) {
      const orderId = path.replace("/orders/", "");
      const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).eq("user_id", profile.id).single();
      return new Response(JSON.stringify({ success: true, order }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Route not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
