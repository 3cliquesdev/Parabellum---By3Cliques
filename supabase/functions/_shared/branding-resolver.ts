/**
 * branding-resolver.ts — Resolução dinâmica de branding e sender para todas as edge functions.
 * Busca email_branding, email_senders e organizations do banco UMA vez.
 * Fallback genérico neutro caso nenhum registro exista.
 */

export interface BrandingConfig {
  brandName: string;
  fromName: string;
  fromEmail: string;
  headerColor: string;
  primaryColor: string;
  footerText: string;
  logoUrl: string;
  footerLogoUrl: string;
}

export interface BrandingOptions {
  /** Se true, busca branding de funcionário (is_default_employee). Default: busca de cliente (is_default_customer). */
  isEmployee?: boolean;
}

export async function resolveBranding(
  supabase: any,
  options: BrandingOptions = {}
): Promise<BrandingConfig> {
  const { isEmployee = false } = options;

  try {
    const brandingColumn = isEmployee ? 'is_default_employee' : 'is_default_customer';

    const [brandingRes, senderRes, orgRes] = await Promise.all([
      supabase.from('email_branding').select('*').eq(brandingColumn, true).maybeSingle(),
      supabase.from('email_senders').select('*').eq('is_default', true).maybeSingle(),
      supabase.from('organizations').select('name').limit(1).maybeSingle(),
    ]);

    const branding = brandingRes.data;
    const sender = senderRes.data;
    const org = orgRes.data;

    const brandName = branding?.name || org?.name || 'Sua Empresa';

    return {
      brandName,
      fromName: sender?.from_name || branding?.name || org?.name || 'Suporte',
      fromEmail: sender?.from_email || 'contato@example.com',
      headerColor: branding?.header_color || '#0f172a',
      primaryColor: branding?.primary_color || '#1e3a5f',
      footerText: branding?.footer_text || `${brandName} - Equipe de Suporte`,
      logoUrl: branding?.logo_url || '',
      footerLogoUrl: branding?.footer_logo_url || '',
    };
  } catch (err) {
    console.warn('[branding-resolver] Erro ao buscar branding, usando fallbacks:', err);
    return {
      brandName: 'Sua Empresa',
      fromName: 'Suporte',
      fromEmail: 'contato@example.com',
      headerColor: '#0f172a',
      primaryColor: '#1e3a5f',
      footerText: 'Equipe de Suporte',
      logoUrl: '',
      footerLogoUrl: '',
    };
  }
}
