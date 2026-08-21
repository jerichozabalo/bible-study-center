/**
 * The fingerprint half of the lock (#19): a WebAuthn PLATFORM authenticator —
 * the sensor built into the phone — registered once and asked again on unlock.
 *
 * ⚠️ THERE IS NO SERVER SIDE TO THIS, AND THAT IS DELIBERATE. Normal WebAuthn
 * sends the assertion to a server which verifies the signature against a stored
 * public key. Here nothing is verified and nothing is stored server-side: the
 * app asks the device to check the leader's fingerprint, and treats "the device
 * said yes, with the credential we registered" as an unlock. Anyone who can
 * open devtools can call the same unlock path directly and skip it.
 *
 * That is the correct amount of security for what #19 asked for — a gate in
 * front of the UI on a borrowed or lost phone, explicitly NOT encryption. The
 * records live on the server behind a Google session and an allowlist; this
 * protects the ten minutes someone else is holding the unlocked phone, not a
 * forensic adversary with the storage in hand.
 *
 * The browser API is injected so it can be mocked — none of this can be
 * exercised headlessly against a real authenticator.
 */
import { fromBase64Url, randomBytes, toBase64Url } from "./bytes";

export type WebAuthnApi = {
  create(options: CredentialCreationOptions): Promise<Credential | null>;
  get(options: CredentialRequestOptions): Promise<Credential | null>;
};

/** The app's own name, as the fingerprint prompt shows it. */
const RP_NAME = "Bible Study Tayo";

/**
 * A challenge is required by the API and meaningless without a server to check
 * it against — see the note above. Random anyway, because a constant would be
 * a lie a future reader might act on.
 */
function challenge(): Uint8Array<ArrayBuffer> {
  return randomBytes(32);
}

/** `navigator.credentials`, or null where WebAuthn is not available at all. */
export function browserWebAuthn(): WebAuthnApi | null {
  if (typeof window === "undefined") return null;
  if (!window.PublicKeyCredential || !navigator.credentials) return null;
  return navigator.credentials as WebAuthnApi;
}

/** Whether this device has a built-in sensor the leader could use. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!browserWebAuthn()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register this phone's sensor. Returns the credential id to keep on the
 * device, or null if the leader dismissed the prompt or the device refused.
 */
export async function registerPlatformCredential(options: {
  account: string;
  api: WebAuthnApi;
}): Promise<string | null> {
  const { account, api } = options;

  try {
    const credential = await api.create({
      publicKey: {
        challenge: challenge(),
        // No `rp.id`: it defaults to the origin's domain, which is the only
        // domain this app is ever served from and the only one that should be
        // able to ask for this credential.
        rp: { name: RP_NAME },
        user: { id: randomBytes(16), name: account, displayName: account },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          // Not a discoverable credential: the device record holds the id, so
          // there is nothing to be gained from occupying a resident key slot.
          residentKey: "discouraged",
        },
        timeout: 60_000,
        attestation: "none",
      },
    });

    if (!credential) return null;
    return toBase64Url(new Uint8Array((credential as PublicKeyCredential).rawId));
  } catch {
    // NotAllowedError (dismissed), NotSupportedError, or an insecure origin.
    return null;
  }
}

/**
 * Ask the device to verify the leader. True only when the authenticator
 * answered with the very credential this device registered.
 */
export async function unlockWithPlatformCredential(options: {
  credentialId: string;
  api: WebAuthnApi;
}): Promise<boolean> {
  const { credentialId, api } = options;

  try {
    const assertion = await api.get({
      publicKey: {
        challenge: challenge(),
        allowCredentials: [{ type: "public-key", id: fromBase64Url(credentialId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!assertion) return false;
    return toBase64Url(new Uint8Array((assertion as PublicKeyCredential).rawId)) === credentialId;
  } catch {
    // A dismissed prompt or an unrecognised finger rejects; the PIN pad is
    // already on screen behind this, so there is nothing to report.
    return false;
  }
}
