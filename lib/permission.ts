// lib/permission.ts

export const hasPermission = (user: any, module: string, action: string) => {
  return user?.permissions?.some(
    (p: any) =>
      p.module?.toLowerCase() === module.toLowerCase() &&
      p.action?.toUpperCase() === action.toUpperCase(),
  );
};
