/**
 * Bytes in and out of the two places the lock has to put them: `localStorage`
 * (salt, hash, credential id) and WebAuthn options (challenge, credential id).
 *
 * base64url rather than plain base64 because both of those are strings that end
 * up in JSON and in structured-clone boundaries, and `+`, `/` and `=` have a
 * habit of being re-encoded by something in between.
 */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * `Uint8Array<ArrayBuffer>` and not plain `Uint8Array`: since TypeScript 5.7 the
 * type is generic over its buffer, and `BufferSource` — what WebCrypto and
 * WebAuthn both take — will not accept the `ArrayBufferLike` default.
 */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** WebCrypto randomness — the salt and the WebAuthn challenge both come from here. */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}
