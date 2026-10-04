import { create } from 'zustand';
import { blockUser, unblockUser, fetchBlockLists } from '../services/blockService';

// Two lists, one effect. `blocked` is what I did and the only half I can undo;
// `blockedBy` is what was done to me. Content is hidden on either, so the
// filtering hook reads both and never cares which one matched.
interface BlockState {
  blocked: string[];
  blockedBy: string[];
  load: (uid: string) => Promise<void>;
  block: (myUid: string, targetUid: string) => Promise<void>;
  unblock: (myUid: string, targetUid: string) => Promise<void>;
  reset: () => void;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blocked: [],
  blockedBy: [],

  load: async (uid) => {
    try {
      const { blocked, blockedBy } = await fetchBlockLists(uid);
      set({ blocked, blockedBy });
    } catch {
      // Offline or a denied read: leave the lists empty rather than blank the
      // whole feed. The server refuses interaction between the two either way.
    }
  },

  // Optimistic, like the rest of the app's writes: the content disappears on
  // the tap, and the list is restored if the write fails.
  block: async (myUid, targetUid) => {
    const before = get().blocked;
    if (before.includes(targetUid)) return;
    set({ blocked: [...before, targetUid] });
    try {
      await blockUser(myUid, targetUid);
    } catch (e) {
      set({ blocked: before });
      throw e;
    }
  },

  unblock: async (myUid, targetUid) => {
    const before = get().blocked;
    set({ blocked: before.filter((id) => id !== targetUid) });
    try {
      await unblockUser(myUid, targetUid);
    } catch (e) {
      set({ blocked: before });
      throw e;
    }
  },

  reset: () => set({ blocked: [], blockedBy: [] }),
}));
