import { auth } from "@/lib/auth";
import { APP_ROLE } from "@/lib/permissions";

export type CreateOrganizationUserInput = {
  email: string;
  name: string;
  password: string;
  data?: {
    prenom?: string | null;
    postnom?: string | null;
    sexe?: "M" | "F" | string | null;
    telephone?: string | null;
    dateOfBirth?: Date | string | null;
    address?: string | null;
    statusUser?: boolean | string | null;
  };
};

/**
 * Crée un compte applicatif pour l’ajout d’un membre d’organisation.
 *
 * À appeler uniquement après `guardOrganizationMemberPermission(..., { member: ["create"] })`
 * (ou bypass propriétaire plateforme).
 *
 * `auth.api.createUser` relève du plugin admin et exige `user: ["create"]` dès qu’une
 * session est fournie. Les propriétaires / gestionnaires d’org ont `APP_ROLE.USER` +
 * `ORG_ROLE.*` (AC organisation), pas le rôle admin plateforme — d’où l’appel de confiance
 * côté serveur **sans** headers de session (pattern Better Auth pour les createUser serveur).
 */
export async function createUserForOrganizationMember(
  input: CreateOrganizationUserInput,
) {
  return auth.api.createUser({
    body: {
      email: input.email,
      name: input.name,
      password: input.password,
      role: APP_ROLE.USER,
      data: input.data,
    },
  });
}
