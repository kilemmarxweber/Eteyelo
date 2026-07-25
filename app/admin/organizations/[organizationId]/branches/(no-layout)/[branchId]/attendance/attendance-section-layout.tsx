"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconScan, IconUserCheck } from "@tabler/icons-react";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";
import Loading from "../loading";
import { AttendanceSidebarNav } from "./components/attendance-sidebar-nav";

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const params = useParams<{ organizationId: string; branchId: string }>();
  const pathname = usePathname();
  const basePath = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/attendance`;
  const pointagePath = `${basePath}/pointage`;
  const onPointagePage = pathname.startsWith(pointagePath);

  if (isPending) return <Loading />;
  if (!canAccessTeachingArea(session)) return <NotFoundView />;

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col space-y-6" fixedHeight>
        <PageHeader
          title="Gestion des presences"
          description="Suivez les pointages du personnel, analysez les statistiques et exportez les rapports."
          badge={
            <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
              Presences
            </Badge>
          }
          actions={
            !onPointagePage ? (
              <Button asChild>
                <Link href={pointagePath}>
                  <IconScan className="mr-2 size-4" />
                  Pointer
                </Link>
              </Button>
            ) : null
          }
        />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-h-0">
            <Card className="sticky top-4 overflow-hidden p-4">
              <AttendanceSidebarNav basePath={basePath} />
            </Card>
          </aside>

          <main className="min-h-0 min-w-0 overflow-auto">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </LayoutBody>
    </Layout>
  );
}
