import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DomainRequest {
  action: "list" | "get" | "create" | "verify" | "delete" | "test-api";
  domainId?: string;
  domainName?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          error: "RESEND_API_KEY não configurada",
          configured: false 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { action, domainId, domainName }: DomainRequest = await req.json();

    console.log(`[resend-domain-manager] Action: ${action}, DomainId: ${domainId}, DomainName: ${domainName}`);

    switch (action) {
      case "test-api": {
        // Test if API key is valid by listing domains
        try {
          const { data, error } = await resend.domains.list();
          if (error) {
            console.error("[resend-domain-manager] API test failed:", error);
            return new Response(
              JSON.stringify({ 
                valid: false, 
                error: error.message,
                configured: true 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ 
              valid: true, 
              configured: true,
              domainsCount: data?.data?.length || 0 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e: any) {
          console.error("[resend-domain-manager] API test exception:", e);
          return new Response(
            JSON.stringify({ 
              valid: false, 
              error: e.message,
              configured: true 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "list": {
        const { data, error } = await resend.domains.list();
        if (error) {
          console.error("[resend-domain-manager] List error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ domains: data?.data || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get": {
        if (!domainId) {
          return new Response(
            JSON.stringify({ error: "domainId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data, error } = await resend.domains.get(domainId);
        if (error) {
          console.error("[resend-domain-manager] Get error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ domain: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        if (!domainName) {
          return new Response(
            JSON.stringify({ error: "domainName é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data, error } = await resend.domains.create({ name: domainName });
        if (error) {
          console.error("[resend-domain-manager] Create error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ domain: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify": {
        if (!domainId) {
          return new Response(
            JSON.stringify({ error: "domainId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data, error } = await resend.domains.verify(domainId);
        if (error) {
          console.error("[resend-domain-manager] Verify error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ result: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!domainId) {
          return new Response(
            JSON.stringify({ error: "domainId é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data, error } = await resend.domains.remove(domainId);
        if (error) {
          console.error("[resend-domain-manager] Delete error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ result: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("[resend-domain-manager] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
