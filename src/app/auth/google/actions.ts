"use server";

/**
 * The "Continue with Google" button, as a server action rather than a click
 * handler.
 *
 * The button could call out from the browser, but then the PKCE verifier would
 * have to live somewhere the browser can write and the server can read on the
 * way back — which is either an unprotected cookie or session storage the
 * callback route cannot see. Started here, the verifier goes straight into an
 * HttpOnly cookie that `/auth/callback` reads and spends, the button is an
 * ordinary form post, and sign-in works with no JavaScript at all.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { challengeFor, consentUrl, newState, newVerifier } from "@/lib/auth/google";
import {
  NEXT_COOKIE,
  PKCE_COOKIE,
  STATE_COOKIE,
  TRIP_SECONDS,
  cookieOptions,
  requestOrigin,
} from "@/lib/auth/trip";
import { googleClientId } from "@/lib/env";
import { sameOriginPath } from "@/lib/safe-path";

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const verifier = newVerifier();
  const state = newState();
  const next = sameOriginPath(formData.get("next")?.toString(), "/");

  // The same origin decides both the cookies' Secure flag and the redirect_uri,
  // so the two can never disagree about which deployment this is.
  const origin = await requestOrigin();
  const trip = { ...cookieOptions(origin), maxAge: TRIP_SECONDS };

  const jar = await cookies();
  jar.set(PKCE_COOKIE, verifier, trip);
  jar.set(STATE_COOKIE, state, trip);
  jar.set(NEXT_COOKIE, next, trip);

  redirect(
    consentUrl({
      clientId: googleClientId(),
      redirectUri: new URL("/auth/callback", origin).toString(),
      state,
      codeChallenge: challengeFor(verifier),
    }),
  );
}
