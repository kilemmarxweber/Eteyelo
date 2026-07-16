"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Page interne pour tester Dialog + Select (sans auth). */
export default function PortalDismissTestPage() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [section, setSection] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-8">
      <h1 className="text-lg font-semibold">Test Dialog + Select</h1>
      <p className="text-sm text-muted-foreground">
        Harness de régression pour le dismiss du dialog lors des sélections.
      </p>

      <button
        type="button"
        data-testid="open-dialog"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        onClick={() => setOpen(true)}
      >
        Ouvrir le dialog
      </button>

      <p data-testid="dialog-state">dialog:{open ? "open" : "closed"}</p>
      <p data-testid="level-value">level:{level || "none"}</p>
      <p data-testid="section-value">section:{section || "none"}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-testid="dialog-content"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Créer une classe (mock)</DialogTitle>
            <DialogDescription>
              Les selects ne doivent pas fermer ce dialog.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Select
              value={level || undefined}
              onValueChange={(value) => {
                setLevel(value);
                setSection("");
              }}
            >
              <SelectTrigger data-testid="level-trigger">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="1P" data-testid="level-1p">
                  1ère primaire
                </SelectItem>
                <SelectItem value="2P" data-testid="level-2p">
                  2ème primaire
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={section || undefined}
              onValueChange={setSection}
              disabled={!level}
            >
              <SelectTrigger data-testid="section-trigger">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="sci" data-testid="section-sci">
                  Sciences
                </SelectItem>
                <SelectItem value="lit" data-testid="section-lit">
                  Littéraire
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
