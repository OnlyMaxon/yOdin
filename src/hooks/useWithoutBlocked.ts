import { useMemo } from 'react';
import { useBlockStore } from '../store/useBlockStore';

// Blocked authors are filtered here rather than in the query: Firestore's
// `not-in` caps at ten values, so the block list cannot go into the request.
// Filtering at render (instead of when a list is stored) means a block takes
// effect on the tap, with no refresh.
//
// Consequence worth knowing: a page of 20 sometimes shows fewer, and counters
// like replyCount still include hidden items — they are shared by every reader
// and cannot reflect one person's block list.
export function useWithoutBlocked<T>(items: T[], authorIdOf: (item: T) => string | undefined | null): T[] {
  const blocked = useBlockStore((s) => s.blocked);
  const blockedBy = useBlockStore((s) => s.blockedBy);

  return useMemo(() => {
    if (blocked.length === 0 && blockedBy.length === 0) return items;
    const hidden = new Set([...blocked, ...blockedBy]);
    return items.filter((item) => {
      const id = authorIdOf(item);
      return !id || !hidden.has(id);
    });
    // authorIdOf is a literal arrow at every call site, so it is deliberately
    // not a dependency — including it would rebuild the list on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, blocked, blockedBy]);
}
