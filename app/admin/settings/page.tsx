import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ProfileForm from "./profile-form";
import { getCurrentProfileAction } from "./profile.action";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/sign-in?callbackUrl=/admin/settings");
  }

  const result = await getCurrentProfileAction();
  if (result.error || !result.profile) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {result.error ?? "Impossible de charger votre profil."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <ProfileForm initialProfile={result.profile} />
    </div>
  );
}
