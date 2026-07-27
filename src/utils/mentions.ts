// Username / @mention helpers, shared by registration, profile editing and the
// four places a mention can be written (post body, discussion body, post
// comments, discussion replies).

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// A mention is @username preceded by start-of-text or a non-word char, so the
// "@" inside an email (foo@bar) is not treated as a mention.
const MENTION_RE = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,20})/g;

const MAX_MENTIONS_PER_MESSAGE = 10;

// Trim + lowercase. Usernames are always stored/compared in lowercase.
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

// Extract the unique, normalized usernames mentioned in a piece of text,
// capped so one message can't fan out to an unbounded number of notifications.
export function parseMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    found.add(match[2].toLowerCase());
    if (found.size >= MAX_MENTIONS_PER_MESSAGE) break;
  }
  return Array.from(found);
}
