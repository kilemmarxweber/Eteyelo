export function genererCreneaux(
  start: Date,
  end: Date,
  durationCourse: number,
  recreationHour: Date,
  recreationDuration: number,
) {
  const result: string[] = [];

  let current = new Date(start);

  while (current < end) {
    const time = current.toTimeString().substring(0, 5);
    result.push(time);

    // récréation skip
    const isRecreation = time === recreationHour.toTimeString().substring(0, 5);

    const step = isRecreation ? recreationDuration : durationCourse;

    current = new Date(current.getTime() + step * 60000);
  }

  return result;
}
