// Minimal, safe inline-Markdown renderer for the thesis text (bold, code, links). Everything else is escaped.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function inline(md) {
  const codes = [];
  let t = esc(md).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[\w./-]+\.md)\)/g, (_, text, url) => `<a href="${url}"${url.startsWith("http") ? ' rel="noopener noreferrer"' : ""}>${text}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}
