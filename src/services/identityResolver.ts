/**
 * Identity Resolver Service
 * 
 * Serviço centralizado para resolução de identidade de contatos
 * a partir de múltiplos canais (WhatsApp, Email, Instagram, etc.)
 * 
 * Ordem de prioridade:
 * 1. Telefone (E.164) - mais confiável para WhatsApp/SMS
 * 2. Email
 * 3. External ID por canal (instagram, facebook, etc.)
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Contact = Tables<"contacts">;

export interface IdentityHints {
  phoneE164?: string;
  email?: string;
  externalId?: string;
  channel?: string;
  name?: string;
}

export interface ResolvedContact {
  contact: Contact;
  matchedBy: 'phone' | 'email' | 'external_id' | 'created';
}

/**
 * Resolve um contato a partir de hints de identidade
 * Se não encontrar, cria um novo contato "light"
 */
export async function resolveContact(
  hints: IdentityHints,
  createIfNotFound = true
): Promise<ResolvedContact | null> {
  // 1. Tentar por telefone (mais confiável)
  if (hints.phoneE164) {
    const contact = await findByPhone(hints.phoneE164);
    if (contact) {
      return { contact, matchedBy: 'phone' };
    }
  }

  // 2. Tentar por email
  if (hints.email) {
    const contact = await findByEmail(hints.email);
    if (contact) {
      return { contact, matchedBy: 'email' };
    }
  }

  // 3. Tentar por external_id específico do canal
  if (hints.externalId && hints.channel) {
    const contact = await findByExternalId(hints.externalId, hints.channel);
    if (contact) {
      return { contact, matchedBy: 'external_id' };
    }
  }

  // 4. Criar novo contato se permitido
  if (createIfNotFound) {
    const newContact = await createLightContact(hints);
    if (newContact) {
      return { contact: newContact, matchedBy: 'created' };
    }
  }

  return null;
}

/**
 * Busca contato por telefone
 */
async function findByPhone(phoneE164: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .or(`phone.eq.${phoneE164},whatsapp_id.eq.${phoneE164}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[IdentityResolver] Erro ao buscar por telefone:", error);
    return null;
  }

  return data;
}

/**
 * Busca contato por email
 */
async function findByEmail(email: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[IdentityResolver] Erro ao buscar por email:", error);
    return null;
  }

  return data;
}

/**
 * Busca contato por external_id de um canal específico
 */
async function findByExternalId(externalId: string, channel: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .contains("external_ids", { [channel]: externalId })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[IdentityResolver] Erro ao buscar por external_id:", error);
    return null;
  }

  return data;
}

/**
 * Cria um contato "light" com dados mínimos para enriquecimento posterior
 */
async function createLightContact(hints: IdentityHints): Promise<Contact | null> {
  const nameParts = hints.name?.split(" ") || ["Visitante"];
  const firstName = nameParts[0] || "Visitante";
  const lastName = nameParts.slice(1).join(" ") || "";

  const externalIds: Record<string, string> = {};
  if (hints.externalId && hints.channel) {
    externalIds[hints.channel] = hints.externalId;
  }
  if (hints.phoneE164) {
    externalIds.whatsapp = hints.phoneE164;
  }

  const contactData: TablesInsert<"contacts"> = {
    first_name: firstName,
    last_name: lastName,
    email: hints.email || null,
    phone: hints.phoneE164 || null,
    whatsapp_id: hints.phoneE164 || null,
    source: hints.channel || "unknown",
    status: "lead",
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(contactData)
    .select()
    .single();

  if (error) {
    console.error("[IdentityResolver] Erro ao criar contato:", error);
    return null;
  }

  // Atualizar external_ids separadamente (type safety)
  if (Object.keys(externalIds).length > 0) {
    await supabase
      .from("contacts")
      .update({ external_ids: externalIds } as any)
      .eq("id", data.id);
  }

  return data;
}

/**
 * Atualiza os external_ids de um contato existente
 */
export async function updateContactExternalId(
  contactId: string,
  channel: string,
  externalId: string
): Promise<boolean> {
  // Buscar external_ids atual
  const { data: contact, error: fetchError } = await supabase
    .from("contacts")
    .select("external_ids")
    .eq("id", contactId)
    .single();

  if (fetchError) {
    console.error("[IdentityResolver] Erro ao buscar contato:", fetchError);
    return false;
  }

  const currentIds = (contact?.external_ids as Record<string, string>) || {};
  const updatedIds = { ...currentIds, [channel]: externalId };

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ external_ids: updatedIds } as any)
    .eq("id", contactId);

  if (updateError) {
    console.error("[IdentityResolver] Erro ao atualizar external_ids:", updateError);
    return false;
  }

  return true;
}

/**
 * Verifica se dois contatos podem ser mergeados (sugestão)
 */
export async function suggestMerge(
  contactId1: string,
  contactId2: string
): Promise<{ canMerge: boolean; conflicts: string[] }> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .in("id", [contactId1, contactId2]);

  if (error || !contacts || contacts.length !== 2) {
    return { canMerge: false, conflicts: ["Contatos não encontrados"] };
  }

  const [c1, c2] = contacts;
  const conflicts: string[] = [];

  // Verificar conflitos em chaves fortes
  if (c1.email && c2.email && c1.email.toLowerCase() !== c2.email.toLowerCase()) {
    conflicts.push(`Emails diferentes: ${c1.email} vs ${c2.email}`);
  }

  if (c1.phone && c2.phone && c1.phone !== c2.phone) {
    conflicts.push(`Telefones diferentes: ${c1.phone} vs ${c2.phone}`);
  }

  if (c1.document && c2.document && c1.document !== c2.document) {
    conflicts.push(`CPF/CNPJ diferentes: ${c1.document} vs ${c2.document}`);
  }

  return {
    canMerge: conflicts.length === 0,
    conflicts,
  };
}
