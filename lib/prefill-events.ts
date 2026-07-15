export const REGISTRATION_PREFILL_EVENT = "eteyelo:registration-prefill";
export const CANDIDATURE_PREFILL_EVENT = "eteyelo:candidature-prefill";

export type PrefillEventDetail = { id: string };

export function dispatchRegistrationPrefill(requestId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PrefillEventDetail>(REGISTRATION_PREFILL_EVENT, {
      detail: { id: requestId },
    }),
  );
}

export function dispatchCandidaturePrefill(applicationId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PrefillEventDetail>(CANDIDATURE_PREFILL_EVENT, {
      detail: { id: applicationId },
    }),
  );
}
