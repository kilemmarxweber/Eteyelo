"use client";

import { useEffect, useState } from "react";
import { ResponsiveDataTable } from "@/components/custom";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconAlertCircle, IconCalendar } from "@tabler/icons-react";

import { columns } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";
import { ICalendarEvent } from "@/src/interfaces/CalendarEvent";
import { getCalendarEvents } from "../CalendarEvent.acton";
import { useRefresh } from "@/src/hooks/RefreshContext";

export default function EventsList() {
  const [events, setEvents] = useState<ICalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);

        const [data, err] = await getCalendarEvents();

        if (err) throw new Error(err.message);

        setEvents(data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [refreshKey]);

  if (loading) return <TableSkeleton rows={5} columns={6} />;

  if (error)
    return (
      <Alert variant="destructive">
        <IconAlertCircle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  if (!events.length)
    return (
      <EmptyTableState
        title="Aucun événement"
        description="Créez un événement pour commencer"
        icon={<IconCalendar />}
      />
    );

  return (
    <div className="p-4">
      <ResponsiveDataTable
        columns={columns}
        data={events}
        ToolbarComponent={DataTableToolbar}
        emptyText="Aucun événement"
        mobileCardTitle={(row) => row.title ?? ""}
        mobileCardSubtitle={(row) => row.location ?? ""}
      />
    </div>
  );
}
