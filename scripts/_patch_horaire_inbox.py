from pathlib import Path

p = Path(
    "app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/teacher/horaire-global/horaire-global.action.ts"
)
text = p.read_text(encoding="utf-8")
old = """      for (const teacher of ready) {
        if (skipWhatsApp || isWhatsAppCircuitOpen()) {
          failed += 1;
          // Circuit open doit toujours couper WhatsApp, même si une erreur
          // temporaire était déjà enregistrée.
          if (isWhatsAppCircuitOpen()) {
            skipWhatsApp = true;
            if (!error) {
              error =
                \"WhatsApp a restreint les envois — pause automatique, lot interrompu.\";
            }
          }
          continue;
        }
        try {
          const result = await sendTeacherScheduleWhatsApp({
            teacher,
            organizationId,
            branchId,
            cycleLabel: schedule.cycleLabel,
            schoolName,
            origin,
            context,
            labels,
            logoDataUrl,
            schedule,
          });
          if (result.sent) {
            sent += 1;
            if (isWhatsAppCircuitOpen()) {
              skipWhatsApp = true;
              if (!error) {
                error =
                  \"WhatsApp a restreint les envois — pause automatique, lot interrompu.\";
              }
            }
            continue;
          }
          failed += 1;
          if (!error && result.error) error = result.error;
          if (isPermanentWhatsAppStop(result.error)) skipWhatsApp = true;
        } catch (cause) {
          failed += 1;
          const message =
            cause instanceof Error
              ? cause.message
              : \"Impossible de générer le PDF de l'horaire.\";
          if (!error) error = message;
          if (isPermanentWhatsAppStop(message)) skipWhatsApp = true;
        }
      }"""
new = """      for (const teacher of ready) {
        const gatewayBlocked =
          !inboxMode && (skipWhatsApp || isWhatsAppCircuitOpen());
        if (gatewayBlocked) {
          failed += 1;
          if (isWhatsAppCircuitOpen()) {
            skipWhatsApp = true;
            if (!error) {
              error =
                \"WhatsApp a restreint les envois — pause automatique, lot interrompu.\";
            }
          }
          continue;
        }
        try {
          const result = await sendTeacherScheduleWhatsApp({
            teacher,
            organizationId,
            branchId,
            cycleLabel: schedule.cycleLabel,
            schoolName,
            origin,
            context,
            labels,
            logoDataUrl,
            schedule,
          });
          if (result.sent) {
            sent += 1;
            if (!inboxMode && isWhatsAppCircuitOpen()) {
              skipWhatsApp = true;
              if (!error) {
                error =
                  \"WhatsApp a restreint les envois — pause automatique, lot interrompu.\";
              }
            }
            continue;
          }
          failed += 1;
          if (!error && result.error) error = result.error;
          if (!inboxMode && isPermanentWhatsAppStop(result.error)) {
            skipWhatsApp = true;
          }
        } catch (cause) {
          failed += 1;
          const message =
            cause instanceof Error
              ? cause.message
              : \"Impossible de générer le PDF de l'horaire.\";
          if (!error) error = message;
          if (!inboxMode && isPermanentWhatsAppStop(message)) {
            skipWhatsApp = true;
          }
        }
      }"""
# Fix escaped quotes from writing this file
old = old.replace('\\"', '"')
new = new.replace('\\"', '"')
if old not in text:
    raise SystemExit("NOT FOUND")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("OK")
