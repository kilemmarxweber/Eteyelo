"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GitMerge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openOverlayAfterMenuDismiss } from "@/lib/radix-portal-dismiss";

import {
  MergeStructureDialog,
  type MergeableBranch,
} from "./merge-structure-dialog";

type MergeContextValue = {
  openMerge: (sourceId?: string) => void;
};

const MergeContext = createContext<MergeContextValue | null>(null);

function useBranchMerge() {
  const context = useContext(MergeContext);
  if (!context) {
    throw new Error("Branch merge controls must be used inside the provider.");
  }
  return context;
}

export function BranchStructureMergeProvider({
  organizationId,
  branches,
  children,
}: {
  organizationId: string;
  branches: MergeableBranch[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | undefined>();

  const openMerge = useCallback((nextSourceId?: string) => {
    setSourceId(nextSourceId);
    openOverlayAfterMenuDismiss(() => setOpen(true));
  }, []);

  const value = useMemo(() => ({ openMerge }), [openMerge]);

  return (
    <MergeContext.Provider value={value}>
      {children}
      <MergeStructureDialog
        organizationId={organizationId}
        branches={branches}
        defaultSourceId={sourceId}
        hideTrigger
        open={open}
        onOpenChange={setOpen}
      />
    </MergeContext.Provider>
  );
}

export function BranchMergeHeaderButton() {
  const { openMerge } = useBranchMerge();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="rounded-full bg-card text-foreground hover:bg-muted"
      onClick={() => openMerge()}
    >
      <GitMerge className="mr-1.5 size-3.5" />
      Copier la structure
    </Button>
  );
}
