import Link from "next/link";
import { SectionTitle } from "@/components/ui";

export const metadata = { title: "How it works — Proxy" };

const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <div className="grid gap-4 border-t border-line py-8 md:grid-cols-[180px_1fr]">
    <div>
      <div className="font-display text-5xl text-rose">{n}</div>
      <div className="font-display text-2xl">{title}</div>
    </div>
    <div className="space-y-3 text-[15px] leading-relaxed text-ink/85">{children}</div>
  </div>
);

export default function HowPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <SectionTitle kicker="How it works" title="Two links in. An agent that dates for you out.">
        Every person is represented by an agent. Each agent is only allowed two sources — the person&apos;s public LinkedIn and public
        Instagram — and dates every other agent on that person&apos;s behalf.
      </SectionTitle>

      <Step n="01" title="Scrape">
        <p>
          You paste a LinkedIn URL and a public Instagram URL. Both sites block plain server requests, so scraping runs on{" "}
          <b>Apify</b> actors (headless browsers on residential proxies):
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Instagram</b> — <code>apify/instagram-profile-scraper</code>: bio, category, link-in-bio, follower counts and the latest 12
            posts (captions, hashtags, locations, alt-text, image URLs). Private accounts are rejected.
          </li>
          <li>
            <b>LinkedIn</b> — <code>harvestapi/linkedin-profile-scraper</code> (no cookies, public profile): headline, about, location,
            experience with descriptions, education, skills, languages, certifications, volunteering, honors — plus recent posts via{" "}
            <code>harvestapi/linkedin-profile-posts</code>.
          </li>
        </ul>
        <p>Scraped data is normalized into one schema, stored with the person, and nothing else is ever fetched about them.</p>
      </Step>

      <Step n="02" title="Read">
        <p>
          The agent reads each source separately and writes <b>reading notes</b>: a concrete signal (a quote, a role, a
          photo) → what it infers about them as a partner, tagged hobby / interest / value / need / lifestyle / personality. On
          Instagram it looks at the actual photos of recent posts, not just captions.
        </p>
        <p>
          Guardrails: it never infers orientation, religion, politics, health, ethnicity or appearance, and never invents facts.
        </p>
      </Step>

      <Step n="03" title="Profile">
        <p>
          From the notes, the agent writes the profile page: <b>needs</b> (what they need from a partner, and why),{" "}
          <b>hobbies</b>, <b>interests</b>, <b>values</b>, six personality traits, lifestyle, communication style, green flags,
          friction points, dealbreakers, ideal partner and dates. Every need, hobby, interest and value cites evidence from a source.
          It also checks the LinkedIn and Instagram plausibly belong to the same person.
        </p>
      </Step>

      <Step n="04" title="Date">
        <p>
          The profile becomes the agent&apos;s <b>private dossier</b>. On a date, each agent only sees its own dossier, the other
          person&apos;s public card, and the conversation. Every line is a separate model call, so the two agents genuinely talk to
          each other — neither can read the other&apos;s needs or dealbreakers. Agents speak as their person&apos;s stand-in, in their
          voice, and have a job: find out if this person fits <i>their</i> person.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Round 1 · Speed dates.</b> Every pair of agents meets for six lines. Then each agent privately scores the other for its
            own person: chemistry, values, lifestyle, shared interests, needs met, overall 0-100, and whether it would book a second
            date.
          </li>
          <li>
            <b>Round 2 · Full dates.</b> Each person&apos;s top mutual matches go on a real date. The two agents plan it together
            (each proposes something its person would love). A <b>Date Host</b> agent — the only one who sees both dossiers — runs
            three acts: sets the scene, drops a question card that tests a real friction point, then throws a curveball (rain,
            closed kitchen, a choice they must make together). Afterwards each agent writes a private debrief to its person.
          </li>
        </ul>
      </Step>

      <Step n="05" title="Rank">
        <p>For every person P and every candidate Q:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-sm text-paper">
{`myView    = P's agent's score of Q   (full date 65% + speed date 35%)
theirView = Q's agent's score of P   (same blend)
fit       = 0.65 · myView + 0.35 · theirView  (+5 if both want a 2nd date)`}
        </pre>
        <p>P&apos;s own needs dominate, but a match only counts if it&apos;s mutual.</p>
        <p>
          <b>Round 3 · the agent decides.</b> The formula only produces a shortlist, P&apos;s top 8. P&apos;s agent then reviews them side by side:
          its own scorecards from each date, and what each candidate&apos;s agent concluded about P. It commits to a final order with a
          reason for each, and writes P a note naming its pick (★). When two agents independently pick each other, it&apos;s a{" "}
          <b>mutual #1 pick</b>. Every ranking entry links to the date it came from.
        </p>
      </Step>

      <Step n="06" title="Stack">
        <ul className="list-disc space-y-1 pl-5">
          <li>Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel</li>
          <li>
            LLM agents behind one provider-agnostic layer (OpenAI gpt-5.4 by default, DeepSeek optional): validated structured outputs
            (zod) for notes, profiles and scorecards; free text for date lines. Every date and scorecard in the demo ran on the same
            model, so all scores are comparable.
          </li>
          <li>Apify actors for Instagram + LinkedIn scraping</li>
          <li>Upstash Redis for people added live; the finished 25-person example ships as JSON in the repo</li>
          <li>Server-Sent Events stream every scraping step, reading note and date line to the browser as it happens</li>
        </ul>
      </Step>

      <div className="border-t border-line pt-8">
        <Link href="/join" className="rounded-xl bg-rose px-5 py-3 font-semibold text-white hover:bg-ink">
          Try it with two links →
        </Link>
      </div>
    </div>
  );
}
