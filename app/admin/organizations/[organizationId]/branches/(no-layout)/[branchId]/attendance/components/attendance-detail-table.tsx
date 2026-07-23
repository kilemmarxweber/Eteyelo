"use client";

import { IconListDetails } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AttendanceReportRow } from "../attendance-report-types";

function statusVariant(status: AttendanceReportRow["status"]) {
  switch (status) {
    case "PRESENT":
      return "success" as const;
    case "ABSENT":
      return "destructive" as const;
    case "LATE":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function AttendanceDetailTable({ rows }: { rows: AttendanceReportRow[] }) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <IconListDetails size={18} className="text-primary" />
          <h3 className="font-semibold">Detail des presences</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {rows.length} enregistrement(s)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">Poste</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Heure debut</th>
              <th className="px-5 py-3 font-medium">Heure fin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Aucun enregistrement pour cette periode.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-4 align-top">
                    <p className="font-semibold">
                      {new Date(row.date).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.dayLabel}</p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {row.agentInitials}
                      </div>
                      <div>
                        <p className="font-semibold">{row.agentName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.agentId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top capitalize">{row.poste}</td>
                  <td className="px-5 py-4 align-top">
                    <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge>
                  </td>
                  <td className="px-5 py-4 align-top font-mono">
                    {row.arrival ?? "--:--:--"}
                  </td>
                  <td className="px-5 py-4 align-top font-mono">
                    {row.departure ?? "--:--:--"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
