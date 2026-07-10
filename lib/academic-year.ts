export type AcademicYearInfo = {
  nameYear: string;
  startYear: Date;
  endYear: Date;
  startCalendarYear: number;
  endCalendarYear: number;
};

function startOfDay(year: number, month: number, day: number) {
  return new Date(year, month, day, 0, 0, 0, 0);
}

export function getAcademicYearForDate(date = new Date()): AcademicYearInfo {
  const calendarYear = date.getFullYear();
  const startsThisCalendarYear = date.getMonth() >= 8;
  const startCalendarYear = startsThisCalendarYear
    ? calendarYear
    : calendarYear - 1;
  const endCalendarYear = startCalendarYear + 1;

  return {
    nameYear: `${startCalendarYear}-${endCalendarYear}`,
    startYear: startOfDay(startCalendarYear, 8, 1),
    endYear: startOfDay(endCalendarYear, 6, 2),
    startCalendarYear,
    endCalendarYear,
  };
}

export function getNextAcademicYearForDate(date = new Date()): AcademicYearInfo {
  const current = getAcademicYearForDate(date);
  const nextDate = startOfDay(current.startCalendarYear + 1, 8, 1);

  return getAcademicYearForDate(nextDate);
}

export function canPrepareNextAcademicYear(date = new Date()) {
  return date.getMonth() >= 7;
}
