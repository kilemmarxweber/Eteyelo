import { prisma } from "@/lib/prisma";
import BigCalendar from "./BigCalender";
import { adjustScheduleToCurrentWeek } from "@/lib/utils";

const BigCalendarContainer = async ({
  type,
  id,
}: {
  type: "teacherId" | "classId";
  id: string;
}) => {
  // 🔥 On récupère le vrai planning depuis Schedule
  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true },
  });
  const scheduleRes = await prisma.schedule.findMany({
    where: {
      teaching: {
        schoolYearId: currentYear?.id, // ✅ FILTRE IMPORTANT

        ...(type === "teacherId" ? { teacherId: id } : { classeId: id }),
      },
    },

    include: {
      teaching: {
        include: {
          cours: true,
          classe: {
            include: {
              creneau: true,
            },
          },
        },
      },
    },

    orderBy: {
      hour: "asc",
    },
  });
  const getRealDate = (day: string, time: Date) => {
    const now = new Date();

    const days: any = {
      Dimanche: 0,
      Lundi: 1,
      Mardi: 2,
      Mercredi: 3,
      Jeudi: 4,
      Vendredi: 5,
      Samedi: 6,
    };

    const targetDay = days[day];
    const currentDay = now.getDay();

    const diff = targetDay - currentDay;

    const date = new Date(now);
    date.setDate(now.getDate() + diff);

    // 🔥 injecter heure (le plus important)
    date.setHours(time.getUTCHours());
    date.setMinutes(time.getUTCMinutes());
    date.setSeconds(0);

    return date;
  };

  // 🔥 Mapping vers format calendar
  const data = scheduleRes.map((item) => {
    const start = getRealDate(item.day, item.hour);

    const end = new Date(start);
    end.setHours(end.getHours() + 1); // durée cours (ajuste si besoin)

    return {
      title: item.teaching?.cours?.nameCours || "Cours",
      start,
      end,
    };
  });
  // 🔥 Ajuste à la semaine actuelle
  const schedule = adjustScheduleToCurrentWeek(data);

  return (
    <div className="w-full h-full">
      <BigCalendar data={schedule} />
    </div>
  );
};

export default BigCalendarContainer;
