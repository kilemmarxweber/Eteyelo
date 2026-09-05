import { usePathname } from "next/navigation";

function normalizePath(path: string) {
  if (!path || path === "#") return "";
  return path.replace(/\/$/, "") || "/";
}

/**
 * Segments sous `/teacher` qui ne sont pas un dossier enseignant.
 * Sinon `/admin/teacher` active le menu Utilisateurs sur l'horaire global.
 */
const TEACHER_LIST_EXCLUDED_SEGMENTS = new Set(["horaire-global"]);

function isTeacherDirectoryHref(target: string) {
  return target === "/admin/teacher" || /\/teacher$/.test(target);
}

export function isPathActive(pathname: string, navHref: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(navHref);

  if (!target || target === "#") return false;
  if (current === target) return true;

  const branchRoot = target.match(
    /^\/admin\/organizations\/[^/]+\/branches\/[^/]+$/,
  )?.[0];

  if (branchRoot) {
    return current === branchRoot;
  }

  if (target === "/admin") {
    return current === "/admin";
  }

  if (!current.startsWith(`${target}/`)) return false;

  if (isTeacherDirectoryHref(target)) {
    const nextSegment = current.slice(target.length + 1).split("/")[0];
    return Boolean(nextSegment) && !TEACHER_LIST_EXCLUDED_SEGMENTS.has(nextSegment);
  }

  return true;
}

export default function useCheckActiveNav() {
  const pathname = usePathname();

  const checkActiveNav = (nav: string) => isPathActive(pathname, nav);

  return { checkActiveNav };
}
