export function genererCreneaux(
  startDate: Date,
  endDate: Date,
  interval: number,
  recreationStart: Date,
  recreationDuration: number // Durée de la récréation en minutes
) {
  const creneaux = [];
  let currentDate = new Date(startDate);

  // Calculer l'heure de fin de la récréation
  const recreationEnd = new Date(recreationStart);
  recreationEnd.setMinutes(recreationEnd.getMinutes() + recreationDuration);

  // Boucle tant que l'heure actuelle est avant l'heure de fin
  while (currentDate <= endDate) {
    // Si on atteint l'heure de début de la récréation
    if (currentDate >= recreationStart && currentDate < recreationEnd) {
      // Ajouter l'heure de début et de fin de la récréation
      creneaux.push(`${recreationStart.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}`);
      // Avancer l'heure actuelle à la fin de la récréation
      currentDate = new Date(recreationEnd);
    } else {
      // Ajouter le créneau actuel
      creneaux.push(new Date(currentDate).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })); // Note : stocker une copie
      // Avancer l'heure actuelle de l'intervalle spécifié (en minutes)
      currentDate.setMinutes(currentDate.getMinutes() + interval);
    }
  }

  return creneaux; // Retourne un tableau des créneaux et des périodes de récréation
}
