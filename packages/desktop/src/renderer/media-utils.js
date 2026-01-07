const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function estimateDecodedSize(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, (base64.length * 3) / 4 - padding);
}

function getSafeImageSrc({ buffer, mimeType }) {
  if (typeof buffer !== "string") {
    return null;
  }

  const trimmed = buffer.trim();
  if (!trimmed || trimmed.length % 4 !== 0 || !BASE64_RE.test(trimmed)) {
    return null;
  }

  const normalizedMimeType = (mimeType || "image/png").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    return null;
  }

  const size = estimateDecodedSize(trimmed);
  if (size === 0 || size > MAX_IMAGE_BYTES) {
    return null;
  }

  return `data:${normalizedMimeType};base64,${trimmed}`;
}

export { getSafeImageSrc };
