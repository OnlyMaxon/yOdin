// Firestore's `in` operator takes at most 30 values, and the nationality
// filter is built straight into an `in` clause on `authorNationality`. The cap
// therefore belongs to the query, not to the UI — but the UI has to know it,
// because the alternative is what used to happen: a 31st selection made the
// clause unusable, it was dropped, and the feed quietly went back to showing
// every nationality while the filter chips still said otherwise.
//
// This mattered little while the picker held 44 countries. With every country
// in the world in it, reaching 31 is a few taps.
export const MAX_NATION_FILTER = 30;
