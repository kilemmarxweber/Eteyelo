import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * `undefined` jusqu’à hydratation — évite d’ouvrir un Dialog desktop
 * sur mobile avant que le media query soit connu.
 */
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
