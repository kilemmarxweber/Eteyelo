import { redirect } from "next/navigation";

/** Ancienne URL admin → écran auth sans navbar. */
export default async function LegacyChangePasswordRedirect({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const qs = callbackUrl
    ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "";
  redirect(`/auth/change-password${qs}`);
}
