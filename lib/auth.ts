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
  ORG_ROLE,
  applicationRoles,
  authAccessControl,
  organizationRoles,
} from "@/lib/permissions";

/**
 * Better Auth fusionne (union) les rôles statiques avec OrganizationRole DB.
 * Pour que décocher un privilège retire réellement le droit, seuls les rôles
 * non éditables restent en static — le reste vient de la DB (seed + matrice UI).
 */
const organizationRolesForPlugin = {
  [ORG_ROLE.OWNER]: organizationRoles[ORG_ROLE.OWNER],
} as typeof organizationRoles;

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
      theme: {
        type: "string",
        required: false,
        defaultValue: "light",
        input: false,
      },
      locale: {
        type: "string",
        required: false,
        defaultValue: "fr",
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
  // Autorise :3001 quand Next bascule de port (Origin ≠ BETTER_AUTH_URL).
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ].filter((origin, index, all): origin is string => {
    return Boolean(origin) && all.indexOf(origin) === index;
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail({
        to: user.email,
        phone: (user as { telephone?: string | null }).telephone,
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
              phone:
                (user as { telephone?: string | null }).telephone ||
                pending.phone,
              name: user.name,
              temporaryPassword: pending.password,
              role: pending.role,
              organizationName: pending.organizationName,
              branchName: pending.branchName,
              branchPhone: pending.branchPhone,
              branchAddress: pending.branchAddress,
              organizationId: pending.organizationId,
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
      membershipLimit: 1500,
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
      roles: organizationRolesForPlugin,
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
          const roleRow = await prisma.organizationRole.findUnique({
            where: {
              organizationId_role: {
                organizationId: organization.id,
                role,
              },
            },
            select: { id: true },
          });
          if (!roleRow || !isInvitableRole(role, config)) {
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
      const [organization, userWithFields] = await Promise.all([
        getSessionOrganizationContext(
          user.id,
          session.activeOrganizationId,
          user.role,
        ),
        prisma.user.findUnique({
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
            theme: true,
          },
        }),
      ]);

      let branch = null;
      let branchMemberRole: string | null = null;

      if (session.activeBranchId && organization) {
        branch = await prisma.branch.findFirst({
          where: {
            id: session.activeBranchId,
            organizationId: organization.id,
          },
          select: {
            id: true,
            name: true,
            typebranch: true,
            educationSystem: true,
            isActive: true,
            organizationId: true,
            image: true,
            cycles: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: { cycle: true, isActive: true, sortOrder: true },
            },
          },
        });

        const branchMember = await prisma.branchMember.findFirst({
          where: {
            branchId: session.activeBranchId,
            member: {
              userId: user.id,
              organizationId: organization.id,
            },
            isActive: true,
          },
          select: { role: true },
        });
        branchMemberRole = branchMember?.role ?? null;
      }

      // Fallback 1ʳᵉ branche uniquement s'il n'y a pas de branche active :
      // sinon on écrase activeBranchId et le dashboard URL ≠ session.
      if (!branch && !session.activeBranchId && organization) {
        branch = await prisma.branch.findFirst({
          where: {
            organizationId: organization.id,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            typebranch: true,
            educationSystem: true,
            isActive: true,
            organizationId: true,
            image: true,
            cycles: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: { cycle: true, isActive: true, sortOrder: true },
            },
          },
        });

        if (branch) {
          const branchMember = await prisma.branchMember.findFirst({
            where: {
              branchId: branch.id,
              member: {
                userId: user.id,
                organizationId: organization.id,
              },
              isActive: true,
            },
            select: { role: true },
          });
          branchMemberRole = branchMember?.role ?? null;
        }
      }

      const teacher =
        branch && organization
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
          ...userWithFields,
        },
        session: {
          ...session,
          // Ne jamais remapper vers une autre branche que celle active en DB.
          activeBranchId: session.activeBranchId ?? branch?.id ?? null,
        },
        organization,
        branch,
        branchMemberRole,
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
