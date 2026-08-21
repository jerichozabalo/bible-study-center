/**
 * The Google half of signing in: build the consent URL, spend the code that
 * comes back, hand up an identity. Hand-rolled OIDC rather than a library —
 * one provider, one allowlisted account (#1), and no DB adapter to configure.
 *
 * PKCE is here even though this is a confidential client holding a real client
 * secret. The verifier costs one cookie and closes the window where a code
 * intercepted on the way back to `/auth/callback` is worth anything on its own.
 *
 * On not verifying the id_token's signature: this token is not read out of a
 * URL fragment or a header — it is the body of a response to a POST this
 * process just made to `https://oauth2.googleapis.com/token` over TLS, with
 * the client secret in it. Google's own guidance is that a token received
 * directly from the token endpoint that way may be trusted without re-checking
 * the signature against the JWKS. The claims still have to be read and
 * checked, and are: issuer, audience, expiry, verified address. Change the
 * transport — ever accept an id_token from anywhere but this call — and this
 * paragraph stops being true and the JWKS check has to go in.
 */
import { createHash, randomBytes } from "node:crypto";

import { decodeJwt } from "jose";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * Google mints id_tokens with either issuer, and has for years; both are
 * legitimate and which one arrives is not something a client controls.
 */
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Identity, and only identity — Calendar push is designed but out of v1 (#45). */
const SCOPE = "openid email profile";

export type GoogleIdentity = {
  email: string;
  name?: string;
};

/** RFC 7636 code verifier: 43–128 characters from the unreserved set. */
export function newVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Opaque value tying the callback to the request that started it (CSRF). */
export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export function consentUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: SCOPE,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    // The leader picks the account rather than being silently signed in as
    // whoever the phone's browser last used — which on this machine is the
    // difference between Jericho's account and Caren's.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export async function exchangeCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleIdentity> {
  const doFetch = params.fetchImpl ?? fetch;

  const response = await doFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      code_verifier: params.codeVerifier,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    // `invalid_grant` is the ordinary one: a code already spent, or a stale tab
    // finally submitted. Naming it is what makes the log readable.
    const reason = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Google refused the code exchange: ${reason}`);
  }

  if (typeof body.id_token !== "string") {
    throw new Error("Google's token response carried no id_token");
  }

  const claims = decodeJwt(body.id_token);

  if (typeof claims.iss !== "string" || !ISSUERS.includes(claims.iss)) {
    throw new Error(`id_token has an unexpected issuer: ${String(claims.iss)}`);
  }
  if (claims.aud !== params.clientId) {
    throw new Error("id_token was minted for a different audience");
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
    throw new Error("id_token has expired");
  }
  if (claims.email_verified !== true) {
    throw new Error("Google has not verified that address");
  }
  if (typeof claims.email !== "string" || claims.email.length === 0) {
    throw new Error("id_token carried no email address");
  }

  const identity: GoogleIdentity = { email: claims.email };
  if (typeof claims.name === "string") identity.name = claims.name;
  return identity;
}
