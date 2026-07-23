import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { consumeAdminCreatedUserPlainPassword } from "@/lib/admin-created-user-password";
import {
  assertUserCanAcceptOrganizationInvitation,
  assertUserCanJoinOrganization,
  countUserOrganizations,
  getSessionOrganizationContext,
} from "@/lib/auth/org-membership";
import { isAppAdminRole, hasPlatformSupportPrivileges, isPlatformOwnerRole } from "@/lib/permissions";
import { sendNewUserCredentialsEmail } from "@/lib/email/send-new-user-credentials";
import { sendOrganizationInvitationEmail } from "@/lib/email/send-organization-invitation-email";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import {
  getOrganizationInvitationsConfig,
  invitationExpiresAtFromConfig,
  isInvitableRole,
} from "@/lib/invitations/config";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";
import { admin, customSession, organization } from "better-auth/plugins";
import {
  APP_ROLE,
  ALL_ORG_ROLE_SLUGS,
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
        type: "boolean",
        required: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
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
        name: user.name,
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
          const pending = consumeAdminCreatedUserPlainPassword(user.email);
          if (!pending?.password) return;
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { mustChangePassword: true },
            });
            await sendNewUserCredentialsEmail({
              to: user.email,
              name: user.name,
              temporaryPassword: pending.password,
              role: pending.role,
              organizationName: pending.organizationName,
              branchName: pending.branchName,
              branchPhone: pending.branchPhone,
              branchAddress: pending.branchAddress,
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
      adminRoles: [APP_ROLE.OWNER, APP_ROLE.PLATFORM_SUPPORT],
      roles: applicationRoles,
    }),
    organization({
      ac: authAccessControl,
      creatorRole: ORG_ROLE.OWNER,
      allowUserToCreateOrganization: async (user) =>
        isPlatformOwnerRole(user.role),
      organizationLimit: async (user) => {
        if (isPlatformOwnerRole(user.role)) return false;
        if (isAppAdminRole(user.role)) return true;
        if (hasPlatformSupportPrivileges(user.role)) return true;
        const count = await countUserOrganizations(user.id);
        return count >= 1;
      },
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: false,
      sendInvitationEmail: async (data) => {
        await sendOrganizationInvitationEmail({
          to: data.email,
          invitationId: data.id,
          organizationName: data.organization.name,
          role: data.role,
          inviterName: data.inviter.user.name,
        });
      },
      dynamicAccessControl: {
        enabled: true,
      },
      roles: organizationRoles,
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => {
          const name = organization.name?.trim();
          if (!name) {
            throw new Error("Le nom de l’organisation est requis.");
          }
          const existing = await prisma.organization.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) {
            throw new Error(
              "Une organisation avec ce nom existe déjà. Choisissez un autre nom.",
            );
          }
        },
        beforeCreateInvitation: async ({ invitation, organization }) => {
          const config = await getOrganizationInvitationsConfig(organization.id);
          if (!config.enabled) {
            throw new Error(INVITATION_MESSAGES.disabled);
          }

          const role = String(invitation.role ?? "").trim();
          if (!role) {
            throw new Error(INVITATION_MESSAGES.roleRequired);
          }
          if (
            !(ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role) ||
            !isInvitableRole(role, config)
          ) {
            throw new Error(INVITATION_MESSAGES.roleInvalid);
          }

          return {
            data: {
              ...invitation,
              role,
              expiresAt: invitationExpiresAtFromConfig(config),
            },
          };
        },
        beforeAddMember: async ({ user, organization }) => {
          // Les owners plateforme peuvent appartenir à plusieurs organisations.
          if (isPlatformOwnerRole(user.role)) return;
          // Ajout direct : toujours 1 org max (hors invitation).
          await assertUserCanJoinOrganization(user.id, organization.id);
        },
        beforeAcceptInvitation: async ({ user, organization }) => {
          if (isPlatformOwnerRole(user.role)) return;
          // Multi-org uniquement via invitation + config org.
          await assertUserCanAcceptOrganizationInvitation(
            user.id,
            organization.id,
          );
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
        user.role,
      );
      // Récupère les champs additionnels de l'utilisateur
      const userWithFields = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          username: true,
          prenom: true,
          postnom: true,
          sexe: true,
          telephone: true,
          address: true,
          dateOfBirth: true,
          statusUser: true,
          mustChangePassword: true,
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
