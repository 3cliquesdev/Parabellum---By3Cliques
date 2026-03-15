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
    const { tracking_code } = await req.json();

    if (!tracking_code || typeof tracking_code !== 'string') {
      return new Response(JSON.stringify({ found: false, error: 'tracking_code é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = tracking_code.trim();

    // Get MySQL credentials
    const mysqlHost = Deno.env.get('MYSQL_HOST');
    const mysqlPort = parseInt(Deno.env.get('MYSQL_PORT') || '3306');
    const mysqlUser = Deno.env.get('MYSQL_USER');
    const mysqlPassword = Deno.env.get('MYSQL_PASSWORD');
    const mysqlDatabase = Deno.env.get('MYSQL_DATABASE');

    if (!mysqlHost || !mysqlUser || !mysqlPassword || !mysqlDatabase) {
      console.error('[lookup-order-by-tracking] ❌ Credenciais MySQL não configuradas');
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

    console.log('[lookup-order-by-tracking] ✅ Conectado ao MySQL');

    try {
      // 1. Buscar na tabela parcel pelo tracking_number
      const parcelResults = await client.query(
        `SELECT tracking_number, box_number FROM parcel WHERE tracking_number = ?`,
        [trimmed]
      );

      let platformOrderId: string | null = null;
      let buyerName: string | null = null;
      let trackingNumber = trimmed;

      if (parcelResults && parcelResults.length > 0) {
        const parcel = parcelResults[0];
        trackingNumber = parcel.tracking_number || trimmed;

        // Buscar o pedido na mabang_order pelo tracking
        try {
          const orderResults = await client.query(
            `SELECT platform_order_id, buyer_name FROM mabang_order WHERE track_number = ? LIMIT 1`,
            [trimmed]
          );
          if (orderResults && orderResults.length > 0) {
            platformOrderId = orderResults[0].platform_order_id || null;
            buyerName = orderResults[0].buyer_name || null;
          }
        } catch (e) {
          console.log('[lookup-order-by-tracking] ℹ️ Erro query mabang_order por track:', e);
        }
      }

      // 2. Se não encontrou via parcel, tentar direto na mabang_order
      if (!platformOrderId) {
        try {
          const orderResults = await client.query(
            `SELECT platform_order_id, buyer_name, track_number FROM mabang_order WHERE track_number = ? LIMIT 1`,
            [trimmed]
          );
          if (orderResults && orderResults.length > 0) {
            platformOrderId = orderResults[0].platform_order_id || null;
            buyerName = orderResults[0].buyer_name || null;
            trackingNumber = orderResults[0].track_number || trimmed;
          }
        } catch (e) {
          console.log('[lookup-order-by-tracking] ℹ️ Erro query mabang_order:', e);
        }
      }

      if (!platformOrderId) {
        await client.close();
        console.log('[lookup-order-by-tracking] ❌ Não encontrado para:', trimmed);
        return new Response(JSON.stringify({ found: false }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Buscar títulos e SKUs dos produtos na mabang_order_item
      let productItems: { title: string; sku: string }[] = [];
      if (platformOrderId) {
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
          console.log('[lookup-order-by-tracking] ℹ️ Erro query mabang_order_item:', e);
        }
      }

      await client.close();
      console.log('[lookup-order-by-tracking] ✅ Encontrado:', { platformOrderId, buyerName, trackingNumber, productItems });

      return new Response(JSON.stringify({
        found: true,
        external_order_id: platformOrderId,
        tracking_code: trackingNumber,
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
    console.error('[lookup-order-by-tracking] ❌ Erro:', err);
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
