export type FeedContext = {
  myNationality: string;
  following: string[];
};

export function weightedSort<T extends {
  authorNationality: string;
  authorId: string;
  createdAt: any;
}>(items: T[], ctx: FeedContext, getEngagement: (item: T) => number): T[] {
  if (items.length === 0) return items;
  return [...items].sort(
    (a, b) => itemScore(b, ctx, getEngagement) - itemScore(a, ctx, getEngagement),
  );
}

function toMs(createdAt: any): number {
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt?.seconds === 'number') return createdAt.seconds * 1000;
  return Date.now();
}

function itemScore<T extends { authorNationality: string; authorId: string; createdAt: any }>(
  item: T,
  ctx: FeedContext,
  getEngagement: (item: T) => number,
): number {
  const ageHours = (Date.now() - toMs(item.createdAt)) / 3_600_000;
  // Soft decay: ~0.71 at 0 h, ~0.35 at 6 h, ~0.18 at 36 h
  const recency = 1 / Math.sqrt(ageHours + 2);
  // Log-normalized engagement, saturates at ~50 interactions
  const engagement = Math.min(Math.log1p(getEngagement(item)) / Math.log1p(50), 1);
  const isFollowed = ctx.following.includes(item.authorId) ? 1 : 0;
  const isOwn = item.authorNationality === ctx.myNationality ? 1 : 0;

  return recency * 0.35 + engagement * 0.30 + isFollowed * 0.20 + isOwn * 0.15;
}
