"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/custom/button";

export default function NotAuthorized() {
  const router = useRouter();
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] font-bold leading-tight text-primary">
          401
        </h1>
        <span className="font-medium">Oops! Page non autorisée!</span>
        <p className="text-center text-muted-foreground">
          Vous n&apos;avez pas le droit d&apos;accéder à la page demandée <br />
        </p>
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => router.push("/admin")}>
            De retour à l&apos;accueil
          </Button>
          <Button onClick={() => router.push("/auth/sign-in")}>
            Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
}
