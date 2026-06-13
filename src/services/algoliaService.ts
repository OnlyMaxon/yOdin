import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.EXPO_PUBLIC_ALGOLIA_APP_ID ?? '';
const SEARCH_KEY = process.env.EXPO_PUBLIC_ALGOLIA_SEARCH_KEY ?? '';
const INDEX = 'discussions';

const readClient = algoliasearch(APP_ID, SEARCH_KEY);

export type AlgoliaHit = {
  objectID: string;
  question: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  authorNationality: string;
  authorCountryCode: string;
  location: string;
  replyCount: number;
  createdAt: number;
  acceptedReplyId?: string;
};

export async function searchDiscussions(query: string, location: string): Promise<AlgoliaHit[]> {
  const result = await readClient.searchSingleIndex({
    indexName: INDEX,
    searchParams: {
      query,
      tagFilters: [location],
      hitsPerPage: 50,
      attributesToRetrieve: [
        'objectID',
        'question',
        'authorId',
        'authorName',
        'authorPhoto',
        'authorNationality',
        'authorCountryCode',
        'location',
        'replyCount',
        'createdAt',
        'acceptedReplyId',
      ],
    },
  });
  return result.hits as unknown as AlgoliaHit[];
}
