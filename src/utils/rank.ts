export type RankKey = 'novice' | 'helper' | 'expert' | 'master' | 'guru';

const RANKS: { key: RankKey; minPoints: number }[] = [
  { key: 'guru', minPoints: 50 },
  { key: 'master', minPoints: 25 },
  { key: 'expert', minPoints: 10 },
  { key: 'helper', minPoints: 3 },
  { key: 'novice', minPoints: 0 },
];

export function getRank(points: number | undefined): RankKey {
  const p = points ?? 0;
  return RANKS.find((r) => p >= r.minPoints)!.key;
}
