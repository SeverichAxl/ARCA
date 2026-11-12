import DOMPurify from 'dompurify';
import { substituteVariables, type TemplateValues } from './variables';

/**
 * `sandbox=""` es deliberado: sin allow-scripts ni allow-same-origin.
 * El iframe no puede ejecutar JavaScript ni acceder al documento padre.
 */
export const PREVIEW_SANDBOX = '';

export const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'span',
  'div',
  'img',
  'figure',
  'figcaption',
];

const ALLOWED_ATTR = [
  'class',
  'style',
  'colspan',
  'rowspan',
  'data-variable',
  'title',
  'alt',
  'src',
  'width',
  'height',
  'align',
  'valign',
  'scope',
  'start',
  'type',
  'reversed',
];

const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
];

const FORBIDDEN_ATTR = [
  'href',
  'xlink:href',
  'srcdoc',
  'formaction',
  'action',
  'onerror',
  'onload',
  'onclick',
  'onmouseover',
  'onfocus',
  'onbegin',
  'onstart',
];

let styleHookRegistered = false;

function registerStyleHook(): void {
  if (styleHookRegistered || typeof window === 'undefined') return;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (
      data.attrName === 'style' &&
      /url\s*\(|expression\s*\(|@import|javascript:/i.test(data.attrValue)
    ) {
      data.keepAttr = false;
    }
  });
  styleHookRegistered = true;
}

/**
 * Sanitiza el HTML de la plantilla con DOMPurify.
 *
 * Se usa un fallback conservador solo para SSR; el documento real se genera
 * en el cliente, donde DOMPurify está disponible.
 */
export function sanitizePreviewHtml(html: string): string {
  if (typeof window === 'undefined') return sanitizeFallback(html);

  registerStyleHook();
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTR,
    ALLOWED_URI_REGEXP: /^(?:data:image\/(?:png|jpe?g|gif|webp);base64,|#)/i,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
  return String(clean);
}

function sanitizeFallback(html: string): string {
  return html
    .replace(
      /<\/?(?:script|iframe|object|embed|form|input|button|textarea|select|option|link|meta|base|svg|math|video|audio|source|track|canvas)[^>]*>/gi,
      '',
    )
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s(?:href|src|srcdoc|formaction|action)\s*=\s*(?:"(?:https?:|\/\/|javascript:)[^"]*"|'(?:https?:|\/\/|javascript:)[^']*'|(?:https?:|\/\/|javascript:)[^\s>]+)/gi,
      '',
    );
}

const PREVIEW_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e2e8f0; }
  body {
    min-height: 100vh;
    padding: 24px 12px;
    color: #0f172a;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
  }
  .sheet {
    width: 210mm;
    max-width: 100%;
    min-height: 297mm;
    margin: 0 auto;
    padding: 20mm;
    background: #ffffff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  }
  h1 { font-size: 18pt; line-height: 1.25; margin: 0 0 12pt; text-align: center; }
  h2 { font-size: 14pt; line-height: 1.3; margin: 16pt 0 8pt; }
  h3 { font-size: 12pt; line-height: 1.3; margin: 12pt 0 6pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
  li { margin-bottom: 3pt; }
  blockquote { margin: 0 0 8pt; padding-left: 10pt; border-left: 3px solid #94a3b8; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; }
  th, td { border: 1px solid #94a3b8; padding: 5pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 700; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #cbd5e1; margin: 12pt 0; }
  .arca-var-missing {
    background: #fef08a;
    color: #854d0e;
    border-radius: 3px;
    padding: 0 2px;
    text-decoration: underline dotted #a16207;
  }
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #ffffff; }
    body { padding: 0; }
    .sheet { box-shadow: none; margin: 0; }
  }
`;

/**
 * Genera el `srcDoc` completo del iframe de vista previa:
 * sustitución de variables + DOMPurify + CSP + hoja A4 blanca.
 */
export function buildPreviewDocument(
  html: string,
  values: TemplateValues = {},
): string {
  const substituted = substituteVariables(html, values);
  const clean = sanitizePreviewHtml(substituted);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${PREVIEW_STYLES}</style>
</head>
<body>
<article class="sheet">${clean}</article>
</body>
</html>`;
}
