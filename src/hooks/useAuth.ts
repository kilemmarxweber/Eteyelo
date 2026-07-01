"use client";

import { useSession } from "@/lib/auth-client";

export function useAuth() {
  const { data: session } = useSession();

  return {
    user: session?.user ?? null,
  };
}
