export function genererCreneaux(
  startDate: Date,
  endDate: Date,
  interval: number,
  recreationStart: Date,
  recreationDuration: number // Durée de la récréation en minutes
) {
  const creneaux: string[] = [];
  let currentDate = new Date(startDate);

  // Calculer l'heure de fin de la récréation
  const recreationEnd = new Date(recreationStart);
  recreationEnd.setMinutes(recreationEnd.getMinutes() + recreationDuration);

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const hasRecreation =
    recreationDuration > 0 &&
    recreationStart > startDate &&
    recreationStart < endDate;

  // Génère chaque début de cours. La récréation est toujours insérée,
  // même lorsqu'un intervalle de cours aurait normalement dépassé son début.
  while (currentDate < endDate) {
    if (hasRecreation && currentDate < recreationStart) {
      creneaux.push(formatTime(currentDate));
      const nextCourse = new Date(currentDate);
      nextCourse.setMinutes(nextCourse.getMinutes() + interval);
      currentDate = nextCourse > recreationStart
        ? new Date(recreationStart)
        : nextCourse;
      continue;
    }

    if (
      hasRecreation &&
      currentDate >= recreationStart &&
      currentDate < recreationEnd
    ) {
      creneaux.push(formatTime(recreationStart));
      currentDate = new Date(recreationEnd);
      continue;
    }

    creneaux.push(formatTime(currentDate));
    currentDate.setMinutes(currentDate.getMinutes() + interval);
  }

  // Garantit une dernière période complète se terminant exactement à la fin
  // de la vacation (ex. 11:30 - 12:15 pour un cours de 45 minutes).
  const lastCourseStart = new Date(endDate);
  lastCourseStart.setMinutes(lastCourseStart.getMinutes() - interval);
  if (
    lastCourseStart >= startDate &&
    (!hasRecreation ||
      lastCourseStart < recreationStart ||
      lastCourseStart >= recreationEnd)
  ) {
    creneaux.push(formatTime(lastCourseStart));
  }

  const lastCourseStartMinutes =
    lastCourseStart.getHours() * 60 + lastCourseStart.getMinutes();

  return Array.from(new Set(creneaux)).filter((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    const valueMinutes = hours * 60 + minutes;

    // La récréation reste une ligne spéciale, mais aucune heure de début
    // située après le dernier cours complet ne doit être proposée.
    return value === formatTime(recreationStart) || valueMinutes <= lastCourseStartMinutes;
  }).sort((a, b) => {
    const [aHour, aMinute] = a.split(":").map(Number);
    const [bHour, bMinute] = b.split(":").map(Number);
    return aHour * 60 + aMinute - (bHour * 60 + bMinute);
  });
}

/** Heure de fin d'un cours à partir du début, des créneaux affichés et de la fin de vacation. */
export function resolveCourseEndTime(
  startHour: string,
  orderedSlots: string[],
  vacationEnd: string,
): string {
  if (!startHour) return "";
  const index = orderedSlots.indexOf(startHour);
  if (index === -1) return "";
  return orderedSlots[index + 1] ?? vacationEnd;
}
