import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

type NotFoundViewProps = {
  title?: string;
  description?: string;
};

export function NotFoundView({
  title = "Oops ! Page introuvable",
  description = "La page demandée n'existe pas ou vous n'avez pas le droit d'y accéder.",
}: NotFoundViewProps) {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-7xl font-extrabold leading-none text-blue-950 sm:text-8xl md:text-9xl">
            404
          </h1>

          <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">
            {title}
          </h2>

          <p className="mt-3 max-w-7xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              asChild
              className="rounded-full border-blue-950 text-blue-950 hover:bg-blue-950 hover:text-white"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Accueil
              </Link>
            </Button>

            <Button
              asChild
              className="rounded-full bg-blue-600 hover:bg-blue-700"
            >
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Espace admin
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}