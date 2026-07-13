"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconClipboard, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionUpForm } from "./components/section-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import SectionList from "./components/SectionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBranchTypeAction } from "../classe/classe.action";
import { isPrimaryBranch } from "@/lib/class-structure";
import Loading from "../loading";

export default function Sections() {
  const [open, setOpen] = useState(false);
  const [checkingBranch, setCheckingBranch] = useState(true);
  const { refreshKey, refresh } = useRefresh();
  const router = useRouter();
  const params = useParams<{
    organizationId: string;
    branchId: string;
  }>();

  useEffect(() => {
    let ignore = false;

    getBranchTypeAction()
      .then(([result, err]) => {
        if (ignore) return;

        if (!err && isPrimaryBranch(result?.typebranch)) {
          router.replace(
            `/admin/organizations/${params.organizationId}/branches/${params.branchId}/classe`,
          );
          return;
        }

        setCheckingBranch(false);
      })
      .catch(() => {
        if (!ignore) setCheckingBranch(false);
      });

    return () => {
      ignore = true;
    };
  }, [params.branchId, params.organizationId, router]);

  const handleSectionAction = () => {
    refresh();
    setOpen(false);
  };

  if (checkingBranch) {
    return <Loading />;
  }

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Liste des sections"
          description="Organisez les sections disponibles pour les classes secondaires."
          badge={
            <Badge variant="outline-primary" icon={<IconClipboard size={14} />}>
              Sections
            </Badge>
          }
          actions={
            <Button type="button" variant="default" onClick={() => setOpen(true)}>
              <IconPlus size={16} className="mr-2" />
              Creer une section
            </Button>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Creer une section</DialogTitle>
              <DialogDescription>
                Renseignez les informations de la section puis enregistrez.
              </DialogDescription>
            </DialogHeader>

            <SectionUpForm mode="create" onCreated={handleSectionAction} />
          </DialogContent>
        </Dialog>

        <Card variant="elevated" padding="none" className="border p-1 md:p-6">
          <SectionList refreshKey={String(refreshKey)} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
