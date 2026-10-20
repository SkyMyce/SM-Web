// Verifies the relay's signed release envelope in the browser, mirroring
// relay/src/community-release.ts (verifyCommunityManifest). Pure: no DOM, also used by tools/selftest.mjs.
export const decode64 = value => Uint8Array.from(atob(String(value).replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));

/**
 * @returns {Promise<{ status: "valid" | "invalid" | "unsupported", manifest?: object, reason?: string }>}
 */
export async function verifyRelease(envelope, { keyId, publicKey, minecraft }, now = Date.now(), subtle = globalThis.crypto?.subtle) {
  if (!envelope || typeof envelope !== "object" || !/^[A-Za-z0-9_-]{1,64}$/.test(envelope.kid ?? "")) return { status: "invalid", reason: "malformed envelope" };
  if (envelope.kid !== keyId) return { status: "invalid", reason: `unknown signing key "${envelope.kid}"` };
  let payload, signature, key;
  try { payload = decode64(envelope.payload); signature = decode64(envelope.signature); }
  catch { return { status: "invalid", reason: "invalid encoding" }; }
  if (signature.length !== 64) return { status: "invalid", reason: "invalid signature length" };
  try { key = await subtle.importKey("spki", decode64(publicKey), { name: "Ed25519" }, false, ["verify"]); }
  catch { return { status: "unsupported", reason: "this browser cannot verify Ed25519 signatures" }; }
  if (!await subtle.verify({ name: "Ed25519" }, key, signature, payload)) return { status: "invalid", reason: "signature does not match" };
  let m;
  try { m = JSON.parse(new TextDecoder().decode(payload)); } catch { return { status: "invalid", reason: "payload is not JSON" }; }
  const problems = [
    [m.product !== "sky-myce" || m.protocol !== 4 || m.installation !== "fabric", "not a protocol-4 Fabric release"],
    [m.minecraft !== minecraft, `built for Minecraft ${m.minecraft}, expected ${minecraft}`],
    [!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(m.version) || m.artifact !== `releases/Sky-Myce-${m.version}.jar`, "unexpected version or artifact"],
    [!Number.isSafeInteger(m.size) || m.size < 4 || m.size > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(m.sha256), "invalid size or hash"],
    [!Number.isSafeInteger(m.issuedAt) || !Number.isSafeInteger(m.expiresAt) || m.issuedAt > now + 300000 || m.expiresAt <= m.issuedAt
      || m.expiresAt - m.issuedAt > 14 * 86400000, "invalid validity window"],
    [m.expiresAt <= now, "manifest has expired"],
    [m.notes !== undefined && (typeof m.notes !== "string" || m.notes.length > 8000), "invalid notes"],
  ].find(([bad]) => bad);
  return problems ? { status: "invalid", manifest: m, reason: problems[1] } : { status: "valid", manifest: m };
}
