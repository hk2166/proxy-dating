import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { DateRecord, Person } from "./types";

// Two layers:
//  - seed: the finished 25-person example, committed to the repo (data/seed/*.json)
//  - live: people added through the website (Upstash Redis in production,
//          JSON files locally)

const SEED_DIR = path.join(process.cwd(), "data", "seed");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

let seedCache: { people: Person[]; dates: DateRecord[]; mtime: number } | null = null;
function seed() {
  const file = path.join(SEED_DIR, "people.json");
  let mtime = 0;
  try {
    mtime = fs.statSync(file).mtimeMs + fs.statSync(path.join(SEED_DIR, "dates.json")).mtimeMs;
  } catch {}
  if (!seedCache || seedCache.mtime !== mtime) {
    seedCache = {
      people: readJson<Person[]>(file, []),
      dates: readJson<DateRecord[]>(path.join(SEED_DIR, "dates.json"), []),
      mtime,
    };
  }
  return seedCache;
}

// ---------------- live backends ----------------
interface LiveBackend {
  people(): Promise<Person[]>;
  putPerson(p: Person): Promise<void>;
  delPerson(id: string): Promise<void>;
  dates(): Promise<DateRecord[]>;
  putDate(d: DateRecord): Promise<void>;
  delDates(ids: string[]): Promise<void>;
  hidden(): Promise<string[]>;
  hide(id: string): Promise<void>;
  bump(key: string, ttlSec: number): Promise<number>;
}

class RedisBackend implements LiveBackend {
  constructor(private r: Redis) {}
  private async all<T>(setKey: string, prefix: string): Promise<T[]> {
    const ids = (await this.r.smembers(setKey)) as string[];
    if (!ids.length) return [];
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100).map((id) => prefix + id);
      const vals = (await this.r.mget(...chunk)) as (T | null)[];
      for (const v of vals) if (v) out.push(v);
    }
    return out;
  }
  people() {
    return this.all<Person>("people", "person:");
  }
  async putPerson(p: Person) {
    await this.r.set("person:" + p.id, p);
    await this.r.sadd("people", p.id);
  }
  async delPerson(id: string) {
    await this.r.del("person:" + id);
    await this.r.srem("people", id);
  }
  dates() {
    return this.all<DateRecord>("dates", "date:");
  }
  async putDate(d: DateRecord) {
    await this.r.set("date:" + d.id, d);
    await this.r.sadd("dates", d.id);
  }
  async delDates(ids: string[]) {
    if (!ids.length) return;
    await this.r.del(...ids.map((i) => "date:" + i));
    await this.r.srem("dates", ...(ids as [string, ...string[]]));
  }
  async hidden() {
    return (await this.r.smembers("hidden")) as string[];
  }
  async hide(id: string) {
    await this.r.sadd("hidden", id);
  }
  async bump(key: string, ttlSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
}

class FileBackend implements LiveBackend {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }
  private f(name: string) {
    return path.join(this.dir, name);
  }
  private load<T>(name: string): Record<string, T> {
    return readJson<Record<string, T>>(this.f(name), {});
  }
  private save(name: string, v: unknown) {
    const tmp = this.f(name + ".tmp");
    fs.writeFileSync(tmp, JSON.stringify(v));
    fs.renameSync(tmp, this.f(name));
  }
  async people() {
    return Object.values(this.load<Person>("people.json"));
  }
  async putPerson(p: Person) {
    const all = this.load<Person>("people.json");
    all[p.id] = p;
    this.save("people.json", all);
  }
  async delPerson(id: string) {
    const all = this.load<Person>("people.json");
    delete all[id];
    this.save("people.json", all);
  }
  async dates() {
    return Object.values(this.load<DateRecord>("dates.json"));
  }
  async putDate(d: DateRecord) {
    const all = this.load<DateRecord>("dates.json");
    all[d.id] = d;
    this.save("dates.json", all);
  }
  async delDates(ids: string[]) {
    const all = this.load<DateRecord>("dates.json");
    for (const id of ids) delete all[id];
    this.save("dates.json", all);
  }
  async hidden() {
    return readJson<string[]>(this.f("hidden.json"), []);
  }
  async hide(id: string) {
    const h = new Set(await this.hidden());
    h.add(id);
    this.save("hidden.json", [...h]);
  }
  private counters = new Map<string, number>();
  async bump(key: string) {
    const n = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, n);
    return n;
  }
}

let backend: LiveBackend | null = null;
function live(): LiveBackend {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) backend = new RedisBackend(new Redis({ url, token }));
  else
    backend = new FileBackend(
      process.env.VERCEL ? "/tmp/agentic-dating" : path.join(process.cwd(), "data", "live"),
    );
  return backend;
}

// ---------------- public API ----------------
export async function listPeople(): Promise<Person[]> {
  const [livePeople, hidden] = await Promise.all([live().people(), live().hidden()]);
  const h = new Set(hidden);
  const byId = new Map<string, Person>();
  for (const p of seed().people) byId.set(p.id, p);
  for (const p of livePeople) byId.set(p.id, p);
  return [...byId.values()]
    .filter((p) => !h.has(p.id))
    .sort((x, y) => (x.origin === y.origin ? x.name.localeCompare(y.name) : x.origin === "seed" ? -1 : 1));
}

export async function getPerson(id: string): Promise<Person | undefined> {
  return (await listPeople()).find((p) => p.id === id);
}

export async function savePerson(p: Person) {
  await live().putPerson(p);
}

export async function listDates(): Promise<DateRecord[]> {
  const people = new Set((await listPeople()).map((p) => p.id));
  const byId = new Map<string, DateRecord>();
  for (const d of seed().dates) byId.set(d.id, d);
  for (const d of await live().dates()) byId.set(d.id, d);
  return [...byId.values()].filter((d) => people.has(d.a) && people.has(d.b));
}

export async function getDate(id: string) {
  return (await listDates()).find((d) => d.id === id);
}

export async function saveDate(d: DateRecord) {
  await live().putDate(d);
}

/** Opt-out: removes a person and every date they were on. */
export async function removePerson(id: string) {
  const person = await getPerson(id);
  if (!person) return;
  if (person.origin === "seed") await live().hide(id);
  else {
    const mine = (await live().dates()).filter((d) => d.a === id || d.b === id).map((d) => d.id);
    await live().delDates(mine);
    await live().delPerson(id);
  }
}

/** Cost guard for the public site: how many new people may be added per day. */
export async function allowLiveRun(): Promise<boolean> {
  const limit = Number(process.env.LIVE_DAILY_LIMIT || 40);
  const n = await live().bump(`live-runs:${new Date().toISOString().slice(0, 10)}`, 60 * 60 * 26);
  return n <= limit;
}

// Used by the offline seed script to write the committed example.
export const seedFiles = {
  dir: SEED_DIR,
  write(people: Person[], dates: DateRecord[]) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
    fs.writeFileSync(path.join(SEED_DIR, "people.json"), JSON.stringify(people, null, 1));
    fs.writeFileSync(path.join(SEED_DIR, "dates.json"), JSON.stringify(dates));
  },
  read() {
    return {
      people: readJson<Person[]>(path.join(SEED_DIR, "people.json"), []),
      dates: readJson<DateRecord[]>(path.join(SEED_DIR, "dates.json"), []),
    };
  },
};
