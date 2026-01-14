import type { EmailBlock, BlockStyles, BlockContent } from "@/types/emailBuilderV2";

// =============================================
// EMAIL HTML GENERATOR - ENTERPRISE
// Converts email blocks to responsive table-based HTML
// Compatible with major email clients
// =============================================

interface EmailBranding {
  logo_url?: string;
  primary_color?: string;
  header_color?: string;
  footer_text?: string;
}

interface GenerateOptions {
  branding?: EmailBranding;
  preheader?: string;
  subject?: string;
}

/**
 * Converts CSS padding string to individual values
 */
function parsePadding(padding?: string): { top: string; right: string; bottom: string; left: string } {
  if (!padding) {
    return { top: "16px", right: "16px", bottom: "16px", left: "16px" };
  }

  const parts = padding.split(" ").map((p) => p.trim());
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  } else if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  } else if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  } else {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
}

/**
 * Converts HSL CSS variable to hex color for email compatibility
 */
function resolveColor(color?: string): string {
  if (!color) return "";
  
  // If it's already a hex or rgb, return as is
  if (color.startsWith("#") || color.startsWith("rgb")) {
    return color;
  }
  
  // Handle CSS variables like hsl(var(--primary))
  if (color.includes("var(--")) {
    // Map common CSS variables to default colors
    if (color.includes("--primary")) return "#2563eb";
    if (color.includes("--primary-foreground")) return "#ffffff";
    if (color.includes("--border")) return "#e2e8f0";
    if (color.includes("--muted")) return "#f1f5f9";
    return "#1e293b"; // Default
  }
  
  return color;
}

/**
 * Generates HTML for a text block
 */
function generateTextBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding);
  const textAlign = block.styles.textAlign || "left";
  const fontSize = block.styles.fontSize || "16px";
  const color = resolveColor(block.styles.color) || "#1e293b";
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "#ffffff";

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; background-color: ${backgroundColor};">
        <div style="font-size: ${fontSize}; color: ${color}; text-align: ${textAlign}; line-height: 1.6;">
          ${block.content.html || block.content.text || ""}
        </div>
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for an image block
 */
function generateImageBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding);
  const textAlign = block.styles.textAlign || "center";
  const borderRadius = block.styles.borderRadius || "0";
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "transparent";

  const imgHtml = `
    <img 
      src="${block.content.src || ""}" 
      alt="${block.content.alt || "Email image"}" 
      style="max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: ${borderRadius};"
    />
  `;

  const linkedImg = block.content.url
    ? `<a href="${block.content.url}" target="_blank" style="text-decoration: none;">${imgHtml}</a>`
    : imgHtml;

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; text-align: ${textAlign}; background-color: ${backgroundColor};">
        ${linkedImg}
      </td>
    </tr>
  `;
}

/**
 * Generates the href for a button based on action type
 */
function generateButtonHref(block: EmailBlock): string {
  const action = block.content.buttonAction || 'link';
  
  switch (action) {
    case 'download':
      return block.content.fileUrl || block.content.url || "#";
    case 'email': {
      const email = block.content.email || "";
      const subject = block.content.emailSubject;
      return subject 
        ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
        : `mailto:${email}`;
    }
    case 'phone':
      const phone = (block.content.phone || "").replace(/\s/g, "");
      return `tel:${phone}`;
    case 'link':
    default:
      return block.content.url || "#";
  }
}

/**
 * Generates HTML for a button block
 */
function generateButtonBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding);
  const textAlign = block.styles.textAlign || "center";
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "#2563eb";
  const color = resolveColor(block.styles.color) || "#ffffff";
  const borderRadius = block.styles.borderRadius || "6px";
  const fontSize = block.styles.fontSize || "14px";
  const fontWeight = block.styles.fontWeight || "500";

  const href = generateButtonHref(block);
  const action = block.content.buttonAction || 'link';
  const downloadAttr = action === 'download' ? 'download' : '';
  const targetAttr = action === 'link' ? 'target="_blank"' : '';

  return `
    <tr>
      <td style="padding: 16px 24px; text-align: ${textAlign};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left'}">
          <tr>
            <td style="background-color: ${backgroundColor}; border-radius: ${borderRadius};">
              <a 
                href="${href}" 
                ${targetAttr}
                ${downloadAttr}
                style="
                  display: inline-block;
                  padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left};
                  font-size: ${fontSize};
                  font-weight: ${fontWeight};
                  color: ${color};
                  text-decoration: none;
                  border-radius: ${borderRadius};
                "
              >
                ${block.content.buttonText || "Clique aqui"}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a spacer block
 */
function generateSpacerBlockHtml(block: EmailBlock): string {
  const height = block.content.height || 40;
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "transparent";

  return `
    <tr>
      <td style="height: ${height}px; font-size: 1px; line-height: 1px; background-color: ${backgroundColor};">
        &nbsp;
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a divider block
 */
function generateDividerBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding || "16px 0");
  const color = resolveColor(block.styles.color) || "#e2e8f0";

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left};">
        <hr style="border: 0; border-top: 1px solid ${color}; margin: 0;" />
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a banner block
 */
function generateBannerBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding || "32px");
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "#1e293b";
  const color = resolveColor(block.styles.color) || "#ffffff";
  const textAlign = block.styles.textAlign || "center";
  const backgroundImage = block.content.src ? `url('${block.content.src}')` : "none";

  return `
    <tr>
      <td style="
        padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left};
        background-color: ${backgroundColor};
        background-image: ${backgroundImage};
        background-size: cover;
        background-position: center;
        color: ${color};
        text-align: ${textAlign};
      ">
        ${block.content.html || ""}
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a signature block
 */
function generateSignatureBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding || "20px");
  const textAlign = block.styles.textAlign || "left";
  const color = resolveColor(block.styles.color) || "#1e293b";
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "transparent";

  const avatarHtml = block.content.src
    ? `<img src="${block.content.src}" alt="${block.content.name || 'Avatar'}" width="64" height="64" style="border-radius: 50%; margin-right: 16px;" />`
    : "";

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; background-color: ${backgroundColor};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            ${avatarHtml ? `<td valign="top">${avatarHtml}</td>` : ""}
            <td valign="top" style="text-align: ${textAlign};">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: ${color};">${block.content.name || "Nome"}</p>
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b;">${block.content.role || "Cargo"}</p>
              ${block.content.email ? `<a href="mailto:${block.content.email}" style="font-size: 14px; color: #2563eb;">${block.content.email}</a>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a social block
 */
function generateSocialBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding || "20px");
  const textAlign = block.styles.textAlign || "center";
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "transparent";
  const links = block.content.links || [];

  const SOCIAL_COLORS: Record<string, string> = {
    facebook: "#1877F2",
    twitter: "#1DA1F2",
    instagram: "#E4405F",
    linkedin: "#0A66C2",
    youtube: "#FF0000",
    website: "#6B7280",
  };

  const SOCIAL_LABELS: Record<string, string> = {
    facebook: "FB",
    twitter: "X",
    instagram: "IG",
    linkedin: "IN",
    youtube: "YT",
    website: "🌐",
  };

  const socialLinks = links
    .map(
      (link) => `
      <td style="padding: 0 8px;">
        <a 
          href="${link.url || "#"}" 
          target="_blank" 
          style="
            display: inline-block;
            width: 36px;
            height: 36px;
            line-height: 36px;
            text-align: center;
            background-color: ${SOCIAL_COLORS[link.platform] || "#6B7280"};
            color: #ffffff;
            border-radius: 50%;
            text-decoration: none;
            font-size: 12px;
            font-weight: 600;
          "
        >
          ${SOCIAL_LABELS[link.platform] || "🔗"}
        </a>
      </td>
    `
    )
    .join("");

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; text-align: ${textAlign}; background-color: ${backgroundColor};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left'}">
          <tr>
            ${socialLinks}
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for an HTML block
 */
function generateHtmlBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding);
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "#ffffff";

  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; background-color: ${backgroundColor};">
        ${block.content.html || ""}
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a columns block (simplified - 2 columns)
 */
function generateColumnsBlockHtml(block: EmailBlock): string {
  const padding = parsePadding(block.styles.padding);
  const backgroundColor = resolveColor(block.styles.backgroundColor) || "transparent";

  // TODO: Implement nested column blocks if needed
  return `
    <tr>
      <td style="padding: ${padding.top} ${padding.right} ${padding.bottom} ${padding.left}; background-color: ${backgroundColor};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td width="50%" valign="top" style="padding-right: 10px;">
              <!-- Column 1 content -->
            </td>
            <td width="50%" valign="top" style="padding-left: 10px;">
              <!-- Column 2 content -->
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Generates HTML for a single block based on its type
 */
function generateBlockHtml(block: EmailBlock): string {
  switch (block.block_type) {
    case "text":
      return generateTextBlockHtml(block);
    case "image":
      return generateImageBlockHtml(block);
    case "button":
      return generateButtonBlockHtml(block);
    case "spacer":
      return generateSpacerBlockHtml(block);
    case "divider":
      return generateDividerBlockHtml(block);
    case "banner":
      return generateBannerBlockHtml(block);
    case "signature":
      return generateSignatureBlockHtml(block);
    case "social":
      return generateSocialBlockHtml(block);
    case "html":
      return generateHtmlBlockHtml(block);
    case "columns":
      return generateColumnsBlockHtml(block);
    default:
      return "";
  }
}

/**
 * Main function: Generates complete responsive email HTML from blocks
 */
export function generateEmailHTML(
  blocks: EmailBlock[],
  options: GenerateOptions = {}
): string {
  const { branding, preheader, subject } = options;
  const primaryColor = branding?.primary_color || "#2563eb";
  const headerColor = branding?.header_color || "#1e293b";

  // Sort blocks by position
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  // Generate HTML for all blocks
  const blocksHtml = sortedBlocks.map(generateBlockHtml).join("\n");

  // Preheader text (hidden preview text)
  const preheaderHtml = preheader
    ? `
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
      ${preheader}
    </div>
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
  `
    : "";

  // Footer with branding
  const footerHtml = branding?.footer_text
    ? `
    <tr>
      <td style="padding: 20px; text-align: center; font-size: 12px; color: #64748b; background-color: #f8fafc;">
        ${branding.footer_text}
      </td>
    </tr>
  `
    : "";

  // Logo header
  const logoHtml = branding?.logo_url
    ? `
    <tr>
      <td style="padding: 20px; text-align: center; background-color: ${headerColor};">
        <img src="${branding.logo_url}" alt="Logo" style="max-height: 50px; width: auto;" />
      </td>
    </tr>
  `
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject || "Email"}</title>
  
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    
    /* Outlook fixes */
    table { border-collapse: collapse !important; }
    
    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .mobile-padding { padding: 16px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-center { text-align: center !important; }
      .mobile-hide { display: none !important; }
      .mobile-full-width { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheaderHtml}
  
  <!-- Email wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        
        <!-- Email container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          ${logoHtml}
          
          <!-- Content blocks -->
          ${blocksHtml}
          
          ${footerHtml}
          
        </table>
        <!-- End email container -->
        
      </td>
    </tr>
  </table>
  <!-- End email wrapper -->
  
</body>
</html>
  `.trim();
}

/**
 * Replaces variables in HTML with actual values
 * Variables are in the format {{variable_key}}
 */
export function replaceVariables(
  html: string,
  data: Record<string, string | number | undefined>
): string {
  return Object.entries(data).reduce((result, [key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    return result.replace(regex, String(value ?? ""));
  }, html);
}

/**
 * Default sample data for preview
 */
export const defaultSampleData: Record<string, string> = {
  primeiro_nome: "João",
  nome_completo: "João Silva",
  email: "joao@empresa.com",
  telefone: "(11) 99999-9999",
  empresa: "Empresa LTDA",
  cargo: "Gerente",
  nome_produto: "Plano Premium",
  valor: "R$ 1.500,00",
  data_vencimento: "15/03/2025",
  link_pagamento: "https://pay.exemplo.com/xyz",
};
