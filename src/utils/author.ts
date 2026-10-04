// When someone deletes their account, the Cloud Function keeps the replies and
// comments they left on other people's content — otherwise those threads would
// lose their answers — but strips every author field and stamps this id in place
// of the uid. The visible label lives here rather than in the database so it
// follows the reader's language instead of the deleted user's.
export const DELETED_AUTHOR_ID = 'deleted';

export function isDeletedAuthor(authorId?: string | null): boolean {
  return authorId === DELETED_AUTHOR_ID;
}
