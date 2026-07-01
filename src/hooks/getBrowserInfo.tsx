// import { createLogAction } from "@/app/admin/log/log.action";
import { ActionType } from "@/prisma/generated/prisma/client";

export async function createLogFunction(username: string, action: ActionType) {
  const deviceName = navigator.platform || "Unknown Platform";
  const pageVisited = window.location.href;

  const deviceType = /mobile/i.test(deviceName) ? "MOBILE" : "DESKTOP";
  // const [log, err] = await createLogAction({
  //   username,
  //   action,
  //   deviceName,
  //   deviceType,
  //   pageVisited,
  // });
  const [log, err] = [null, null]; // TODO: remplacer par l'appel réel à la fonction de création de log
  if (err) {
    throw new Error(err);
  }
}
