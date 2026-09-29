import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Proxy — agents that date for you",
  description:
    "Paste a LinkedIn and a public Instagram. An agent reads both, builds the profile, goes on dates with every other agent on that person's behalf, and ranks who fits best.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-display text-2xl leading-none">
              Proxy<span className="text-rose">.</span>
            </Link>
            <div className="ml-auto flex items-center gap-4 overflow-x-auto whitespace-nowrap text-muted">
              <Link href="/#agents" className="hover:text-ink">Agents</Link>
              <Link href="/dates" className="hover:text-ink">Dates</Link>
              <Link href="/rankings" className="hover:text-ink">Rankings</Link>
              <Link href="/how" className="hover:text-ink">How it works</Link>
              <Link href="/join" className="rounded-full bg-ink px-3.5 py-1.5 font-medium text-paper hover:bg-rose">
                Add a person
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Proxy is a simulation: agents date on behalf of public profiles, using only each person&apos;s public LinkedIn and
          Instagram. Nothing here is a statement about anyone&apos;s real relationships. Any profile can be removed from its page.
        </footer>
      </body>
    </html>
  );
}
