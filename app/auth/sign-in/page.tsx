"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconSchool, IconShield } from "@tabler/icons-react";
import { SignInForm } from "./components/sign-in-form";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-accent/10 flex justify-center p-4">
      <div className="w-full max-w-[clamp(360px,80%,290px)] mx-auto space-y-6 animate-fade-in">
        {/* Branding */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <IconSchool size={28} className="text-primary" />
              <div className="text-left">
                <h1 className="text-xl font-bold text-foreground">Kalasa</h1>
                <p className="text-xs text-muted-foreground">
                  Gestion scolaire
                </p>
              </div>
            </div>
          </div>
          <Badge variant="outline-primary" size="sm">
            Système de gestion moderne
          </Badge>
        </div>

        {/* Carte de connexion */}
        <Card
          variant="elevated"
          className="animate-fade-in bg-primary/10"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <IconShield size={20} className="text-primary" />
              Connexion sécurisée
            </CardTitle>
            <CardDescription>
              Connectez-vous à votre espace de gestion scolaire avec vos
              identifiants
            </CardDescription>
          </CardHeader>

          <CardContent>
            <SignInForm />
          </CardContent>

          <CardFooter className="text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              En vous connectant, vous acceptez nos{" "}
              <a
                href="/terms"
                className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
              >
                conditions d'utilisation
              </a>{" "}
              et notre{" "}
              <a
                href="/privacy"
                className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
              >
                politique de confidentialité
              </a>
              .
            </p>
          </CardFooter>
        </Card>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Plateforme sécurisée pour la gestion de votre établissement scolaire
          </p>
        </div>
      </div>
    </div>
  );
}
