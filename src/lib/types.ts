// Shared data model. Everything the site shows is derived from exactly two
// sources per person: their LinkedIn and their Instagram.

export type SourceName = "linkedin" | "instagram";

export interface InstagramPost {
  caption: string;
  hashtags: string[];
  location?: string;
  type?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  alt?: string;
  imageUrl?: string;
  url?: string;
}

export interface InstagramProfile {
  username: string;
  url: string;
  fullName: string;
  biography: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  verified?: boolean;
  private?: boolean;
  category?: string;
  externalUrl?: string;
  profilePic?: string;
  posts: InstagramPost[];
}

export interface LinkedInRole {
  title: string;
  company: string;
  dates?: string;
  location?: string;
  description?: string;
}

export interface LinkedInEducation {
  school: string;
  degree?: string;
  field?: string;
  dates?: string;
  activities?: string;
}

export interface LinkedInProfile {
  url: string;
  fullName: string;
  headline: string;
  about: string;
  location?: string;
  followers?: number;
  pictureUrl?: string;
  experience: LinkedInRole[];
  education: LinkedInEducation[];
  skills: string[];
  languages: string[];
  certifications: string[];
  volunteering: string[];
  honors: string[];
  causes: string[];
  projects: string[];
  posts: { text: string; date?: string }[];
}

export interface Sources {
  linkedin: LinkedInProfile;
  instagram: InstagramProfile;
  scrapedAt: string;
}

export interface Evidence {
  source: SourceName;
  quote: string;
}

export interface ReadingNote {
  source: SourceName;
  signal: string; // what the agent saw (quote / post / role)
  inference: string; // what it concluded
  category:
    | "hobby"
    | "interest"
    | "value"
    | "need"
    | "lifestyle"
    | "personality"
    | "career"
    | "relationship";
}

export interface Trait {
  name: string;
  detail: string;
  evidence: Evidence[];
}

export interface Analysis {
  headline: string;
  summary: string;
  vibe: string[];
  needs: { need: string; why: string; evidence: Evidence[] }[];
  hobbies: Trait[];
  interests: Trait[];
  values: Trait[];
  personality: { trait: string; score: number; note: string }[];
  lifestyle: {
    base: string;
    pace: string;
    social: string;
    travel: string;
    health: string;
    workLife: string;
  };
  communicationStyle: string;
  howTheyShowCare: string;
  greenFlags: string[];
  frictionPoints: string[];
  dealbreakers: string[];
  idealPartner: string;
  idealDates: string[];
  conversationHooks: string[];
  agentVoice: string;
  identityCheck: { sameLikely: boolean; note: string };
  confidence: { overall: number; note: string };
}

/** Round 3: the agent's final call after all its dates. */
export interface Decision {
  order: string[]; // shortlisted person ids, best first
  reasons: Record<string, string>;
  note: string; // addressed to the person, names the pick
  model?: string;
  at: string;
}

export interface Person {
  id: string;
  name: string;
  linkedinUrl: string;
  instagramUrl: string;
  avatar?: string; // /avatars/x.jpg or data: URL
  voice?: string; // tts voice for date audio
  origin: "seed" | "live";
  createdAt: string;
  sources?: Sources;
  reading?: ReadingNote[];
  analysis?: Analysis;
  decision?: Decision;
  status: "scraping" | "reading" | "ready" | "failed";
  error?: string;
}

export type Speaker = "a" | "b" | "host";

export interface DateMessage {
  speaker: Speaker;
  text: string;
  at?: number; // ms since date start, for replay pacing
}

export interface Scorecard {
  chemistry: number;
  valuesFit: number;
  lifestyleFit: number;
  interestOverlap: number;
  needsMet: number;
  overall: number; // 0-100: how good is the OTHER person for MY principal
  secondDate: boolean;
  highlight: string;
  concern: string;
  verdict: string;
  reportToPrincipal?: string;
}

export interface DateRecord {
  id: string;
  kind: "speed" | "full";
  a: string; // person id
  b: string;
  venue?: string;
  plan?: { a: string; b: string };
  messages: DateMessage[];
  scoreA?: Scorecard; // A's agent's private scorecard of B
  scoreB?: Scorecard; // B's agent's private scorecard of A
  createdAt: string;
  model?: string;
}

export interface RankEntry {
  personId: string;
  fit: number;
  myView: number; // how my agent rated them
  theirView: number; // how their agent rated me
  mutual: boolean;
  fullDate: boolean;
  reason: string;
  highlight: string;
  dateIds: string[];
  agentRank?: number; // position the agent chose in Round 3 (1 = its pick)
}

// Card = what an agent can see of someone before the date (like a dating-app profile)
export interface PublicCard {
  id: string;
  name: string;
  headline: string;
  vibe: string[];
  interests: string[];
  base: string;
}

// ---- extras ----

export interface Curveball {
  id: string;
  twist: string;
  scene: string;
  messages: DateMessage[];
  react: { a: { delta: number; line: string }; b: { delta: number; line: string } };
  at: string;
}

export interface Afterparty {
  gossip: { from: string; text: string }[]; // from = person id or "host"
  rejections: { from: string; to: string; text: string }[];
  futures: { a: string; b: string; captions: { when: string; text: string }[] }[];
}
