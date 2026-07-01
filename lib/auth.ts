import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { consumeAdminCreatedUserPlainPassword } from "@/lib/admin-created-user-password";
import {
  assertUserCanJoinOrganization,
  countUserOrganizations,
  getSessionOrganizationContext,
} from "@/lib/auth/org-membership";
import { isAppAdminRole } from "@/lib/permissions";
import { sendNewUserCredentialsEmail } from "@/lib/email/send-new-user-credentials";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { admin, customSession, organization } from "better-auth/plugins";
import {
  APP_ROLE,
  ORG_ROLE,
  applicationRoles,
  authAccessControl,
  organizationRoles,
} from "@/lib/permissions";

const authOptions = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }), // Ajoute les champs additionnels au modèle User
  // UN SEUL bloc user qui contient tout
  user: {
    // Champs additionnels
    additionalFields: {
      prenom: {
        type: "string",
        required: false,
      },
      postnom: {
        type: "string",
        required: false,
      },
      sexe: {
        type: "string",
        required: false,
      },
      telephone: {
        type: "string",
        required: false,
      },
      dateOfBirth: {
        type: "date",
        required: false,
      },
      address: {
        type: "string",
        required: false,
      },
      statusUser: {
        type: "string",
        required: false,
      },
    },
    // Configuration changeEmail
    changeEmail: {
      enabled: true,
    },
    // Tu peux aussi ajouter deleteUser ici si besoin
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    // Ajoute ce bloc pour déclarer le champ custom
    additionalFields: {
      activeBranchId: {
        type: "string",
        required: false,
        defaultValue: null,
      },
    },
  },
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail({
        to: user.email,
        url,
      });
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user?.email) return;
          const plain = consumeAdminCreatedUserPlainPassword(user.email);
          if (!plain) return;
          try {
            await sendNewUserCredentialsEmail({
              to: user.email,
              name: user.name,
              temporaryPassword: plain,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              "[databaseHooks.user.create.after] envoi email nouveau compte:",
              err,
            );
          }
        },
      },
    },
  },
  plugins: [
    admin({
      ac: authAccessControl,
      defaultRole: APP_ROLE.USER,
      adminRoles: [APP_ROLE.ADMIN],
      roles: applicationRoles,
    }),
    organization({
      ac: authAccessControl,
      creatorRole: ORG_ROLE.OWNER,
      allowUserToCreateOrganization: async (user) => isAppAdminRole(user.role),
      organizationLimit: async (user) => {
        if (isAppAdminRole(user.role)) return false;
        const count = await countUserOrganizations(user.id);
        return count >= 1;
      },
      dynamicAccessControl: {
        enabled: true,
      },
      roles: organizationRoles,
      organizationHooks: {
        beforeAddMember: async ({ user, organization }) => {
          await assertUserCanJoinOrganization(user.id, organization.id);
        },
        beforeAcceptInvitation: async ({ user, organization }) => {
          await assertUserCanJoinOrganization(user.id, organization.id);
        },
      },
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),

    customSession(async ({ user, session }) => {
      const organization = await getSessionOrganizationContext(
        user.id,
        session.activeOrganizationId,
      );
      // Récupère les champs additionnels de l'utilisateur
      const userWithFields = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          prenom: true,
          postnom: true,
          sexe: true,
          telephone: true,
          address: true,
          dateOfBirth: true,
          statusUser: true,
          // ... autres champs
        },
      });
      let branch = null;

      if (session.activeBranchId && organization) {
        branch = await prisma.branch.findFirst({
          where: {
            id: session.activeBranchId,
            organizationId: organization.id,
          },
        });
      }

      if (!branch && organization) {
        branch = await prisma.branch.findFirst({
          where: {
            organizationId: organization.id,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        });
      }

      const teacher = branch && organization
        ? await prisma.teacher.findFirst({
            where: {
              branchMember: {
                branchId: branch.id,
                member: {
                  userId: user.id,
                  organizationId: organization.id,
                },
              },
            },
            select: {
              id: true,
              teaching: {
                where: {
                  OR: [{ branchId: branch.id }, { branchId: null }],
                  titulaire: true,
                },
                select: {
                  id: true,
                },
                take: 1,
              },
            },
          })
        : null;

      return {
        user: {
          ...user,
          // Fusionne les champs additionnels
          ...userWithFields,
        },
        session: {
          ...session,
          activeBranchId: branch?.id ?? session.activeBranchId ?? null,
        },
        organization,
        branch,
        teacherContext: teacher
          ? {
              teacherId: teacher.id,
              isTitulaire: teacher.teaching.length > 0,
            }
          : null,
      };
    }, authOptions),
  ],
});
