import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecoverRequest {
  startDate: string;
  endDate: string;
  productId: string | null;
}

interface Playbook {
  id: string;
  name: string;
  flow_definition: any;
}

async function fetchKiwifySales(startDate: string, endDate: string, productId: string | null) {
  const kiwifyApiKey = Deno.env.get("KIWIFY_API_KEY");
  if (!kiwifyApiKey) {
    throw new Error("KIWIFY_API_KEY not configured");
  }

  const baseUrl = "https://api.kiwify.com.br/v1";
  const allSales: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      status: "paid",
      page: page.toString(),
      limit: "100",
    });

    if (productId) {
      params.append("product_id", productId);
    }

    const response = await fetch(`${baseUrl}/sales?${params}`, {
      headers: {
        Authorization: `Bearer ${kiwifyApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kiwify API error: ${error}`);
    }

    const data = await response.json();
    const sales = data.data || [];
    allSales.push(...sales);

    hasMore = sales.length === 100;
    page++;

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return allSales;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { startDate, endDate, productId }: RecoverRequest = await req.json();

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "startDate and endDate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Recovering sales from ${startDate} to ${endDate}, product: ${productId || "all"}`);

    // Fetch sales from Kiwify
    const sales = await fetchKiwifySales(startDate, endDate, productId);
    console.log(`Found ${sales.length} paid sales in Kiwify`);

    let processed = 0;
    let alreadyDone = 0;
    let errors = 0;

    for (const sale of sales) {
      try {
        const customerEmail = sale.Customer?.email;
        const kiwifyProductId = sale.Product?.product_id;

        if (!customerEmail) {
          errors++;
          continue;
        }

        // Check if contact exists
        let contactResult = await supabase
          .from("contacts")
          .select("id")
          .eq("email", customerEmail)
          .single();

        let contactId: string;

        // Create contact if not exists
        if (!contactResult.data) {
          const { data: newContact, error: contactError } = await supabase
            .from("contacts")
            .insert({
              email: customerEmail,
              first_name: sale.Customer?.first_name || "Cliente",
              last_name: sale.Customer?.last_name || "",
              phone: sale.Customer?.mobile || null,
              status: "customer",
              kiwify_customer_id: sale.Customer?.id,
            })
            .select()
            .single();

          if (contactError || !newContact) {
            console.error(`Error creating contact for ${customerEmail}:`, contactError);
            errors++;
            continue;
          }

          contactId = newContact.id;
        } else {
          contactId = contactResult.data.id;
        }

        // Find playbook for this product
        let playbook: Playbook | null = null;

        if (productId) {
          const { data: playbookLink } = await supabase
            .from("playbook_products")
            .select("playbook_id")
            .eq("product_id", productId)
            .single();

          if (playbookLink) {
            const { data: pb } = await supabase
              .from("onboarding_playbooks")
              .select("id, name, flow_definition")
              .eq("id", playbookLink.playbook_id)
              .eq("is_active", true)
              .single();

            playbook = pb as Playbook | null;
          }
        }

        // Also check by external_id if no playbook found
        if (!playbook && kiwifyProductId) {
          const { data: product } = await supabase
            .from("products")
            .select("id")
            .eq("external_id", kiwifyProductId)
            .single();

          if (product) {
            const { data: playbookLink } = await supabase
              .from("playbook_products")
              .select("playbook_id")
              .eq("product_id", product.id)
              .single();

            if (playbookLink) {
              const { data: pb } = await supabase
                .from("onboarding_playbooks")
                .select("id, name, flow_definition")
                .eq("id", playbookLink.playbook_id)
                .eq("is_active", true)
                .single();

              playbook = pb as Playbook | null;
            }
          }
        }

        if (!playbook) {
          // No playbook linked, just ensure contact exists
          alreadyDone++;
          continue;
        }

        // Check if execution already exists
        const { data: existingExecution } = await supabase
          .from("playbook_executions")
          .select("id")
          .eq("playbook_id", playbook.id)
          .eq("contact_id", contactId)
          .single();

        if (existingExecution) {
          alreadyDone++;
          continue;
        }

        // Create new execution
        const flowDefinition = playbook.flow_definition;
        const nodes = flowDefinition?.nodes || [];
        const firstNode = nodes.find((n: any) => n.type !== "start") || nodes[0];

        if (!firstNode) {
          errors++;
          continue;
        }

        const { data: execution, error: execError } = await supabase
          .from("playbook_executions")
          .insert({
            playbook_id: playbook.id,
            contact_id: contactId,
            status: "running",
            current_node_id: firstNode.id,
            execution_history: [{ nodeId: "start", timestamp: new Date().toISOString(), trigger: "recovery" }],
          })
          .select()
          .single();

        if (execError) {
          errors++;
          continue;
        }

        // Queue first node
        await supabase.from("playbook_execution_queue").insert({
          execution_id: execution.id,
          node_id: firstNode.id,
          node_type: firstNode.type,
          node_data: firstNode.data,
          scheduled_for: new Date().toISOString(),
          status: "pending",
        });

        // Log interaction
        await supabase.from("interactions").insert({
          customer_id: contactId,
          type: "note",
          content: `Playbook "${playbook.name}" iniciado via resgate retroativo`,
          channel: "other",
          metadata: { 
            playbook_id: playbook.id, 
            trigger: "recovery",
            kiwify_order_id: sale.order_id,
          },
        });

        processed++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        console.error(`Error processing sale:`, err);
        errors++;
      }
    }

    console.log(`Recovery completed: ${processed} processed, ${alreadyDone} already done, ${errors} errors`);

    return new Response(
      JSON.stringify({
        found: sales.length,
        processed,
        alreadyDone,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in recover-sales:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
