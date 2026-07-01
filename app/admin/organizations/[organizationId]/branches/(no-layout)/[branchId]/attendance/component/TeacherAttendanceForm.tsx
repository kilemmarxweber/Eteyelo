"use client";

import { useEffect, useState } from "react";
import {
  getActiveTeachersNow,
  markTeacherAttendance,
} from "../attendance.action";

type TeacherUI = {
  id: string;
  user: {
    name: string;
    postnom?: string;
    prenom?: string;
  };
  activeSession?: {
    id: string;
  };
};
interface Props {
  onSuccess: () => void;
  sessionData: {
    teacherId: string;
    teachingId: string;
    cours: string;
    classe: string;
    branch: {
      id: string;
      name: string;
    };
  };
}
export default function TeacherAttendanceForm({
  onSuccess,
  sessionData,
}: Props) {
  const [search, setSearch] = useState("");
  const [teachers, setTeachers] = useState<TeacherUI[]>([]);
  const [selected, setSelected] = useState<TeacherUI | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const data = await getActiveTeachersNow(search);
      setTeachers(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  async function submit() {
    if (!selected?.activeSession?.id) {
      alert("Aucune session active");
      return;
    }

    setLoading(true);

    await markTeacherAttendance({
      teacherId: selected.id,
      sessionId: selected.activeSession.id,
      status: "PRESENT",
    });

    setLoading(false);
    onSuccess?.(); // 👈 ICI
    setSelected(null);
    setSearch("");
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full border p-2 rounded"
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-2">
        {teachers.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className={`w-full p-3 border rounded text-left ${
              selected?.id === t.id ? "bg-black text-white" : ""
            }`}
          >
            {t.user.name} {t.user.prenom}
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!selected || loading}
        className="w-full bg-black text-white p-2 rounded"
      >
        {loading ? "Validation..." : "Valider présence"}
      </button>
    </div>
  );
}
