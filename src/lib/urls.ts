export function parseLinkedIn(input: string): { slug: string; url: string } | null {
  const m = input.trim().match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).replace(/\/$/, "");
  return { slug, url: `https://www.linkedin.com/in/${slug}/` };
}

export function parseInstagram(input: string): { handle: string; url: string } | null {
  const s = input.trim();
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i) || s.match(/^@?([A-Za-z0-9._]{1,30})$/);
  if (!m) return null;
  const handle = m[1].toLowerCase();
  if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(handle)) return null;
  return { handle, url: `https://www.instagram.com/${handle}/` };
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}
