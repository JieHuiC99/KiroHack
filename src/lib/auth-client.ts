"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin by default, so it works on localhost, Vercel previews and production alike.
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
