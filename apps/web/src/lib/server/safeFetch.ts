import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";


export class FetchError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivate(mapped) : false;
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:") throw new FetchError("Only https links are supported.");
  if (url.port && url.port !== "443") throw new FetchError("Links with custom ports are not supported.");
  const host = url.hostname;
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new FetchError(`Could not find ${host}.`, 404);
  if (addrs.some((a) => isPrivate(a.address))) throw new FetchError("That address is not allowed.");
}

/**
 * Fetches a public https URL for the server. Blocks private/internal addresses (SSRF),
 * re-checks every redirect, caps size and time.
 */
export async function safeFetch(raw: string, accept = "text/html,application/json", maxBytes = 3 * 1024 * 1024): Promise<{ url: string; status: number; contentType: string; body: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("That doesn't look like a link.");
  }
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Accept: accept, "User-Agent": "CVTunerBot/1.0 (+https://techswitch.in/cvtuner)" },
      signal: AbortSignal.timeout(12_000),
    }).catch((e: Error) => {
      throw new FetchError(`Could not open the link: ${e.message}`, 502);
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new FetchError("That page is too large to read.", 413);
      }
      chunks.push(value);
    }
    const body = new TextDecoder().decode(Buffer.concat(chunks));
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new FetchError("Too many redirects.", 502);
}
