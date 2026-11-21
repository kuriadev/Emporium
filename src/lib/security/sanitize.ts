const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c]!);
}

/** Normalises user-entered plain text: NFKC, strips tags + control chars, collapses whitespace. */
export function sanitizeText(value: string, { multiline = false }: { multiline?: boolean } = {}): string {
  let out = value.normalize("NFKC").replace(/<[^>]*>/g, "");
  // eslint-disable-next-line no-control-regex
  out = out.replace(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, "");
  out = multiline ? out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : out.replace(/\s+/g, " ");
  return out.trim();
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^\/(?!\/)/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const safe = safeHref(href.replace(/&amp;/g, "&"));
      return safe ? `<a href="${escapeHtml(safe)}" rel="nofollow noopener noreferrer" target="_blank">${label}</a>` : label;
    });
}

/**
 * Minimal, allow-list Markdown renderer. Input is HTML-escaped first, so the only tags that can
 * appear in the output are the ones produced here: h3, h4, p, ul, li, strong, em, code, a[href].
 */
export function renderSafeMarkdown(markdown: string): string {
  const lines = sanitizeText(markdown, { multiline: true }).split("\n");
  const html: string[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length) html.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushPara();
      const level = heading[1]!.length <= 3 ? "h3" : "h4";
      html.push(`<${level}>${inline(heading[2]!)}</${level}>`);
    } else if (bullet) {
      flushPara();
      list.push(bullet[1]!);
    } else if (line.trim() === "") {
      flushList();
      flushPara();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushList();
  flushPara();
  return html.join("");
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}
