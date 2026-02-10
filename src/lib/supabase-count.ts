/**
 * Helper padronizado para queries de contagem no Supabase.
 * Usa "id" em vez de "*" para manter o padrão enterprise
 * e evitar ambiguidade no payload.
 *
 * Uso: const { count } = await countQuery(supabase.from("deals")).eq(...);
 */
export function countQuery(queryBuilder: any) {
  return queryBuilder.select("id", { count: "exact", head: true });
}
