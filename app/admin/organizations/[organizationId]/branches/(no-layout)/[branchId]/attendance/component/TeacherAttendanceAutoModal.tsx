"use client";

import TeacherAttendanceForm from "./TeacherAttendanceForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionData: any;
}

export default function TeacherAttendanceAutoModal({
  open,
  onClose,
  sessionData,
}: Props) {
  if (!sessionData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <DialogContent
          className="
            w-full
            max-w-md
            bg-white
            rounded-xl
            shadow-lg
            ring-1 ring-black/5
            p-0
            overflow-hidden
          "
        >
          <DialogHeader className="p-4 border-b space-y-1">
            <DialogTitle>Enregistrement de présence</DialogTitle>

            <DialogDescription>
              {sessionData.cours} • {sessionData.classe}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4">
            <TeacherAttendanceForm
              sessionData={sessionData}
              onSuccess={onClose}
            />
          </div>

          <div className="p-3 border-t flex justify-end">
            <button onClick={onClose} className="px-3 py-2 rounded-md bg-muted">
              Fermer
            </button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
