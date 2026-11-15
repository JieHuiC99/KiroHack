"use client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

// Same-origin by default, so it works on localhost, Vercel previews and production alike.
export const authClient = createAuthClient({ plugins: [inferAdditionalFields<typeof auth>()] });
export const { signIn, signUp, signOut, useSession } = authClient;
