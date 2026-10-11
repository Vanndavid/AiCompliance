export type HolderKind = 'person' | 'organisation';

/// Document types that belong to a business or a site, never to one worker.
const ORGANISATION_DOC_TYPES =
  /insurance|certificate of currency|public liability|workers comp|policy|swms|safe work method|method statement/i;

/// Suffixes and trading words that only appear in company names.
const ORGANISATION_NAMES =
  /\bpty\b|\bltd\b|\bllc\b|\binc\b|\bco\b|company|contracting|constructions?|civil|holdings|group|services|solutions|enterprises|traders|scaffolding|plumbing|electrical/i;

/**
 * A certificate of currency is held by a business and a White Card is held by a
 * person. Grouping both under "crew" makes the list read as nonsense, so each
 * document is classified before it is grouped.
 */
export const classifyHolder = (input: {
  docType?: string | null | undefined;
  holderName?: string | null | undefined;
}): HolderKind => {
  const docType = input.docType || '';
  const holderName = input.holderName || '';

  if (ORGANISATION_DOC_TYPES.test(docType)) {
    return 'organisation';
  }

  if (ORGANISATION_NAMES.test(holderName)) {
    return 'organisation';
  }

  return 'person';
};
