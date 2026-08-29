import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  customSessionClient,
  organizationClient,
  inferAdditionalFields, // ← Ajoute ça
} from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import {
  APP_ROLE,
  ORG_ROLE,
  applicationRoles,
  authAccessControl,
  organizationRoles,
} from "@/lib/permissions";

/** Aligné serveur : owner en static, autres rôles via DAC / DB. */
const organizationRolesForClient = {
  [ORG_ROLE.OWNER]: organizationRoles[ORG_ROLE.OWNER],
} as typeof organizationRoles;

function resolveAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
  plugins: [
    adminClient({
      ac: authAccessControl,
      roles: applicationRoles,
    }),
    organizationClient({
      dynamicAccessControl: { enabled: true },
      ac: authAccessControl,
      roles: organizationRolesForClient,
    }),
    customSessionClient<typeof auth>(),
    // Ajoute ce plugin pour inférer les champs additionnels
    inferAdditionalFields<typeof auth>(), // ← Ajoute ça
  ],
});

export const { signIn, signUp, signOut, useSession, updateSession } =
  authClient;
