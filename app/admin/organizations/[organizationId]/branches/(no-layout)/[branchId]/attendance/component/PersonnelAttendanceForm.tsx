"use client";

import { useState } from "react";
import { markPersonnelAttendance } from "../attendance.action";
type Props = {
  onSuccess?: () => void;
};
export default function PersonnelAttendanceForm({ onSuccess }: Props) {
  const [personnelId, setPersonnelId] = useState("");

  async function submit() {
    await markPersonnelAttendance({
      personnelId,
      date: new Date(),
      status: "PRESENT",
    });

    onSuccess?.(); // 👈 important
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full border rounded p-2"
        placeholder="Personnel ID"
        onChange={(e) => setPersonnelId(e.target.value)}
      />

      <button
        onClick={submit}
        className="w-full bg-black text-white rounded p-2"
      >
        Check
      </button>
    </div>
  );
}
