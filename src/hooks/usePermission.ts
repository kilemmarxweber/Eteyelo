import { hasPermission } from "@/lib/permission";

export function usePermission(user: any, basePath?: string) {
  const scoped = (action: string) => {
    if (!basePath) return false;

    const moduleName = basePath.split("/").pop();
    if (!moduleName) return false;

    return hasPermission(user, moduleName, action);
  };

  return {
    canCreate: (module?: string) =>
      module ? hasPermission(user, module, "CREATE") : scoped("CREATE"),

    canRead: (module?: string) =>
      module ? hasPermission(user, module, "READ") : scoped("READ"),

    canUpdate: (module?: string) =>
      module ? hasPermission(user, module, "UPDATE") : scoped("UPDATE"),

    canDelete: (module?: string) =>
      module ? hasPermission(user, module, "DELETE") : scoped("DELETE"),

    canManage: (module?: string) =>
      module ? hasPermission(user, module, "MANAGE") : scoped("MANAGE"),
  };
}
