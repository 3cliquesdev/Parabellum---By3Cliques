import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailTemplateRequest {
  trigger_type?: string;
  template_id?: string;
  department_id?: string;
  is_customer_email?: boolean;
  variables?: Record<string, string>;
}

interface EmailTemplateResponse {
  html: string;
  subject: string;
  from_name: string;
  from_email: string;
  template_id: string | null;
  branding_id: string | null;
}

// Replace variables in text with actual values
function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\[${key}\\]`, 'gi');
    result = result.replace(regex, value || '');
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      trigger_type, 
      template_id, 
      department_id, 
      is_customer_email = true,
      variables = {} 
    }: EmailTemplateRequest = await req.json();

    console.log("[get-email-template] Request:", { trigger_type, template_id, department_id, is_customer_email });

    // 1. Get template (by ID or trigger_type)
    let template = null;
    
    if (template_id) {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      
      if (error) throw new Error(`Template not found: ${error.message}`);
      template = data;
    } else if (trigger_type) {
      // Try trigger_types array first, fallback to trigger_type column
      const { data: arrayData, error: arrayError } = await supabase
        .from("email_templates")
        .select("*")
        .contains("trigger_types", [trigger_type])
        .eq("is_active", true)
        .limit(1)
        .single();
      
      if (arrayData) {
        template = arrayData;
      } else {
        // Fallback to legacy trigger_type column
        const { data, error } = await supabase
          .from("email_templates")
          .select("*")
          .eq("trigger_type", trigger_type)
          .eq("is_active", true)
          .single();
        
        if (error && error.code !== "PGRST116") {
          console.log("[get-email-template] No template found for trigger:", trigger_type);
        }
        template = data;
      }
    }

    // 2. Get branding (from template, or default)
    let branding = null;
    
    if (template?.branding_id) {
      const { data } = await supabase
        .from("email_branding")
        .select("*")
        .eq("id", template.branding_id)
        .single();
      branding = data;
    }
    
    if (!branding) {
      // Get default branding based on email type
      const brandingColumn = is_customer_email ? "is_default_customer" : "is_default_employee";
      const { data } = await supabase
        .from("email_branding")
        .select("*")
        .eq(brandingColumn, true)
        .single();
      branding = data;
    }

    // 3. Get sender (from template, department, or default)
    let sender = null;
    
    if (template?.sender_id) {
      const { data } = await supabase
        .from("email_senders")
        .select("*")
        .eq("id", template.sender_id)
        .single();
      sender = data;
    }
    
    if (!sender && department_id) {
      const { data } = await supabase
        .from("email_senders")
        .select("*")
        .eq("department_id", department_id)
        .single();
      sender = data;
    }
    
    if (!sender) {
      const { data } = await supabase
        .from("email_senders")
        .select("*")
        .eq("is_default", true)
        .single();
      sender = data;
    }

    // Fallback sender values via branding resolver
    const _brand = await resolveBranding(supabase, { isEmployee: !is_customer_email });
    const fromName = sender?.from_name || _brand.fromName;
    const fromEmail = sender?.from_email || _brand.fromEmail;

    // 4. Build HTML
    const headerColor = branding?.header_color || _brand.headerColor;
    const primaryColor = branding?.primary_color || _brand.primaryColor;
    const brandName = branding?.name || _brand.brandName;
    const footerText = branding?.footer_text || `${brandName} - Equipe de Suporte`;
    const logoUrl = branding?.logo_url;

    // Get template content or use empty
    let subject = template?.subject || "";
    let bodyContent = template?.html_body || "";

    // Replace variables
    subject = replaceVariables(subject, variables);
    bodyContent = replaceVariables(bodyContent, variables);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      ${logoUrl 
        ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 40px; max-width: 200px;" />`
        : `<h2 style="color: white; margin: 0; font-size: 24px;">${brandName}</h2>`
      }
    </div>
    
    <!-- Content -->
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; background: #ffffff; border-radius: 0 0 8px 8px;">
      ${bodyContent || '<p>Conteúdo do email.</p>'}
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 20px; padding: 20px; text-align: center; background: ${headerColor}; border-radius: 8px;">
      ${branding?.footer_logo_url 
        ? `<img src="${branding.footer_logo_url}" alt="${brandName}" style="max-height: 30px; margin-bottom: 10px;" /><br/>`
        : ''
      }
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const response: EmailTemplateResponse = {
      html: emailHtml,
      subject,
      from_name: fromName,
      from_email: fromEmail,
      template_id: template?.id || null,
      branding_id: branding?.id || null,
    };

    console.log("[get-email-template] Success:", { 
      template_id: response.template_id, 
      branding_id: response.branding_id,
      from: `${response.from_name} <${response.from_email}>`
    });

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[get-email-template] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
