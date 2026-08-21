import { describe, expect, it, vi } from "vitest";

import { challengeFor, consentUrl, exchangeCode, newVerifier } from "./google";

const CONFIG = {
  clientId: "test-client-id.apps.googleusercontent.com",
  clientSecret: "test-client-secret",
  redirectUri: "https://bst.example/auth/callback",
};

/** A Google id_token is a JWT; only its payload matters to this module. */
function idToken(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature-not-checked-here`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CONFIG.clientId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "leader@example.com",
    email_verified: true,
    name: "Jericho Zabalo",
    ...overrides,
  };
}

/** A `fetch` that answers the token endpoint with whatever the test wants. */
function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: ok ? 200 : 400,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("newVerifier / challengeFor", () => {
  it("makes a fresh verifier each time", () => {
    expect(newVerifier()).not.toBe(newVerifier());
  });

  it("makes a verifier inside the RFC 7636 length bounds, url-safe", () => {
    const verifier = newVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("derives an S256 challenge that is stable for a given verifier", () => {
    expect(challengeFor("abc")).toBe(challengeFor("abc"));
    expect(challengeFor("abc")).not.toBe(challengeFor("abd"));
  });

  it("derives the challenge published in RFC 7636's own example", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("consentUrl", () => {
  const url = new URL(
    consentUrl({ ...CONFIG, state: "state-123", codeChallenge: "challenge-abc" }),
  );

  it("points at Google's authorisation endpoint", () => {
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("asks for a code, with PKCE", () => {
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("carries the client, the redirect and the state", () => {
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("state")).toBe("state-123");
  });

  it("asks only for identity — no Calendar, no Drive", () => {
    // Google Calendar push is designed but deliberately out of v1 (#45). A
    // scope requested here would show up on the consent screen as a permission
    // the app never uses.
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });
});

describe("exchangeCode", () => {
  it("posts the code and the PKCE verifier to Google's token endpoint", async () => {
    const fetchImpl = fakeFetch({ id_token: idToken(validClaims()) });

    await exchangeCode({ ...CONFIG, code: "code-xyz", codeVerifier: "verifier-xyz", fetchImpl });

    const [endpoint, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");

    const sent = new URLSearchParams(init.body as string);
    expect(sent.get("code")).toBe("code-xyz");
    expect(sent.get("code_verifier")).toBe("verifier-xyz");
    expect(sent.get("grant_type")).toBe("authorization_code");
    expect(sent.get("client_secret")).toBe(CONFIG.clientSecret);
  });

  it("returns the identity Google vouched for", async () => {
    const fetchImpl = fakeFetch({ id_token: idToken(validClaims()) });

    const identity = await exchangeCode({
      ...CONFIG,
      code: "c",
      codeVerifier: "v",
      fetchImpl,
    });

    expect(identity).toEqual({ email: "leader@example.com", name: "Jericho Zabalo" });
  });

  it("refuses a token minted for another client", async () => {
    const fetchImpl = fakeFetch({ id_token: idToken(validClaims({ aud: "someone-elses-id" })) });

    await expect(
      exchangeCode({ ...CONFIG, code: "c", codeVerifier: "v", fetchImpl }),
    ).rejects.toThrow(/audience/i);
  });

  it("refuses a token from another issuer", async () => {
    const fetchImpl = fakeFetch({ id_token: idToken(validClaims({ iss: "https://evil.tld" })) });

    await expect(
      exchangeCode({ ...CONFIG, code: "c", codeVerifier: "v", fetchImpl }),
    ).rejects.toThrow(/issuer/i);
  });

  it("refuses an expired token", async () => {
    const fetchImpl = fakeFetch({
      id_token: idToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 60 }),
      ),
    });

    await expect(
      exchangeCode({ ...CONFIG, code: "c", codeVerifier: "v", fetchImpl }),
    ).rejects.toThrow(/expired/i);
  });

  it("refuses an unverified address", async () => {
    const fetchImpl = fakeFetch({ id_token: idToken(validClaims({ email_verified: false })) });

    await expect(
      exchangeCode({ ...CONFIG, code: "c", codeVerifier: "v", fetchImpl }),
    ).rejects.toThrow(/verified/i);
  });

  it("reports a refusal from the token endpoint", async () => {
    const fetchImpl = fakeFetch({ error: "invalid_grant" }, false);

    await expect(
      exchangeCode({ ...CONFIG, code: "c", codeVerifier: "v", fetchImpl }),
    ).rejects.toThrow(/invalid_grant/);
  });
});
