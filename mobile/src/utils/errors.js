/**
 * Robust error message extractor for Nakama JS SDK errors.
 * The SDK throws ApiResponseError whose properties are non-enumerable,
 * so JSON.stringify(e) → '{}'. We probe every known shape.
 */

// Friendly translations for common Nakama / HTTP status codes
const STATUS_MESSAGES = {
  400: 'Invalid request – check your inputs.',
  401: 'Incorrect email or password.',
  403: 'Access denied.',
  404: 'Account not found. Try signing up.',
  409: 'Email already registered. Please log in instead.',
  429: 'Too many attempts. Please wait a moment.',
  500: 'Server error. Please try again later.',
  502: 'Server is unavailable. Check your connection.',
  503: 'Server is unavailable. Check your connection.',
};

export function cleanErr(e) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return tryParseNakamaJson(e) ?? friendly(e);

  // Standard .message — check FIRST before HTTP status lookup.
  // On web, Nakama SDK puts the raw JSON body in .message,
  // e.g. '{"code":3,"message":"Password must be at least 8 characters long."}'
  const rawMsg = e.message ?? Object.getOwnPropertyDescriptor(e, 'message')?.value;
  if (rawMsg && typeof rawMsg === 'string' && rawMsg !== '{}') {
    const parsed = tryParseNakamaJson(rawMsg);
    if (parsed) return parsed;
    // Only use the string directly if it's not a raw JSON blob we couldn't parse
    if (!rawMsg.startsWith('{')) return friendly(rawMsg);
  }

  // Check HTTP status (fallback when no specific message found)
  const status = e.status ?? e.statusCode ?? e.statusText?.match?.(/\d+/)?.[0];
  const statusNum = parseInt(status, 10);
  if (STATUS_MESSAGES[statusNum]) return STATUS_MESSAGES[statusNum];

  // Nakama gRPC detail fields
  if (e.grpc_status_details) return friendly(String(e.grpc_status_details));
  if (e.error && typeof e.error === 'string') {
    const parsed = tryParseNakamaJson(e.error);
    if (parsed) return parsed;
    return friendly(e.error);
  }

  // HTTP fetch text
  if (e.statusText && typeof e.statusText === 'string') {
    return `HTTP ${statusNum || ''} ${e.statusText}`.trim();
  }

  // toString (works for many Error subclasses)
  const str = String(e);
  if (str && str !== '[object Object]') {
    const parsed = tryParseNakamaJson(str);
    if (parsed) return parsed;
    // Parse common patterns: "HTTP 409: Conflict" → look up table
    const codeMatch = str.match(/\b(\d{3})\b/);
    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);
      if (STATUS_MESSAGES[code]) return STATUS_MESSAGES[code];
    }
    return friendly(str);
  }

  return 'Something went wrong. Check your server connection.';
}

/**
 * If the string is a Nakama JSON error body like {"code":3,"message":"..."}, extract the message.
 * Returns null if the string is not a Nakama JSON error.
 */
function tryParseNakamaJson(str) {
  if (!str || !str.includes('"message"')) return null;
  try {
    const obj = JSON.parse(str);
    if (obj && typeof obj.message === 'string' && obj.message) {
      return friendly(obj.message);
    }
  } catch (_) {}
  return null;
}

/**
 * Async version of cleanErr. Use this for errors caught from Nakama SDK calls.
 * The Nakama SDK (2.8.0) throws the raw fetch Response object, whose body is a
 * one-time readable stream. We must await .json() here before extracting the message.
 */
export async function cleanErrAsync(e) {
  if (!e) return 'Unknown error';
  // Detect raw fetch Response (Nakama SDK throws this on non-2xx responses)
  if (typeof e.json === 'function') {
    try {
      const body = await e.json();
      const msg = body?.message || body?.error;
      if (msg && typeof msg === 'string') {
        return msg.charAt(0).toUpperCase() + msg.slice(1);
      }
      // Fallback: use HTTP status from the Response
      if (e.status) {
        const s = STATUS_MESSAGES[e.status];
        if (s) return s;
        return `Request failed (HTTP ${e.status})`;
      }
    } catch (_) {}
  }
  // WebSocket errors throw generic Event objects often
  if (e && typeof e.type === 'string' && e.type === 'error') {
    return 'Network connection dropped. Please check the server.';
  }
  if (e && e.toString && e.toString() === '[object Event]') {
      return 'Network connection dropped.';
  }
  return cleanErr(e);
}

function friendly(msg) {
  if (!msg) return msg;
  // Nakama raw error strings sometimes look like "statusCode=409 reason=Conflict"
  const codeMatch = msg.match(/\b(\d{3})\b/);
  if (codeMatch) {
    const code = parseInt(codeMatch[1], 10);
    if (STATUS_MESSAGES[code]) return STATUS_MESSAGES[code];
  }
  // Capitalise first letter
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}
