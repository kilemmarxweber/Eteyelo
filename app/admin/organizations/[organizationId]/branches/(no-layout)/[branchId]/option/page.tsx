"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { IconPlus, IconSettings } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OptionUpForm } from "./components/option-form";
import OptionList from "./components/OptionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
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
    <BranchPageShell
      title={labels.optionTitle}
      description={labels.optionDescription}
      badge={
        <Badge variant="outline-primary" icon={<IconSettings size={14} />}>
          {labels.optionBadge}
        </Badge>
      }
      actions={
        <Button
          type="button"
          size="sm"
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={() => setOpen(true)}
        >
          {labels.optionCreate}
        </Button>
      }
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>{labels.optionCreate}</SheetTitle>
            <SheetDescription>
              Associez l&apos;option à une section, puis enregistrez.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <OptionUpForm
              mode="create"
              layout="dialog"
              onCreated={handleOptionAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card variant="elevated" padding="none" className="border p-1 md:p-6">
        <OptionList refreshKey={String(refreshKey)} />
      </Card>
    </BranchPageShell>
  );
}
