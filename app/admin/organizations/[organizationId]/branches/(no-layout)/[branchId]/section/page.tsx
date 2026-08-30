"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { IconClipboard, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SectionUpForm } from "./components/section-form";
import SectionList from "./components/SectionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBranchTypeAction } from "../classe/classe.action";
import { usesSectionOptionForBranch } from "@/lib/branch-capabilities";
import {
  getTrainingLabelKey,
  type TrainingLabelKey,
} from "@/lib/training-labels";

export default function Sections() {
  const tClasses = useTranslations("classes");
  const [open, setOpen] = useState(false);
  const [labelKey, setLabelKey] = useState<TrainingLabelKey>("school");
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
          setLabelKey(getTrainingLabelKey(result.typebranch));
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [params.branchId, params.organizationId, router]);

  const handleSectionAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <BranchPageShell
      title={tClasses(`section.${labelKey}.title`)}
      description={tClasses(`section.${labelKey}.description`)}
      badge={
        <Badge variant="outline-primary" icon={<IconClipboard size={14} />}>
          {tClasses(`section.${labelKey}.badge`)}
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
          {tClasses(`section.${labelKey}.create`)}
        </Button>
      }
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>{tClasses(`section.${labelKey}.create`)}</SheetTitle>
            <SheetDescription>
              {tClasses("sectionSheetDesc")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <SectionUpForm
              mode="create"
              layout="dialog"
              labelKey={labelKey}
              onCreated={handleSectionAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card variant="elevated" padding="none" className="border p-1 md:p-6">
        <SectionList refreshKey={String(refreshKey)} labelKey={labelKey} />
      </Card>
    </BranchPageShell>
  );
}
