"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconPlus, IconSettings } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionUpForm } from "./components/option-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import OptionList from "./components/OptionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBranchTypeAction } from "../classe/classe.action";
import { isPrimaryBranch } from "@/lib/class-structure";
import Loading from "../loading";

export default function Options() {
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

  const handleOptionAction = () => {
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
          title="Liste des options"
          description="Definissez les options disponibles pour les classes secondaires."
          badge={
            <Badge variant="outline-primary" icon={<IconSettings size={14} />}>
              Options
            </Badge>
          }
          actions={
            <Button type="button" variant="default" onClick={() => setOpen(true)}>
              <IconPlus size={16} className="mr-2" />
              Creer une option
            </Button>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Creer une option</DialogTitle>
              <DialogDescription>
                Renseignez les informations de l'option puis enregistrez.
              </DialogDescription>
            </DialogHeader>

            <OptionUpForm mode="create" onCreated={handleOptionAction} />
          </DialogContent>
        </Dialog>

        <Card variant="elevated" padding="none" className="border p-1 md:p-6">
          <OptionList refreshKey={String(refreshKey)} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
