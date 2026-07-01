"use client";

import StudentAttendanceTable from "./StudentAttendanceTable";

export default function SessionDetail({ session }: any) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">
        {session.teaching?.cours?.nameCours}
      </h1>

      <p>Classe: {session.teaching?.classe?.nameClasse}</p>

      <StudentAttendanceTable session={session} />
    </div>
  );
}
