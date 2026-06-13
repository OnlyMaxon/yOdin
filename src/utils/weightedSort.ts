export function weightedSort<T extends { authorNationality: string }>(
  items: T[],
  nationality: string,
): T[] {
  const own = items.filter((i) => i.authorNationality === nationality);
  const others = items.filter((i) => i.authorNationality !== nationality);
  const out: T[] = [];
  let o = 0;
  let r = 0;
  while (o < own.length || r < others.length) {
    if (o < own.length) out.push(own[o++]);
    if (o < own.length) out.push(own[o++]);
    if (r < others.length) out.push(others[r++]);
  }
  return out;
}
