export const UNASSIGNED_HOLDER_NAME = 'Unassigned';

export const normalizePersonName = (name?: string | null) => {
  const trimmed = (name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return UNASSIGNED_HOLDER_NAME.toLowerCase();
  }
  return trimmed.toLowerCase();
};

export const displayPersonName = (name?: string | null) => {
  const trimmed = (name || '').trim().replace(/\s+/g, ' ');
  return trimmed || UNASSIGNED_HOLDER_NAME;
};
