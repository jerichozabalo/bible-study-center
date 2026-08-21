/**
 * Every environment variable the app reads, read in one place.
 *
 * Each accessor throws a sentence naming the variable rather than returning
 * undefined, because the failure otherwise surfaces three layers away as a
 * signature that will not verify or a consent URL with `client_id=undefined` in
 * it. A missing secret is a deployment that is not finished, and it should say
 * so in those words.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example for what this deployment still needs.`);
  }
  return value;
}

export function sessionSecret(): string {
  const secret = required("SESSION_SECRET");
  // HS256 with a short key is a signature anyone can forge offline, and the
  // session is the only thing standing between a stranger and the roster.
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return secret;
}

export function googleClientId(): string {
  return required("GOOGLE_CLIENT_ID");
}

export function googleClientSecret(): string {
  return required("GOOGLE_CLIENT_SECRET");
}

export function allowedEmails(): string | undefined {
  // Not `required`: an unset allowlist is a real (misconfigured) state, and
  // `isAllowed` already fails closed on it. Throwing here would turn a locked
  // door into a stack trace.
  return process.env.ALLOWED_EMAILS;
}
