/** Minimal Markdown -> HTML renderer for Pocket's summary text, shared
 * between the email digest (lib/send.ts) and the dashboard's inline
 * preview (app/page.tsx). Supports what Pocket's summaries actually use:
 * headings (# through ####), bold/italic emphasis, and bullet lists.
 *
 * Standard Markdown conventions: `*text*` is italic, `**text**` is bold,
 * `***text***` is bold+italic. HTML is escaped before any tags are
 * introduced, so the result is safe to inject as raw HTML - and blocks
 * (headings, lists, paragraphs) are built line-by-line rather than via a
 * single global replace, so a heading or list never ends up nested inside
 * a <p> the way a naive "wrap everything, then split on blank lines"
 * approach would produce.
 */
export function markdownToHtml(md: string): string {
  const escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inline(text: string): string {
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push(`<p>${inline(paragraphLines.join(" "))}</p>`);
      paragraphLines = [];
    }
  }
  function flushList() {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  }

  for (const rawLine of escaped.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,4}) (.+)$/);
    const listItem = line.match(/^[-*] (.+)$/);

    if (line === "") {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (listItem) {
      flushParagraph();
      listItems.push(`<li>${inline(listItem[1])}</li>`);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks.join("");
}
