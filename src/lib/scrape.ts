import type { InstagramProfile, LinkedInProfile, Sources } from "./types";
import { parseInstagram, parseLinkedIn } from "./urls";

// Scraping runs on Apify actors (headless-browser scrapers on residential
// proxies). Instagram and LinkedIn both block plain server-side requests, so
// this is the only reliable way to read public profiles.
//
//   Instagram  apify/instagram-profile-scraper      bio, counts, latest ~12 posts (captions, alt text, locations, images)
//   LinkedIn   harvestapi/linkedin-profile-scraper  headline, about, experience, education, skills, causes… (no cookies)
//              harvestapi/linkedin-profile-posts    recent posts
//              apimaestro/linkedin-profile-detail   fallback if the primary LinkedIn actor is unavailable

const API = "https://api.apify.com/v2";

export const ACTORS = {
  instagram: process.env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-profile-scraper",
  linkedin: process.env.APIFY_LINKEDIN_ACTOR || "harvestapi~linkedin-profile-scraper",
  linkedinPosts: process.env.APIFY_LINKEDIN_POSTS_ACTOR || "harvestapi~linkedin-profile-posts",
  linkedinFallback: process.env.APIFY_LINKEDIN_FALLBACK_ACTOR || "apimaestro~linkedin-profile-detail",
};
const LI_MODE = "Profile details no email ($4 per 1k)";

type Obj = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function auth() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  return { authorization: `Bearer ${token}` };
}

/** Run an actor synchronously and return its dataset items. Retries when the
 *  account is at its concurrent-run limit (free Apify plans allow 5). */
async function runActor<T = Obj>(actor: string, input: unknown, timeoutSec = 150): Promise<T[]> {
  const t = Math.min(timeoutSec, 290); // run-sync endpoints cap at 300 s
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/actors/${actor}/run-sync-get-dataset-items?timeout=${t}&maxTotalChargeUsd=1`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((t + 30) * 1000),
    });
    if (res.ok) return (await res.json()) as T[];
    const body = await res.text();
    const busy = res.status === 429 || body.includes("concurrent-runs-limit");
    if (busy && attempt < 15) {
      await sleep(4000 + Math.random() * 4000);
      continue;
    }
    throw new Error(`Apify ${actor} failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** Start an actor run (or reuse an existing run id), wait for it with no 300 s cap, return dataset items. Used for batches. */
async function runActorBatch<T = Obj>(actor: string, input: unknown, opts: { reuseRunId?: string; maxWaitSec?: number } = {}): Promise<T[]> {
  let runId = opts.reuseRunId;
  if (!runId) {
    for (let attempt = 0; ; attempt++) {
      const start = await fetch(`${API}/actors/${actor}/runs?maxTotalChargeUsd=2`, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth() },
        body: JSON.stringify(input),
      });
      if (start.ok) {
        runId = ((await start.json()) as { data: { id: string } }).data.id;
        break;
      }
      const body = await start.text();
      if ((start.status === 429 || body.includes("concurrent-runs-limit")) && attempt < 40) {
        await sleep(8000);
        continue;
      }
      throw new Error(`Apify ${actor} start failed: ${start.status} ${body.slice(0, 200)}`);
    }
  }
  const deadline = Date.now() + (opts.maxWaitSec ?? 1200) * 1000;
  let datasetId = "";
  for (;;) {
    const r = await fetch(`${API}/actor-runs/${runId}?waitForFinish=60`, { headers: auth() });
    const data = ((await r.json()) as { data: { status: string; defaultDatasetId: string } }).data;
    datasetId = data.defaultDatasetId;
    if (data.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify ${actor} run ${data.status}`);
    if (Date.now() > deadline) throw new Error(`Apify ${actor} run still ${data.status}`);
  }
  const items = await fetch(`${API}/datasets/${datasetId}/items?clean=true`, { headers: auth() });
  return (await items.json()) as T[];
}

// ---- helpers for defensive field mapping (actor outputs vary slightly) ----
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v.trim() && !isNaN(+v) ? +v : undefined);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Obj)[part] : undefined), o);
    if (v != null && v !== "") return v;
  }
  return undefined;
};
const names = (v: unknown, ...keys: string[]) =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x : str(pick(x as Obj, ...keys)))).filter(Boolean);

function dateRange(o: Obj): string {
  const s = str(pick(o, "startDate.text", "starts_at.year", "timePeriod.startDate.year"));
  const e = str(pick(o, "endDate.text", "ends_at.year", "timePeriod.endDate.year"));
  if (s || e) return `${s || "?"} – ${e || "Present"}`;
  return str(pick(o, "duration", "period"));
}

// ---------------- Instagram ----------------
export function normalizeInstagram(item: Obj | undefined, handle: string): InstagramProfile {
  if (!item || item.error || item.errorDescription) {
    throw new Error(`Instagram profile @${handle} not found (${str(item?.errorDescription || item?.error) || "no data"})`);
  }
  const isPrivate = !!pick(item, "private", "isPrivate", "is_private") || !!pick(item, "isRestrictedProfile");
  if (isPrivate) throw new Error(`@${handle} is a private account — only public Instagram profiles can be used`);
  const posts = arr(pick(item, "latestPosts", "posts"))
    .slice(0, 12)
    .map((p) => {
      const likes = num(pick(p, "likesCount", "likes"));
      return {
        caption: str(pick(p, "caption", "text")),
        hashtags: (Array.isArray(p.hashtags) ? p.hashtags : []).map(String),
        location: str(pick(p, "locationName", "location.name")) || undefined,
        type: str(pick(p, "type", "productType")) || undefined,
        timestamp: str(pick(p, "timestamp", "takenAt")) || undefined,
        likes: likes != null && likes >= 0 ? likes : undefined,
        comments: num(pick(p, "commentsCount", "comments")),
        alt: str(pick(p, "alt", "accessibilityCaption")) || undefined,
        imageUrl: str(pick(p, "displayUrl", "imageUrl", "thumbnailUrl")) || undefined,
        url: str(pick(p, "url")) || undefined,
      };
    });
  return {
    username: str(pick(item, "username")) || handle,
    url: `https://www.instagram.com/${handle}/`,
    fullName: str(pick(item, "fullName", "full_name")),
    biography: str(pick(item, "biography", "bio")),
    followers: num(pick(item, "followersCount", "followers")),
    following: num(pick(item, "followsCount", "following")),
    postsCount: num(pick(item, "postsCount", "mediaCount")),
    verified: !!pick(item, "verified", "isVerified"),
    private: false,
    category: str(pick(item, "businessCategoryName", "category")).replace(/^None$/, "") || undefined,
    externalUrl: str(pick(item, "externalUrl", "external_url")) || undefined,
    profilePic: str(pick(item, "profilePicUrlHD", "profilePicUrl")) || undefined,
    posts,
  };
}

export async function scrapeInstagram(input: string): Promise<InstagramProfile> {
  const parsed = parseInstagram(input);
  if (!parsed) throw new Error("That doesn't look like an Instagram profile link");
  const [item] = await runActor<Obj>(ACTORS.instagram, { usernames: [parsed.handle] });
  return normalizeInstagram(item, parsed.handle);
}

// ---------------- LinkedIn ----------------
type Post = { text: string; date?: string };

export function normalizeLinkedIn(item: Obj, posts: Post[], url: string): LinkedInProfile {
  const fullName =
    str(pick(item, "fullName", "name")) || [str(pick(item, "firstName")), str(pick(item, "lastName"))].filter(Boolean).join(" ");
  return {
    url,
    fullName,
    headline: str(pick(item, "headline", "occupation", "jobTitle")),
    about: str(pick(item, "about", "summary")),
    location: str(pick(item, "location.linkedinText", "location.parsed.text", "location", "addressWithCountry", "geoLocationName")) || undefined,
    followers: num(pick(item, "followerCount", "followers", "followersCount")),
    pictureUrl: str(pick(item, "photo", "profilePicture.url", "profilePic", "picture")) || undefined,
    experience: arr(pick(item, "experience", "experiences", "positions")).map((e) => ({
      title: str(pick(e, "position", "title", "jobTitle")),
      company: str(pick(e, "companyName", "company", "subtitle")),
      dates: dateRange(e) || undefined,
      location: str(pick(e, "location", "jobLocation")) || undefined,
      description: str(pick(e, "description", "summary")) || undefined,
    })),
    education: arr(pick(item, "education", "educations")).map((e) => ({
      school: str(pick(e, "schoolName", "school", "title")),
      degree: str(pick(e, "degree", "degreeName")) || undefined,
      field: str(pick(e, "fieldOfStudy", "field")) || undefined,
      dates: dateRange(e) || undefined,
      activities: str(pick(e, "insights", "activities", "description")) || undefined,
    })),
    skills: names(pick(item, "skills"), "name", "title").length
      ? names(pick(item, "skills"), "name", "title")
      : str(pick(item, "topSkills"))
          .split("•")
          .map((x) => x.trim())
          .filter(Boolean),
    languages: names(pick(item, "languages"), "name", "language", "title"),
    certifications: names(pick(item, "certifications", "licenseAndCertificates"), "title", "name"),
    volunteering: arr(pick(item, "volunteering", "volunteerExperiences", "volunteer"))
      .map((v) => [str(pick(v, "role", "title")), str(pick(v, "organizationName"))].filter(Boolean).join(" @ "))
      .filter(Boolean),
    honors: names(pick(item, "honorsAndAwards", "honors", "awards"), "title", "name"),
    causes: names(pick(item, "causes"), "name", "title"),
    projects: arr(pick(item, "projects"))
      .map((x) => [str(x.title), str(x.description).slice(0, 200)].filter(Boolean).join(": "))
      .filter(Boolean),
    posts,
  };
}

function linkedInItem(raw: Obj | undefined): Obj | null {
  if (!raw) return null;
  const item = (raw.element && typeof raw.element === "object" ? raw.element : raw) as Obj;
  const status = num(raw.status);
  if (raw.error || (status != null && status !== 200) || raw.element === null) return null;
  return pick(item, "firstName", "fullName", "headline") ? item : null;
}

/** apimaestro returns snake_case; map it onto the harvestapi-style keys normalizeLinkedIn reads. */
function fromFallback(raw: Obj | undefined): Obj | null {
  const data = ((raw?.data as Obj) || raw) as Obj | undefined;
  const basic = ((data?.basic_info as Obj) || data) as Obj | undefined;
  if (!data || !basic || !pick(basic, "fullname", "full_name", "first_name", "headline")) return null;
  return {
    fullName: pick(basic, "fullname", "full_name") || [str(basic.first_name), str(basic.last_name)].join(" "),
    headline: basic.headline,
    about: basic.about,
    location: pick(basic, "location.full", "location"),
    followerCount: basic.follower_count,
    photo: basic.profile_picture_url,
    experience: arr(data.experience).map((e) => ({
      position: e.title,
      companyName: e.company,
      location: e.location,
      description: e.description,
      duration: [str(pick(e, "start_date.year")), str(pick(e, "end_date.year")) || (e.is_current ? "Present" : "")].filter(Boolean).join(" – "),
    })),
    education: arr(data.education).map((e) => ({ schoolName: e.school, degree: e.degree, fieldOfStudy: e.field_of_study })),
    skills: data.skills,
    languages: data.languages,
    certifications: data.certifications,
  };
}

async function fetchLinkedInProfile(url: string, slug: string): Promise<Obj> {
  const errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const items = await runActor<Obj>(ACTORS.linkedin, { queries: [url], profileScraperMode: LI_MODE });
      const item = linkedInItem(items[0]);
      if (item) return item;
      errors.push(str(items[0]?.error) || "no data");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    const item = fromFallback((await runActor<Obj>(ACTORS.linkedinFallback, { username: url, includeEmail: false }))[0]);
    if (item) return item;
    errors.push("fallback: no data");
  } catch (e) {
    errors.push(`fallback: ${e instanceof Error ? e.message : String(e)}`);
  }
  throw new Error(`LinkedIn profile ${slug} could not be read (${errors.join("; ").slice(0, 300)})`);
}

function toPosts(items: Obj[]): Post[] {
  return items
    .filter((p) => !p.type || p.type === "post")
    .map((p) => ({
      text: str(pick(p, "content", "text", "postText", "commentary")),
      date: str(pick(p, "postedAt.date", "postedAt", "date")).slice(0, 10) || undefined,
    }))
    .filter((p) => p.text)
    .slice(0, 8);
}

async function scrapeLinkedInPosts(url: string): Promise<Post[]> {
  const items = await runActor<Obj>(ACTORS.linkedinPosts, { targetUrls: [url], maxPosts: 8, includeReposts: false, includeQuotePosts: true }, 90);
  return toPosts(items);
}

export async function scrapeLinkedIn(input: string): Promise<LinkedInProfile> {
  const parsed = parseLinkedIn(input);
  if (!parsed) throw new Error("That doesn't look like a LinkedIn profile link (linkedin.com/in/…)");
  const [item, posts] = await Promise.all([fetchLinkedInProfile(parsed.url, parsed.slug), scrapeLinkedInPosts(parsed.url).catch(() => [])]);
  return normalizeLinkedIn(item, posts, parsed.url);
}

/** One person, three actor runs in parallel (used by the live site). */
export async function scrapeBoth(linkedinUrl: string, instagramUrl: string): Promise<Sources> {
  const [linkedin, instagram] = await Promise.all([scrapeLinkedIn(linkedinUrl), scrapeInstagram(instagramUrl)]);
  return { linkedin, instagram, scrapedAt: new Date().toISOString() };
}

/** Many people, one run per actor (used to build the seed example). Keyed by Instagram handle. */
export async function scrapeBatch(entries: { linkedin: string; instagram: string }[]): Promise<Map<string, Sources | Error>> {
  const people = entries.map((e) => ({ li: parseLinkedIn(e.linkedin)!, ig: parseInstagram(e.instagram)! }));
  const slugKey = (s: string) => decodeURIComponent(s).toLowerCase().replace(/\/$/, "");
  const slugOf = (s: string) => slugKey(s.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] || s);

  // Free Apify plans return at most 10 LinkedIn profiles per run, so LinkedIn goes in chunks.
  const chunk = Number(process.env.APIFY_LINKEDIN_CHUNK || 10);
  const liChunks = async () => {
    const all: Obj[] = [];
    for (let i = 0; i < people.length; i += chunk)
      all.push(...(await runActorBatch<Obj>(ACTORS.linkedin, { queries: people.slice(i, i + chunk).map((p) => p.li.url), profileScraperMode: LI_MODE })));
    return all;
  };
  const [igItems, liItems, postItems] = await Promise.all([
    runActorBatch<Obj>(ACTORS.instagram, { usernames: people.map((p) => p.ig.handle) }, { reuseRunId: process.env.APIFY_REUSE_IG_RUN }),
    liChunks(),
    runActorBatch<Obj>(
      ACTORS.linkedinPosts,
      { targetUrls: people.map((p) => p.li.url), maxPosts: 8, includeReposts: false, includeQuotePosts: true },
      { reuseRunId: process.env.APIFY_REUSE_POSTS_RUN },
    ).catch(() => [] as Obj[]),
  ]);

  const igBy = new Map(igItems.map((i) => [str(pick(i, "username", "inputUrl")).toLowerCase().replace(/.*instagram\.com\//, "").replace(/\/$/, ""), i]));
  const liBy = new Map<string, Obj>();
  for (const raw of liItems) {
    const item = linkedInItem(raw);
    if (!item) continue;
    for (const k of [str(item.publicIdentifier), str(pick(raw, "originalQuery.query", "query.publicIdentifier", "query.query"))])
      if (k) liBy.set(slugOf(k), item);
  }
  const postsBy = new Map<string, Obj[]>();
  for (const p of postItems) {
    const k = slugOf(str(pick(p, "query.targetUrl", "query.profileUrl", "query.url", "query")) || str(pick(p, "author.publicIdentifier")));
    postsBy.set(k, [...(postsBy.get(k) || []), p]);
  }

  const out = new Map<string, Sources | Error>();
  await Promise.all(
    people.map(async ({ li, ig }) => {
      try {
        const instagram = normalizeInstagram(igBy.get(ig.handle), ig.handle);
        // Anything the batch missed gets one individual attempt (with fallback actor).
        const item = liBy.get(slugKey(li.slug)) || (await fetchLinkedInProfile(li.url, li.slug));
        const linkedin = normalizeLinkedIn(item, toPosts(postsBy.get(slugKey(li.slug)) || []), li.url);
        out.set(ig.handle, { linkedin, instagram, scrapedAt: new Date().toISOString() });
      } catch (e) {
        out.set(ig.handle, e instanceof Error ? e : new Error(String(e)));
      }
    }),
  );
  return out;
}
