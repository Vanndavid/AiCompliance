export const normalizeS3Etag = (etag?: string | null) => {
  if (!etag) {
    return null;
  }
  const normalized = etag.replace(/"/g, '').trim();
  return normalized.length > 0 ? normalized : null;
};
