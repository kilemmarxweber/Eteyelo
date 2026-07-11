import { usePathname } from "next/navigation";

function normalizePath(path: string) {
  if (!path || path === "#") return "";
  return path.replace(/\/$/, "") || "/";
}

export default function useCheckActiveNav() {
  const pathname = usePathname();

  const checkActiveNav = (nav: string) => {
    const current = normalizePath(pathname);
    const target = normalizePath(nav);

    if (!target) return false;
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

    return current.startsWith(`${target}/`);
  };

  return { checkActiveNav };
}
