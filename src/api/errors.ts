/** An error returned by (or while talking to) the Intervals.icu API. */
export class IntervalsApiError extends Error {
  override name = 'IntervalsApiError';

  constructor(
    message: string,
    readonly status: number | undefined,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

const MAX_DETAIL_LENGTH = 300;

/** Builds an actionable, secret-free message for a failed HTTP response. */
export function describeHttpError(
  status: number,
  body: unknown,
  retryAfterSeconds?: number,
): string {
  const detail = extractDetail(body);
  const suffix = detail ? ` Details: ${detail}` : '';
  switch (status) {
    case 401:
      return (
        'Intervals.icu rejected the API key (HTTP 401). Check INTERVALS_ICU_API_KEY — you ' +
        'can create a new key in Intervals.icu → Settings → Developer Settings.'
      );
    case 403:
      return `Access denied (HTTP 403). The API key has no access to this athlete or resource.${suffix}`;
    case 404:
      return `Not found (HTTP 404). Check that the id or date is correct.${suffix}`;
    case 429:
      return (
        'Intervals.icu rate limit reached (HTTP 429).' +
        (retryAfterSeconds ? ` Try again in about ${retryAfterSeconds} s.` : ' Try again later.')
      );
    default:
      if (status >= 500) {
        return `Intervals.icu is having problems (HTTP ${status}). Try again in a moment.${suffix}`;
      }
      return `Intervals.icu rejected the request (HTTP ${status}).${suffix}`;
  }
}

function extractDetail(body: unknown): string | undefined {
  let text: string | undefined;
  if (typeof body === 'string') text = body;
  else if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidate = obj.error ?? obj.message ?? obj.detail;
    text = typeof candidate === 'string' ? candidate : JSON.stringify(body);
  }
  text = text?.trim();
  if (!text) return undefined;
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…` : text;
}

/** Defence in depth: strip a secret from any text before it leaves the process. */
export function redact(text: string, secret: string | undefined): string {
  if (!secret || secret.length < 4) return text;
  return text.split(secret).join('[REDACTED]');
}
