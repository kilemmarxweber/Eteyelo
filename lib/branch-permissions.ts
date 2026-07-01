import { authAccessControl, BRANCH_ROLE } from "./permissions";

export const branchRoles = {
  [BRANCH_ROLE.DIRECTEUR]: authAccessControl.newRole({
    branch: ["create", "read", "update", "delete"],
    member: ["read"],
  }),

  [BRANCH_ROLE.RESPONSABLE]: authAccessControl.newRole({
    branch: ["read", "update"],
  }),
};
