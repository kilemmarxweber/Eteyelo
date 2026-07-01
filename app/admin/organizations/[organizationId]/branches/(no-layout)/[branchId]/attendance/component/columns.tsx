import { ColumnDef } from "@tanstack/react-table";
import { AttendanceSessionRow } from "../interface/Attendance";
import { Badge } from "@/components/ui/badge";

export const columns: ColumnDef<AttendanceSessionRow>[] = [
  {
    accessorKey: "date",
    header: "Date",

    filterFn: (row, id, value) => {
      if (!value?.start && !value?.end) return true;

      const rowDate = new Date(row.original.date);

      const start = value?.start ? new Date(value.start) : null;
      const end = value?.end ? new Date(value.end) : null;

      if (start && rowDate < start) return false;
      if (end && rowDate > end) return false;

      return true;
    },

    cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR"),
  },

  {
    accessorKey: "nom",
    header: "Noms",

    filterFn: (row, id, value) => {
      if (!value) return true;

      const noms = row.original.nom ?? "";

      return noms.toLowerCase().includes(String(value).toLowerCase());
    },

    cell: ({ row }) => row.original.nom ?? "—",
  },
  {
    accessorKey: "cours",
    header: "Cours",

    filterFn: (row, id, value) => {
      if (!value) return true;

      const cours = row.original.cours ?? "";

      return cours.toLowerCase().includes(String(value).toLowerCase());
    },

    cell: ({ row }) => row.original.cours ?? "—",
  },
  {
    accessorKey: "classe",
    header: "Classe",

    cell: ({ row }) => row.original.classe ?? "—",
  },
  {
    accessorKey: "startTime",
    header: "Heure debut",

    cell: ({ row }) => {
      const d = new Date(row.original.startTime);

      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
        d.getUTCMinutes(),
      ).padStart(2, "0")}`;
    },
  },
  {
    accessorKey: "endTime",
    header: "Heure Fin",
    cell: ({ row }) => {
      const d = new Date(row.original.endTime);

      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
        d.getUTCMinutes(),
      ).padStart(2, "0")}`;
    },
  },
  {
    accessorKey: "type",
    header: "Type",

    filterFn: (row, id, value) => {
      if (!value) return true;
      return row.original.type === value;
    },

    cell: ({ row }) => {
      const type = row.original.type ?? "Teacher";

      const styles: Record<string, string> = {
        Teacher: "bg-blue-100 text-blue-700",
        Student: "bg-violet-100 text-violet-700",
        Personnel: "bg-amber-100 text-amber-700",
      };

      return (
        <Badge className={styles[type] ?? "bg-gray-100 text-gray-700"}>
          {type}
        </Badge>
      );
    },
  },

  {
    accessorKey: "isClosed",
    header: "Statut",

    filterFn: (row, id, value) => {
      if (!value) return true;

      const status = row.original.isClosed;

      if (status === null || status === undefined) return false;

      return status === (value === "true");
    },

    cell: ({ row }) =>
      row.original.isClosed ? (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
          Fermée
        </Badge>
      ) : (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          Ouverte
        </Badge>
      ),
  },
];
