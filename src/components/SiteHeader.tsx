"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#agents", label: "Agents" },
  { href: "/swipe", label: "Play matchmaker" },
  { href: "/dates", label: "Dates" },
  { href: "/afterparty", label: "Afterparty" },
  { href: "/rankings", label: "Rankings" },
  { href: "/how", label: "How it works" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-1.5">
          <span className="grid size-7 place-items-center rounded-full bg-sunset">
            <Flame className="size-4 text-white" />
          </span>
          <span className="font-display text-2xl leading-none">proxy</span>
        </Link>

        <div className="hidden items-center gap-5 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("text-muted-foreground transition hover:text-foreground", path === l.href && "text-foreground")}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="rounded-full bg-sunset text-white hover:opacity-90">
            <Link href="/join">Add someone</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="font-display text-2xl font-normal">proxy</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">
                    {l.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
