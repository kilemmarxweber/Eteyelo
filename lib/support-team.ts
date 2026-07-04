/**

 * Compatibilité : réexporte les constantes et délègue les agents à la couche DB.

 * Le support plateforme Klambocore est géré via `PlatformSupportAgent`.

 */

export type { SupportAgentPublic as SupportAgent } from "@/lib/support/types";

export { SUPPORT_TOPICS } from "@/lib/support/types";

export {

  listActivePlatformSupportAgents,

  listPlatformSupportEmails,

  isPlatformSupportEmail,

} from "@/lib/support/platform-support";



import {
  listActivePlatformSupportAgents,
  listPlatformSupportEmails,
} from "@/lib/support/platform-support";



/** @deprecated Préférer `listActivePlatformSupportAgents()` côté serveur. */

export async function getSupportTeam() {

  return listActivePlatformSupportAgents();

}



export async function getSupportEmails() {

  return listPlatformSupportEmails();

}

