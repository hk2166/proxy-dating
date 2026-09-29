# Proxy: agents that date for you

> Proxy: paste a LinkedIn + public Instagram. An AI agent reads both, writes the profile, then speed-dates and full-dates every other agent on that person's behalf and ranks who fits best.

| | |
|---|---|
| **Live site** | _add after deploy_ |
| **Demo (finished 26-person run)** | _same site: every profile, date and ranking is already there_ |
| **Video** | _add YouTube link_ |

Every person is represented by an agent. Each agent gets exactly two sources, the person's **LinkedIn** and their **public Instagram**, and nothing else. It reads both, writes a profile (needs, hobbies, interests, values and more), then dates every other agent on that person's behalf. After each date it reports back privately, and those reports become a ranking of who fits that person best.

```
LinkedIn URL ─┐                ┌─ reading notes (signal → inference, per source)
              ├─ Apify scrape ─┤
Instagram URL ┘                └─ profile page: needs · hobbies · interests · values · personality · dealbreakers
                                        │  (private dossier)
                                        ▼
        Round 1: speed dates, every pair, 6 lines, 2 private scorecards
                                        │  top mutual matches
                                        ▼
        Round 2: full dates, agents plan the venue together; a Date Host runs 3 acts
                                        │  private debrief to each person
                                        ▼
        Round 3: each agent reviews all its dates and commits to a final ranking
                                        ▼
                         Ranking: who fits each person best
```

## Technical section: how Instagram and LinkedIn are scraped

Instagram and LinkedIn block plain server-side requests (Instagram's `web_profile_info` returns 401 and LinkedIn returns HTTP 999 from datacenter IPs), so scraping runs on **[Apify](https://apify.com) actors**, which are headless browsers on residential proxies. They're called through Apify's REST API (`run-sync-get-dataset-items` for single live requests, async runs + dataset fetch for batches):

| Source | Actor | What we use |
|---|---|---|
| Instagram | `apify/instagram-profile-scraper` | bio, category, link-in-bio, follower/following/post counts, latest ~12 posts: captions, hashtags, locations, alt text, **post images** (the agent looks at the photos), profile picture. Private accounts are rejected. |
| LinkedIn profile | `harvestapi/linkedin-profile-scraper` (no cookies) | headline, about, location, experience with descriptions, education incl. activities & societies, skills, languages, certifications, volunteering, honors, causes, projects |
| LinkedIn posts | `harvestapi/linkedin-profile-posts` | the 8 most recent original posts |
| LinkedIn fallback | `apimaestro/linkedin-profile-detail` | used automatically if the primary LinkedIn actor fails |

Every actor output is normalized into one schema (`src/lib/types.ts`: `LinkedInProfile`, `InstagramProfile`) and stored with the person. Nothing else is ever fetched about anyone. The live site scrapes one person at a time and retries when the Apify account is at its concurrent-run limit. The seed script scrapes all 26 people with one run per actor.

## The rest of the stack

- **Next.js 16 (App Router) + TypeScript + Tailwind**, deployable on Vercel
- **LLM agents, provider-agnostic** (`src/lib/llm.ts`): one `chat()` for free-text date lines and one `structured()` for notes, profiles and scorecards (zod schemas, validated). Three backends:
  - **Anthropic Claude**: structured outputs, vision, server-side refusal fallback
  - **OpenAI**: strict JSON-schema outputs, vision
  - **DeepSeek**: JSON mode, text only
- **In the committed 26-person example**, profiles were written by **Claude Opus 5.5** (which also looked at each person's Instagram photos). All 325 speed dates, the full dates, the Date Host and every scorecard ran on **OpenAI gpt-5.4**, so every score in the rankings comes from one model. The live site runs on gpt-5.4.
- **Server-Sent Events** stream every scraping step, reading note and date line to the browser as it happens
- **Storage:** the finished example ships as JSON in `data/seed/`. People added live go to Upstash Redis (or `data/live/` locally). A daily cap (`LIVE_DAILY_LIMIT`) guards cost.

## How the agent analyzes a person (`src/lib/analyze.ts`)

1. **Read.** The agent reads each source separately and writes 10–16 reading notes per source. Each note pairs a concrete *signal* (a quote, a role, a caption, a described photo) with an *inference* about them as a partner, tagged hobby / interest / value / need / lifestyle / personality / career / relationship. On Instagram it looks at the images of the most recent posts, not just the captions.
2. **Synthesize.** From the notes plus the raw sources it writes the profile page: a headline, a summary and vibe tags; **needs** (what they need from a partner, and why); **hobbies**, **interests** and **values**, every one citing evidence from a named source; six personality traits scored 0–100; lifestyle (base, pace, social, travel, health, work/life); communication style and how they show care; green flags, friction points and dealbreakers; ideal partner, ideal dates and conversation hooks; the voice the agent will use on dates; an **identity check** (do the two links plausibly belong to the same person?); and a confidence score.
3. **Guardrails.** It uses only the two sources and never invents facts. It never infers orientation, religion, politics, health, ethnicity or appearance.

## How the agents date (`src/lib/dating.ts`)

- **Private information.** Each agent carries its person's profile as a *private dossier*. On a date it sees only its own dossier, the other person's public card (headline, vibe, interests, city) and the conversation. **Every line is a separate model call**, so two independent agents are actually talking. Neither can read the other's needs or dealbreakers.
- **A job, not a chat.** Each agent speaks as its person's stand-in, in their voice. It is instructed to steer toward what *its* person needs, to probe dealbreakers through conversation, to never invent facts, and not to people-please.
- **Round 1: speed dates.** Every pair meets once: 6 lines, alternating, with a deterministic coin flip for who opens. Afterwards each agent privately scores the other *for its own person*: chemistry, values fit, lifestyle fit, shared interests and needs met (0–10 each), an overall score (0–100), whether it would book a second date, the best moment (a quote), its biggest concern and a verdict.
- **Round 2: full dates.** Each person's top mutual matches (geometric mean of both overall scores, +8 when both said yes) go on a real date:
  1. The agents **plan it together**. One proposes something its person would love; the other accepts or tweaks it so it works for them too.
  2. A **Date Host** agent, the only one that can see *both* dossiers, locks the venue and runs three acts:
     - arrival, with a scene;
     - a **question card aimed at a real friction point** it found by comparing the dossiers;
     - a **curveball**: rain, a closed kitchen, or a choice they must make together.
  3. Each agent then writes a **private debrief to its person**, addressed to them by name.
- **Simulation framing.** Most of these public figures have partners. The agents date "as if single" and never bring up real relationships.

## How rankings work (`src/lib/ranking.ts`, `src/lib/decide.ts`)

For person P and candidate Q, every date produces scores:

```
myView    = P's agent's overall score of Q   (full date 65% + speed date 35% when both exist)
theirView = Q's agent's overall score of P   (same blend)
fit       = 0.65 · myView + 0.35 · theirView (+5 if both agents want a second date after a full date)
```

**Round 3: the agent decides.** The formula only produces a shortlist, P's top 8. P's agent then reviews that shortlist side by side: its own scorecards from each date (score, verdict, concern), plus what each candidate's agent concluded about P. It commits to a final order with a reason for each candidate, and writes P a short note naming its pick. That order is the ranking the site shows (★ marks the agent's pick). When two agents independently pick each other, that's a **mutual #1 pick**.

Measured in the committed run: agents said "yes" to a second date after 99% of speed dates and all full dates, so that flag carries almost no signal. The ranking therefore rests on the scores and on the agent's own final call, not on the yes/no flag.

## The people

26 real people, found and verified by us (13 women, 13 men). Each has a personal LinkedIn and a public Instagram, and both links were checked live. See [`data/people.json`](data/people.json). All are public figures, used for illustration. This is a simulation, not a statement about anyone's real relationships, and any profile can be removed from its page.

## Site features

- **`/`**: pool of agents, stats, best dates, and the "add a person" form
- **`/join`**: paste two links and watch it live: scraping → reading notes → profile → 26 simultaneous speed dates → full dates with a host → ranking
- **`/p/[id]`**: profile page: the analysis, how the agent read them (every note and the raw scraped data), all their dates, and their full ranking
- **`/dates`** and **`/dates/[id]`**: every date, with an animated replay of the transcript, how the agents planned it, and both private scorecards and debriefs
- **`/rankings`**: mutual #1 picks, top 3 for everyone, and the full fit matrix
- **`/how`**: this explanation, on the site

## Run it

```bash
npm install
cp .env.example .env        # APIFY_TOKEN + one of OPENAI_API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY
npm run dev                 # the committed 26-person example loads immediately

# rebuild the example from scratch (resumable; checkpoints to data/seed/)
npx tsx --env-file=.env scripts/seed.ts analyze   # scrape + read + profile
npx tsx --env-file=.env scripts/seed.ts speed     # round 1, every pair
npx tsx --env-file=.env scripts/seed.ts full      # round 2, top mutual matches
npx tsx --env-file=.env scripts/seed.ts decide    # round 3, each agent's final ranking
```

## Layout

```
src/lib/scrape.ts     Apify actors → normalized LinkedIn/Instagram
src/lib/analyze.ts    reading notes + profile synthesis
src/lib/dating.ts     speed dates, full dates, Date Host, scorecards
src/lib/ranking.ts    fit formula
src/lib/decide.ts     round 3: the agent's final ranking
src/lib/pipeline.ts   end-to-end for one person (used by the live site)
src/lib/store.ts      seed JSON + live storage (Redis / files)
src/app/api/...       SSE endpoints: /api/people (analyze), /api/people/[id]/dates (date)
scripts/seed.ts       builds the committed example
```
