import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structured, MODELS, SUPPORTS_VISION } from "./llm";
import type { Analysis, InstagramProfile, LinkedInProfile, PublicCard, Person, ReadingNote, Sources } from "./types";

// ---------------------------------------------------------------------------
// Step 1 — the agent READS each source and writes evidence-backed notes.
// Step 2 — the agent SYNTHESIZES the notes into the profile page.
// ---------------------------------------------------------------------------

const GUARDRAILS = `Hard rules:
- Use ONLY what is in the two sources. Never invent facts, names, places or numbers.
- Never infer or speculate about sexual orientation, religion, politics, health, ethnicity, body or appearance. No attractiveness judgments.
- If a partner/marriage is publicly mentioned, record it neutrally as context — don't speculate beyond it.
- Prefer specific, surprising, human details over generic ones ("runs the Berlin marathon every year" beats "likes fitness").`;

const CATEGORIES = ["hobby", "interest", "value", "need", "lifestyle", "personality", "career", "relationship"] as const;

const NotesSchema = z.object({
  notes: z.array(
    z.object({
      signal: z.string().describe("What you observed: a short quote, role, caption, or a description of a photo"),
      inference: z.string().describe("What it tells you about them as a partner"),
      category: z.enum(CATEGORIES),
    }),
  ),
});

const Ev = z.object({
  source: z.enum(["linkedin", "instagram"]),
  quote: z.string().describe("Short verbatim snippet or concrete description from that source"),
});
const TraitS = z.object({ name: z.string(), detail: z.string(), evidence: z.array(Ev) });

export const AnalysisSchema = z.object({
  headline: z.string().describe("One vivid line: who they are, as a dating profile would put it"),
  summary: z.string().describe("3-4 sentences, warm and specific"),
  vibe: z.array(z.string()).describe("3-5 short vibe tags"),
  needs: z
    .array(z.object({ need: z.string(), why: z.string(), evidence: z.array(Ev) }))
    .describe("4-6 things this person needs from a partner/relationship to thrive"),
  hobbies: z.array(TraitS).describe("What they actually DO in their free time (3-6)"),
  interests: z.array(TraitS).describe("Topics/worlds they care about (3-6)"),
  values: z.array(TraitS).describe("Core values visible in their choices (3-5)"),
  personality: z
    .array(z.object({ trait: z.string(), score: z.number(), note: z.string() }))
    .describe(
      "Exactly these six traits, score 0-100: Adventurousness, Ambition, Social energy, Playfulness, Intellectual curiosity, Groundedness",
    ),
  lifestyle: z.object({
    base: z.string().describe("City/region if stated, else 'Unknown'"),
    pace: z.string(),
    social: z.string(),
    travel: z.string(),
    health: z.string().describe("Fitness/wellness habits visible (not medical)"),
    workLife: z.string(),
  }),
  communicationStyle: z.string(),
  howTheyShowCare: z.string(),
  greenFlags: z.array(z.string()),
  frictionPoints: z.array(z.string()).describe("Honest, kind: what might be hard about dating them"),
  dealbreakers: z.array(z.string()).describe("Likely dealbreakers, inferred from their values"),
  idealPartner: z.string().describe("2-3 sentences describing who would fit them best"),
  idealDates: z.array(z.string()).describe("3 date ideas they'd genuinely love, grounded in their hobbies"),
  conversationHooks: z.array(z.string()).describe("4 specific things to ask/mention on a date"),
  agentVoice: z.string().describe("How their agent should talk when dating on their behalf: tone, humor, pace, phrases"),
  identityCheck: z.object({
    sameLikely: z.boolean().describe("Do the LinkedIn and Instagram plausibly belong to the same person?"),
    note: z.string(),
  }),
  confidence: z.object({ overall: z.number().describe("0-100"), note: z.string() }),
});

export function renderLinkedIn(li: LinkedInProfile): string {
  const lines = [
    `Name: ${li.fullName}`,
    `Headline: ${li.headline}`,
    li.location && `Location: ${li.location}`,
    li.followers && `Followers: ${li.followers}`,
    li.about && `About:\n${li.about}`,
    li.experience.length &&
      "Experience:\n" +
        li.experience
          .slice(0, 12)
          .map(
            (e) =>
              `- ${e.title} @ ${e.company}${e.dates ? ` (${e.dates})` : ""}${e.location ? `, ${e.location}` : ""}${
                e.description ? `\n  ${e.description.slice(0, 500).replace(/\n+/g, " ")}` : ""
              }`,
          )
          .join("\n"),
    li.education.length &&
      "Education:\n" +
        li.education
          .map((e) => `- ${[e.degree, e.field].filter(Boolean).join(", ")} @ ${e.school}${e.dates ? ` (${e.dates})` : ""}${e.activities ? `\n  ${e.activities.slice(0, 300)}` : ""}`)
          .join("\n"),
    li.skills.length && `Skills: ${li.skills.slice(0, 30).join(", ")}`,
    li.languages.length && `Languages: ${li.languages.join(", ")}`,
    li.certifications.length && `Certifications: ${li.certifications.slice(0, 10).join("; ")}`,
    li.volunteering.length && `Volunteering: ${li.volunteering.slice(0, 8).join("; ")}`,
    li.honors.length && `Honors: ${li.honors.slice(0, 8).join("; ")}`,
    li.causes?.length && `Causes they care about: ${li.causes.join(", ")}`,
    li.projects?.length && `Projects:\n${li.projects.slice(0, 6).map((p) => `- ${p}`).join("\n")}`,
    li.posts.length &&
      "Recent LinkedIn posts:\n" + li.posts.slice(0, 8).map((p, i) => `[post ${i + 1}${p.date ? `, ${p.date}` : ""}] ${p.text.slice(0, 700)}`).join("\n"),
  ];
  return lines.filter(Boolean).join("\n\n");
}

export function renderInstagram(ig: InstagramProfile): string {
  const lines = [
    `Handle: @${ig.username}  Name: ${ig.fullName}`,
    `Bio: ${ig.biography || "(empty)"}`,
    ig.category && `Category: ${ig.category}`,
    ig.externalUrl && `Link in bio: ${ig.externalUrl}`,
    `Followers: ${ig.followers ?? "?"}  Following: ${ig.following ?? "?"}  Posts: ${ig.postsCount ?? "?"}`,
    ig.posts.length &&
      "Recent posts:\n" +
        ig.posts
          .map(
            (p, i) =>
              `[post ${i + 1}${p.timestamp ? `, ${p.timestamp.slice(0, 10)}` : ""}${p.type ? `, ${p.type}` : ""}${
                p.location ? `, at ${p.location}` : ""
              }] ${(p.caption || "(no caption)").slice(0, 600)}${p.alt ? `\n  (image description: ${p.alt.slice(0, 200)})` : ""}`,
          )
          .join("\n"),
  ];
  return lines.filter(Boolean).join("\n\n");
}

async function fetchImage(url: string): Promise<Anthropic.Beta.BetaImageBlockParam | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_500_000) return null;
    return {
      type: "image",
      source: { type: "base64", media_type: type as "image/jpeg", data: buf.toString("base64") },
    };
  } catch {
    return null;
  }
}

const READER_SYSTEM = `You are a dating agent. You are about to date on behalf of a real person, so first you must truly understand them.
You get exactly two sources about them: their public LinkedIn and their public Instagram. Right now you are reading ONE of them.

Write reading notes. Each note pairs a concrete signal (quote the text, name the role, or describe the photo) with what it tells you about them as a partner: hobbies, interests, values, needs, lifestyle, personality, career, relationship context.
Read between the lines: career moves reveal risk appetite and values; captions reveal humor and how they talk; photos reveal how they actually spend weekends; what they celebrate reveals what matters.

${GUARDRAILS}

Write 10-16 notes, most revealing first.`;

export async function readLinkedIn(li: LinkedInProfile): Promise<ReadingNote[]> {
  const out = await structured({
    system: READER_SYSTEM,
    user: `SOURCE: LinkedIn (public profile)\n\n${renderLinkedIn(li)}`,
    schema: NotesSchema,
    effort: "medium",
  });
  return out.notes.map((n) => ({ ...n, source: "linkedin" as const }));
}

export async function readInstagram(ig: InstagramProfile): Promise<ReadingNote[]> {
  // With a vision model the agent also looks at the photos of the latest posts.
  const images = SUPPORTS_VISION
    ? ((await Promise.all(ig.posts.filter((p) => p.imageUrl).slice(0, 6).map((p) => fetchImage(p.imageUrl!)))).filter(
        Boolean,
      ) as Anthropic.Beta.BetaImageBlockParam[])
    : [];
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (images.length) {
    content.push({ type: "text", text: `Photos from their ${images.length} most recent posts (in order):` });
    content.push(...images);
  }
  content.push({ type: "text", text: `SOURCE: Instagram (public profile)\n\n${renderInstagram(ig)}` });
  const out = await structured({ system: READER_SYSTEM, user: content, schema: NotesSchema, effort: "medium" });
  return out.notes.map((n) => ({ ...n, source: "instagram" as const }));
}

export async function synthesize(sources: Sources, notes: ReadingNote[]): Promise<Analysis> {
  const system = `You are a dating agent who has just finished reading your person's LinkedIn and Instagram. Now write their profile page — the dossier you will carry into every date on their behalf.
Every need, hobby, interest and value must be backed by evidence quoted from a source. Be insightful, specific, warm and honest — this is what a brilliant matchmaker who did their homework would write.

${GUARDRAILS}`;
  const user = `YOUR READING NOTES
${notes.map((n, i) => `${i + 1}. [${n.source}/${n.category}] ${n.signal} → ${n.inference}`).join("\n")}

SOURCE 1 — LINKEDIN
${renderLinkedIn(sources.linkedin)}

SOURCE 2 — INSTAGRAM
${renderInstagram(sources.instagram)}`;
  return structured({ system, user, schema: AnalysisSchema, model: MODELS.analysis, effort: "high" });
}

export function toCard(p: Person): PublicCard {
  const a = p.analysis;
  return {
    id: p.id,
    name: p.name,
    headline: a?.headline || p.sources?.linkedin.headline || "",
    vibe: a?.vibe || [],
    interests: [...(a?.hobbies || []), ...(a?.interests || [])].slice(0, 6).map((t) => t.name),
    base: a?.lifestyle.base || p.sources?.linkedin.location || "Unknown",
  };
}
