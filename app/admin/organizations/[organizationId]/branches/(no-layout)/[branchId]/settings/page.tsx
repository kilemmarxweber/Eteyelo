import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ProfileForm from "@/app/admin/settings/profile-form";
import { getCurrentProfileAction } from "@/app/admin/settings/profile.action";

export const dynamic = "force-dynamic";

export default async function SettingsProfile() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const result = await getCurrentProfileAction();
  if (result.error || !result.profile) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {result.error ?? "Impossible de charger votre profil."}
      </div>
    );
  }

  return <ProfileForm initialProfile={result.profile} />;
}
