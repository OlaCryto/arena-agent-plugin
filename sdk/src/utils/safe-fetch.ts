const DEFAULT_TIMEOUT = 15_000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/** Fetch with timeout, size limit, and HTTPS enforcement */
export async function safeFetch(
  url: string,
  options: RequestInit & { timeout?: number; maxSize?: number } = {},
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, maxSize = MAX_RESPONSE_SIZE, ...fetchOpts } = options;

  // Enforce HTTPS (allow localhost for dev)
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error(`safeFetch: HTTPS required (got ${parsed.protocol})`);
  }

  // Block private/internal IPs
  const host = parsed.hostname;
  if (isPrivateHost(host)) {
    throw new Error(`safeFetch: blocked request to private/internal host ${host}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal });

    // Check content-length if available
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      throw new Error(`safeFetch: response too large (${contentLength} bytes, max ${maxSize})`);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1") return false; // allowed for dev
  // IPv4 private ranges
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) {
    const second = parseInt(host.split(".")[1], 10);
    if (host.startsWith("172.") && second >= 16 && second <= 31) return true;
    if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  }
  if (host === "0.0.0.0" || host.startsWith("169.254.")) return true;
  // metadata endpoints
  if (host === "metadata.google.internal" || host === "169.254.169.254") return true;
  return false;
}
