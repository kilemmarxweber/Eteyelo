import nextDynamic from "next/dynamic";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTranslator } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { IconUserCheck } from "@tabler/icons-react";
import { auth } from "@/lib/auth";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { requiresStudentImport } from "@/lib/branch-capabilities";
import { loadMessages } from "@/lib/i18n";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";

export const dynamic = "force-dynamic";

const RegistrationForm = nextDynamic(
  () =>
    import("./registration-form").then((mod) => ({
      default: mod.RegistrationForm,
    })),
  {
    loading: () => (
      <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">
        …
      </div>
    ),
  },
);

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const query = await searchParams;
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (requiresStudentImport(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/student`,
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const locale = await resolvePreferredLocale(
    (session?.user as { locale?: string | null } | undefined)?.locale,
  );
  const messages = await loadMessages(locale);
  const t = createTranslator({
    locale,
    messages,
    namespace: "registration",
  });

  return (
    <BranchPageShell
      className="w-full"
      title={t("title")}
      description={t("description")}
      badge={
        <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
          {t("badge")}
        </Badge>
      }
    >
      <RegistrationForm initialRequestId={query.requestId ?? ""} />
    </BranchPageShell>
  );
}
