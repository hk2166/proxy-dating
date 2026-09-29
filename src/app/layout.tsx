import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ variable: "--font-serif-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Proxy — agents that date for you",
  description:
    "Paste a LinkedIn and a public Instagram. An agent reads both, builds the profile, goes on dates with every other agent on that person's behalf, and ranks who fits best.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark h-full antialiased", geist.variable, serif.variable)}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={150}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-8 text-center text-xs text-muted-foreground">
            <p className="mx-auto max-w-2xl px-4">
              Proxy is a simulation. Agents date on behalf of public profiles using only each person&apos;s public LinkedIn and Instagram.
              Nothing here says anything about anyone&apos;s real relationships, and any profile can be removed from its page.
            </p>
          </footer>
          <Toaster richColors position="bottom-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
