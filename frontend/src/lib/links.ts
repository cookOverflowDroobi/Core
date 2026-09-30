export interface TextPart {
  text: string;
  href?: string;
  external?: boolean;
}

// Web addresses, and the app paths Sous-chef links to when they start a word: /posts/12, /u/lina_haddad,
// /tags/vegan and /cook?i=rice,onion. Punctuation that ends a sentence stays out of the link.
const LINK =
  /https?:\/\/[^\s<>]*[^\s<>.,!?;:'")\]]|(?<=^|[\s(])\/(?:posts\/\d+|u\/[\w.]*\w|tags\/\w+|cook(?:\?i=[^\s]*[^\s.,!?;:'")\]])?)(?![\w/])/g;

function label(href: string): string {
  if (href.startsWith("/u/")) return `@${href.slice(3)}`;
  if (href.startsWith("/tags/")) return `#${href.slice(6)}`;
  if (href.startsWith("/cook")) {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
  }
  return href;
}

/** Chat text split into plain runs and links, so messages can link to posts, cooks, tags and searches. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const href = match[0];
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    const external = href.startsWith("http");
    parts.push({ text: external ? href : label(href), href, external });
    last = match.index + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
