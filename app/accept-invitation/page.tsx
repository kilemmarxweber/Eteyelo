import { Suspense } from "react";
import { AcceptInvitationClient } from "./accept-invitation-client";

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-muted-foreground">
          Chargement de l’invitation…
        </div>
      }
    >
      <AcceptInvitationClient />
    </Suspense>
  );
}
