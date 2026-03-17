import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    if (!order_id || typeof order_id !== 'string') {
      return new Response(JSON.stringify({ found: false, error: 'order_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = order_id.trim();

    const mysqlHost = Deno.env.get('MYSQL_HOST');
    const mysqlPort = parseInt(Deno.env.get('MYSQL_PORT') || '3306');
    const mysqlUser = Deno.env.get('MYSQL_USER');
    const mysqlPassword = Deno.env.get('MYSQL_PASSWORD');
    const mysqlDatabase = Deno.env.get('MYSQL_DATABASE');

    if (!mysqlHost || !mysqlUser || !mysqlPassword || !mysqlDatabase) {
      console.error('[lookup-order-by-id] ❌ Credenciais MySQL não configuradas');
      return new Response(JSON.stringify({ found: false, error: 'Credenciais do banco não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = await new Client().connect({
      hostname: mysqlHost,
      port: mysqlPort,
      username: mysqlUser,
      password: mysqlPassword,
      db: mysqlDatabase,
    });

    console.log('[lookup-order-by-id] ✅ Conectado ao MySQL');

    try {
      // Buscar pedido na mabang_order por platform_order_id
      const orderResults = await client.query(
        `SELECT platform_order_id, buyer_name, track_number FROM mabang_order WHERE platform_order_id = ? LIMIT 1`,
        [trimmed]
      );

      if (!orderResults || orderResults.length === 0) {
        await client.close();
        console.log('[lookup-order-by-id] ❌ Não encontrado para:', trimmed);
        return new Response(JSON.stringify({ found: false }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const order = orderResults[0];
      const platformOrderId = order.platform_order_id || trimmed;
      const buyerName = order.buyer_name || null;
      const trackingCode = order.track_number || null;

      // Buscar itens do pedido
      let productItems: { title: string; sku: string }[] = [];
      try {
        const itemResults = await client.query(
          `SELECT title, stock_sku FROM mabang_order_item WHERE platform_order_id = ?`,
          [platformOrderId]
        );
        if (itemResults && itemResults.length > 0) {
          productItems = itemResults
            .filter((item: any) => item.title || item.stock_sku)
            .map((item: any) => ({
              title: item.title || '',
              sku: item.stock_sku || '',
            }));
        }
      } catch (e) {
        console.log('[lookup-order-by-id] ℹ️ Erro query mabang_order_item:', e);
      }

      await client.close();
      console.log('[lookup-order-by-id] ✅ Encontrado:', { platformOrderId, buyerName, trackingCode, productItems });

      return new Response(JSON.stringify({
        found: true,
        external_order_id: platformOrderId,
        tracking_code: trackingCode,
        buyer_name: buyerName,
        product_items: productItems,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (queryErr) {
      await client.close();
      throw queryErr;
    }

  } catch (err) {
    console.error('[lookup-order-by-id] ❌ Erro:', err);
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
