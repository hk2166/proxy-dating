import Link from "next/link";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Heading, PersonAvatar } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firstName } from "@/lib/names";
import { getAfterparty } from "@/lib/store";
import { cn } from "@/lib/utils";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";
export const metadata = { title: "The afterparty — Proxy" };

export default async function AfterpartyPage() {
  const party = getAfterparty();
  const w = await loadWorld();
  if (!party) return <p className="py-32 text-center text-muted-foreground">The afterparty hasn&apos;t started yet.</p>;
  const who = (id: string) => w.byId.get(id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Heading kicker="The afterparty" title="What the agents said once the humans went to bed">
        After the whole night of dating, the agents hang out. They gossip in a group chat, send &ldquo;let&apos;s just be friends&rdquo; texts, and
        imagine their couples&apos; future. Nobody asked them to. They did it anyway.
      </Heading>

      <Tabs defaultValue="chat">
        <TabsList className="mb-6">
          <TabsTrigger value="chat">Group chat</TabsTrigger>
          <TabsTrigger value="rejections">Rejection pile ({party.rejections.length})</TabsTrigger>
          <TabsTrigger value="future">Their future ({party.futures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card className="mx-auto max-w-2xl py-0">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex -space-x-2">
                {[...new Set(party.gossip.map((m) => m.from))]
                  .filter((id) => id !== "host")
                  .slice(0, 5)
                  .map((id) => who(id) && <PersonAvatar key={id} person={who(id)!} className="size-7" ring />)}
              </div>
              <div>
                <div className="text-sm font-medium">agents after dark 🍸</div>
                <div className="text-xs text-muted-foreground">{new Set(party.gossip.map((m) => m.from)).size - 1} agents · humans not invited</div>
              </div>
            </div>
            <CardContent className="space-y-3 py-5">
              {party.gossip.map((m, i) => {
                if (m.from === "host")
                  return (
                    <div key={i} className="text-center text-xs text-muted-foreground">
                      {m.text}
                    </div>
                  );
                const p = who(m.from);
                if (!p) return null;
                const prevSame = party.gossip[i - 1]?.from === m.from;
                return (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-8">{!prevSame && <PersonAvatar person={p} className="size-8" />}</div>
                    <div className="max-w-[85%]">
                      {!prevSame && <div className="mb-0.5 px-1 text-[11px] text-muted-foreground">{firstName(p.name)}&apos;s agent</div>}
                      <div className="rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-sm leading-relaxed">{m.text}</div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                <MessageCircle className="size-3.5" /> read-only. You&apos;re a human.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejections">
          <p className="mb-4 text-sm text-muted-foreground">Every agent wrote one gentle no to the person it ranked last.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {party.rejections.map((r) => {
              const from = who(r.from);
              const to = who(r.to);
              if (!from || !to) return null;
              return (
                <Card key={r.from}>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PersonAvatar person={from} className="size-6" />
                      {firstName(from.name)}&apos;s agent
                      <Send className="size-3" />
                      <PersonAvatar person={to} className="size-6" />
                      {firstName(to.name)}&apos;s agent
                    </div>
                    <div className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-md bg-primary/85 px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                      {r.text}
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">delivered · left on read</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="future">
          <p className="mb-4 text-sm text-muted-foreground">
            For every mutual #1 couple, the agents drafted the Instagram captions they&apos;d post years from now. Fiction, obviously.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {party.futures.map((f) => {
              const a = who(f.a);
              const b = who(f.b);
              if (!a || !b) return null;
              return (
                <Card key={f.a + f.b} className="py-0">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <div className="flex -space-x-2">
                      <PersonAvatar person={a} className="size-8" ring />
                      <PersonAvatar person={b} className="size-8" ring />
                    </div>
                    <div className="text-sm font-medium">
                      {firstName(a.name).toLowerCase()}.and.{firstName(b.name).toLowerCase()}
                    </div>
                    <Badge variant="secondary" className="ml-auto font-normal">
                      simulated
                    </Badge>
                  </div>
                  <CardContent className="space-y-4 py-4">
                    {f.captions.map((c, i) => (
                      <div key={i} className={cn("space-y-1", i > 0 && "border-t pt-4")}>
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Heart className="size-3.5 fill-primary" /> {c.when}
                        </div>
                        <p className="text-sm leading-relaxed">{c.text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm">
            <Link href="/rankings" className="text-primary hover:underline">
              See how they matched →
            </Link>
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
