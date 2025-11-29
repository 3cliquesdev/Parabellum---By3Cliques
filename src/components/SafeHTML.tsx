import DOMPurify from 'dompurify';

interface SafeHTMLProps {
  html: string;
  className?: string;
}

export function SafeHTML({ html, className }: SafeHTMLProps) {
  // Extended whitelist for email templates with rich HTML
  const sanitizedHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Basic text formatting
      'b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Email-specific
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      'img', 'hr',
      // Semantic
      'section', 'article', 'header', 'footer', 'main'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 
      // Image attributes
      'src', 'alt', 'width', 'height',
      // Table attributes
      'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border',
      // Style (limited for email compatibility)
      'style', 'align', 'valign'
    ],
    ALLOW_DATA_ATTR: false
  });

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }} 
    />
  );
}
