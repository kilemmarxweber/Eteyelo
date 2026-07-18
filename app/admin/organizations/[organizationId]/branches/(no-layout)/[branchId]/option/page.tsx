"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
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
import { usesSectionOptionForBranch } from "@/lib/branch-capabilities";
import { getTrainingLabels } from "@/lib/training-labels";
import Loading from "../loading";

export default function Options() {
  const [open, setOpen] = useState(false);
  const [checkingBranch, setCheckingBranch] = useState(true);
  const [labels, setLabels] = useState(getTrainingLabels("SECONDAIRE"));
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

        if (!err && !usesSectionOptionForBranch(result?.typebranch)) {
          router.replace(
            `/admin/organizations/${params.organizationId}/branches/${params.branchId}/classe`,
          );
          return;
        }

        if (result?.typebranch) {
          setLabels(getTrainingLabels(result.typebranch));
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
          title={labels.optionTitle}
          description={labels.optionDescription}
          badge={
            <Badge variant="outline-primary" icon={<IconSettings size={14} />}>
              {labels.optionBadge}
            </Badge>
          }
          actions={
            <Button type="button" variant="default" onClick={() => setOpen(true)}>
              <IconPlus size={16} className="mr-2" />
              {labels.optionCreate}
            </Button>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>{labels.optionCreate}</DialogTitle>
              <DialogDescription>
                Renseignez les informations puis enregistrez.
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
