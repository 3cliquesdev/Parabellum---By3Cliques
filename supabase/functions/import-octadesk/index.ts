import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversationInput {
  roomKey: string;
  department: string;
  publicTags: string[];
  clientName: string;
  satisfaction: string | null;
}

interface ImportConfig {
  categorySource: "department" | "tags" | "custom";
  customCategory?: string;
}

interface OctadeskMessage {
  type: number;
  roleType: number;
  text?: string;
  content?: string;
  createdAt?: { $date: string } | string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OCTADESK_API_KEY = Deno.env.get("OCTADESK_API_KEY");
    const OCTADESK_BASE_URL = Deno.env.get("OCTADESK_BASE_URL");
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OCTADESK_API_KEY || !OCTADESK_BASE_URL) {
      throw new Error("Credenciais do Octadesk não configuradas");
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { conversations, config }: { conversations: ConversationInput[]; config: ImportConfig } = await req.json();

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conversa para processar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[import-octadesk] Processando ${conversations.length} conversas`);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conv of conversations) {
      try {
        console.log(`[import-octadesk] Buscando mensagens para ${conv.roomKey}`);

        // Fetch messages from Octadesk API
        const messagesResponse = await fetch(
          `${OCTADESK_BASE_URL}/chat/${conv.roomKey}/messages`,
          {
            headers: {
              Authorization: `Bearer ${OCTADESK_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!messagesResponse.ok) {
          const errorText = await messagesResponse.text();
          console.error(`[import-octadesk] Erro ao buscar mensagens: ${messagesResponse.status} - ${errorText}`);
          errors.push(`Erro ao buscar mensagens de ${conv.roomKey}: ${messagesResponse.status}`);
          failed++;
          continue;
        }

        const messages: OctadeskMessage[] = await messagesResponse.json();
        console.log(`[import-octadesk] ${messages.length} mensagens encontradas`);

        if (!messages || messages.length < 3) {
          console.log(`[import-octadesk] Pulando ${conv.roomKey} - poucas mensagens`);
          skipped++;
          continue;
        }

        // Format conversation for AI
        const formattedConversation = formatConversation(messages);
        
        if (!formattedConversation || formattedConversation.trim().length < 100) {
          console.log(`[import-octadesk] Pulando ${conv.roomKey} - conversa muito curta`);
          skipped++;
          continue;
        }

        // Send to Lovable AI for processing
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em extrair conhecimento de conversas de suporte técnico.

Analise a conversa e extraia:
1. O PROBLEMA/DÚVIDA central do cliente
2. A SOLUÇÃO/PROCEDIMENTO fornecido pelo agente

REGRAS:
- Ignore cumprimentos, despedidas, mensagens de espera
- Ignore dados pessoais (email, telefone, CPF)
- Ignore mensagens automáticas de bot
- Se não houver solução clara (cliente saiu, problema não resolvido), retorne skip: true

Retorne APENAS JSON válido, sem markdown:
{
  "skip": false,
  "title": "Título descritivo do problema (máx 100 caracteres)",
  "content": "## Problema\\n[descrição do problema]\\n\\n## Solução\\n[passos da solução]",
  "suggestedTags": ["tag1", "tag2"]
}

Ou se não for útil:
{
  "skip": true,
  "reason": "motivo breve"
}`,
              },
              {
                role: "user",
                content: `Departamento: ${conv.department}
Cliente: ${conv.clientName}
Tags: ${conv.publicTags.join(", ") || "Nenhuma"}
Avaliação: ${conv.satisfaction || "Sem avaliação"}

CONVERSA:
${formattedConversation}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`[import-octadesk] Erro na API de IA: ${aiResponse.status} - ${errorText}`);
          
          if (aiResponse.status === 429) {
            errors.push(`Rate limit atingido para ${conv.roomKey}`);
            // Wait longer on rate limit
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else if (aiResponse.status === 402) {
            errors.push("Créditos insuficientes na API de IA");
            failed++;
            break; // Stop processing if out of credits
          }
          
          failed++;
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        if (!aiContent) {
          console.error(`[import-octadesk] Resposta vazia da IA`);
          failed++;
          continue;
        }

        // Parse AI response
        let parsed;
        try {
          // Remove markdown code blocks if present
          const cleanContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(cleanContent);
        } catch (parseError) {
          console.error(`[import-octadesk] Erro ao parsear resposta da IA: ${aiContent}`);
          failed++;
          continue;
        }

        if (parsed.skip) {
          console.log(`[import-octadesk] IA pulou conversa: ${parsed.reason || "sem motivo"}`);
          skipped++;
          continue;
        }

        // Determine category
        let category = "Suporte Octadesk";
        if (config.categorySource === "department") {
          category = conv.department;
        } else if (config.categorySource === "tags" && conv.publicTags.length > 0) {
          category = conv.publicTags[0];
        } else if (config.categorySource === "custom" && config.customCategory) {
          category = config.customCategory;
        }

        // Insert into knowledge_articles
        const { error: insertError } = await supabase.from("knowledge_articles").insert({
          title: parsed.title?.substring(0, 255) || "Artigo sem título",
          content: parsed.content || "",
          category: category,
          tags: parsed.suggestedTags || conv.publicTags,
          source_type: "octadesk_chat",
          ai_processed: true,
          is_published: false, // Needs review before publishing
          metadata: {
            octadesk_room_key: conv.roomKey,
            original_department: conv.department,
            original_tags: conv.publicTags,
            satisfaction: conv.satisfaction,
            imported_at: new Date().toISOString(),
          },
        });

        if (insertError) {
          console.error(`[import-octadesk] Erro ao inserir artigo: ${insertError.message}`);
          errors.push(`Erro ao salvar artigo de ${conv.roomKey}: ${insertError.message}`);
          failed++;
          continue;
        }

        console.log(`[import-octadesk] Artigo criado: ${parsed.title}`);
        created++;

        // Delay between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (convError) {
        console.error(`[import-octadesk] Erro processando ${conv.roomKey}:`, convError);
        errors.push(`Erro em ${conv.roomKey}: ${convError instanceof Error ? convError.message : "Erro desconhecido"}`);
        failed++;
      }
    }

    console.log(`[import-octadesk] Resultado: ${created} criados, ${skipped} pulados, ${failed} falhas`);

    return new Response(
      JSON.stringify({ created, skipped, failed, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[import-octadesk] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatConversation(messages: OctadeskMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const text = msg.text || msg.content || "";
    if (!text.trim()) continue;

    // type: 2 = customer message, type: 1 = agent message, type: 4 = bot
    // roleType: 5 = customer, roleType: 4 = agent
    
    let sender = "SISTEMA";
    if (msg.type === 2 || msg.roleType === 5) {
      sender = "CLIENTE";
    } else if (msg.type === 1 || msg.roleType === 4) {
      sender = "AGENTE";
    } else if (msg.type === 4) {
      // Skip bot messages
      continue;
    }

    // Clean up text
    const cleanText = text
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (cleanText.length > 10) {
      lines.push(`${sender}: ${cleanText}`);
    }
  }

  return lines.join("\n\n");
}
