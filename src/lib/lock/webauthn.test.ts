import { describe, expect, it, vi } from "vitest";

import { toBase64Url } from "./bytes";
import {
  type WebAuthnApi,
  registerPlatformCredential,
  unlockWithPlatformCredential,
} from "./webauthn";

/**
 * WebAuthn cannot be exercised without a real authenticator, so the browser API
 * is injected and mocked here. What these tests pin down is the shape of the
 * request — platform authenticator, `userVerification: 'required'`, the stored
 * credential and no other — and that a cancelled or mismatched assertion is a
 * refusal rather than an exception thrown at the lock screen.
 */

const CREDENTIAL_ID = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function credential(rawId: Uint8Array) {
  return {
    id: toBase64Url(rawId),
    type: "public-key",
    rawId: rawId.buffer.slice(rawId.byteOffset, rawId.byteOffset + rawId.byteLength),
  } as unknown as Credential;
}

function apiWith(overrides: Partial<WebAuthnApi>): WebAuthnApi {
  return {
    create: vi.fn<WebAuthnApi["create"]>(async () => credential(CREDENTIAL_ID)),
    get: vi.fn<WebAuthnApi["get"]>(async () => credential(CREDENTIAL_ID)),
    ...overrides,
  };
}

describe("registerPlatformCredential", () => {
  it("asks for a platform authenticator with user verification required", async () => {
    const create = vi.fn<WebAuthnApi["create"]>(async () => credential(CREDENTIAL_ID));
    const api = apiWith({ create });

    await registerPlatformCredential({ account: "leader@example.com", api });

    const options = create.mock.calls[0][0].publicKey!;
    expect(options.authenticatorSelection?.authenticatorAttachment).toBe("platform");
    expect(options.authenticatorSelection?.userVerification).toBe("required");
    expect(options.rp.name).toBe("Bible Study Tayo");
    expect(options.user.name).toBe("leader@example.com");
    expect(new Uint8Array(options.challenge as ArrayBuffer).byteLength).toBe(32);
  });

  it("returns the credential id, base64url, for the device record", async () => {
    const id = await registerPlatformCredential({
      account: "leader@example.com",
      api: apiWith({}),
    });

    expect(id).toBe(toBase64Url(CREDENTIAL_ID));
  });

  it("returns null when the leader dismisses the prompt", async () => {
    const api = apiWith({
      create: vi.fn<WebAuthnApi["create"]>(async () => {
        throw new DOMException("cancelled", "NotAllowedError");
      }),
    });

    expect(await registerPlatformCredential({ account: "leader@example.com", api })).toBeNull();
  });

  it("returns null when the browser hands back nothing", async () => {
    const api = apiWith({ create: vi.fn<WebAuthnApi["create"]>(async () => null) });

    expect(await registerPlatformCredential({ account: "leader@example.com", api })).toBeNull();
  });
});

describe("unlockWithPlatformCredential", () => {
  it("offers only the credential this device registered", async () => {
    const get = vi.fn<WebAuthnApi["get"]>(async () => credential(CREDENTIAL_ID));
    const api = apiWith({ get });

    await unlockWithPlatformCredential({ credentialId: toBase64Url(CREDENTIAL_ID), api });

    const options = get.mock.calls[0][0].publicKey!;
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials).toHaveLength(1);
    expect(new Uint8Array(options.allowCredentials![0].id as ArrayBuffer)).toEqual(CREDENTIAL_ID);
    expect(new Uint8Array(options.challenge as ArrayBuffer).byteLength).toBe(32);
  });

  it("unlocks when the authenticator answers with that credential", async () => {
    const unlocked = await unlockWithPlatformCredential({
      credentialId: toBase64Url(CREDENTIAL_ID),
      api: apiWith({}),
    });

    expect(unlocked).toBe(true);
  });

  it("refuses an assertion from some other credential", async () => {
    const api = apiWith({ get: vi.fn<WebAuthnApi["get"]>(async () => credential(new Uint8Array([9, 9, 9]))) });

    const unlocked = await unlockWithPlatformCredential({
      credentialId: toBase64Url(CREDENTIAL_ID),
      api,
    });

    expect(unlocked).toBe(false);
  });

  it("refuses, without throwing, when the fingerprint is not recognised", async () => {
    // A failed or cancelled `get()` rejects. The lock screen must fall back to
    // the PIN pad, not blow up in the leader's hands.
    const api = apiWith({
      get: vi.fn<WebAuthnApi["get"]>(async () => {
        throw new DOMException("no", "NotAllowedError");
      }),
    });

    const unlocked = await unlockWithPlatformCredential({
      credentialId: toBase64Url(CREDENTIAL_ID),
      api,
    });

    expect(unlocked).toBe(false);
  });
});
