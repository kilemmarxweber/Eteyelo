"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signInSchema, type SignInValues } from "@/app/auth/schema";
import {
  GraduationCap,
  School,
  BookOpen,
  Users,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import type { SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import {
  MIN_PASSWORD_LENGTH,
  signUpSchema,
  type SignUpValues,
} from "@/app/auth/schema";
import { z } from "zod";
export const authSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("login"),
    email: z.string().trim().email(),
    password: z.string().min(6),
  }),
  z.object({
    mode: z.literal("signup"),
    name: z.string().min(2),
    email: z.string().trim().email(),
    password: z.string().min(6),
  }),
]);

export type AuthValues = z.infer<typeof authSchema>;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      mode: "login",
      email: "",
      password: "",
      name: "",
    } as AuthValues,
  });
  const isSubmitting = form.formState.isSubmitting;

  const resolveDashboardPath = async () => {
    try {
      const redirectRes = await fetch("/api/auth/post-login-redirect", {
        credentials: "include",
      });
      const redirectBody = (await redirectRes.json()) as { path?: string };

      return redirectRes.ok && redirectBody.path ? redirectBody.path : "/admin/";
    } catch {
      return "/admin/";
    }
  };

  const goToDashboard = async () => {
    setIsRedirecting(true);

    const destination = await resolveDashboardPath();

    setAuthOpen(false);
    setOpen(false);
    router.refresh();
    router.push(destination);
    setIsRedirecting(false);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      setAuthOpen(false);
      setOpen(false);
      setServicesOpen(false);
      toast.success("Déconnecté.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Déconnexion impossible.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const onSubmit: SubmitHandler<AuthValues> = async (values) => {
    form.clearErrors();

    if (values.mode === "login") {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });

      if (error) {
        form.setError("root", { message: error.message });
        toast.error(error.message);
        return;
      }

      toast.success("Bienvenue !");
      await goToDashboard();
      return;
    }

    // signup
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/auth/sign-in",
    });

    if (error) {
      form.setError("root", { message: error.message });
      toast.error(error.message);
      return;
    }

    toast.success("Compte créé !");
    form.setValue("mode", "login");
  };
  useEffect(() => {
    form.setValue("mode", authMode);
  }, [authMode, form]);
  const switchMode = () => {
    const next = authMode === "login" ? "signup" : "login";

    setAuthMode(next);

    form.reset({
      mode: next,
      email: "",
      password: "",
      name: "",
    });
  };

  const navLinkClass =
    "relative py-2 text-sm font-medium text-blue-100/85 transition hover:text-white after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:rounded-full after:bg-blue-100 after:transition-all after:duration-300 hover:after:w-full";
  const mobileLinkClass =
    "block rounded-xl px-3 py-2 text-sm text-blue-100/85 transition hover:bg-white/10 hover:text-white";

  return (
    <header className="sticky top-0 z-[999] px-4 pt-4">
      <div
        className={`
          mx-auto max-w-6xl overflow-hidden
          rounded-3xl border border-blue-100/15
          bg-blue-950
          backdrop-blur-2xl
          text-blue-50
          shadow-[0_8px_30px_rgb(8,47,73,0.25)]
          transition-all duration-500
          hover:shadow-[0_12px_40px_rgb(8,47,73,0.28)]
          ${servicesOpen ? "pb-4" : "pb-0"}
        `}
        onMouseLeave={() => setServicesOpen(false)}
      >
        {/* TOP NAVBAR */}
        <div className="flex h-16 items-center justify-between px-6">
          {/* LOGO */}
          <Link
            href="/"
            className="flex items-center gap-3"
            onMouseEnter={() => setServicesOpen(false)}
          >
            <div className="rounded-2xl bg-white/10 p-2 shadow">
              <GraduationCap className="size-5 text-blue-50" />
            </div>

            <div>
              <h1 className="text-lg font-bold leading-none">
                Klambocore Sarl
              </h1>
              <p className="text-xs text-blue-100/70">
                Gestion scolaire RDC
              </p>
            </div>
          </Link>

          {/* DESKTOP MENU */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={navLinkClass}
              onMouseEnter={() => setServicesOpen(false)}
            >
              Accueil
            </Link>

            <Link
              href="/etablissements"
              className={navLinkClass}
              onMouseEnter={() => setServicesOpen(false)}
            >
              Établissements
            </Link>

            <button
              onMouseEnter={() => setServicesOpen(true)}
              className={`${navLinkClass} flex items-center gap-1`}
            >
              Services
              <ChevronDown
                className={`size-4 transition-transform duration-300 ${
                  servicesOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <Link
              href="/filieres"
              className={navLinkClass}
              onMouseEnter={() => setServicesOpen(false)}
            >
              Filières
            </Link>

            <Link
              href="/contact"
              className={navLinkClass}
              onMouseEnter={() => setServicesOpen(false)}
            >
              Contact
            </Link>
          </nav>

          {/* ACTIONS */}
          <div
            className="hidden md:flex items-center gap-2"
            onMouseEnter={() => setServicesOpen(false)}
          >
            {session?.user ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="mr-2 size-4" />
                {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAuthOpen(true)}>
                Se connecter
              </Button>
            )}
          </div>

          {/* MOBILE BUTTON */}
          <button
            onClick={() => setOpen(!open)}
            className="rounded-xl border border-blue-100/20 p-2 text-blue-50 transition hover:bg-white/10 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* SERVICES PANEL */}
        <div
          className={`
            grid transition-all duration-500 ease-in-out
            ${
              servicesOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }
          `}
        >
          <div className="overflow-hidden">
            <div className="border-t border-blue-100/15 px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/etablissements"
                  onClick={() => setServicesOpen(false)}
                  className="group rounded-2xl border border-blue-100/15 bg-white p-4 text-slate-950 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-blue-950/10">
                    <School className="size-5 text-blue-950" />
                  </div>
                  <h3 className="font-semibold">Établissements</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trouvez écoles, instituts et universités partout en RDC.
                  </p>
                </Link>

                <Link
                  href="/filieres"
                  onClick={() => setServicesOpen(false)}
                  className="group rounded-2xl border border-blue-100/15 bg-white p-4 text-slate-950 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-blue-950/10">
                    <BookOpen className="size-5 text-blue-950" />
                  </div>
                  <h3 className="font-semibold">Filières</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Découvrez les formations et spécialisations disponibles.
                  </p>
                </Link>

                <Link
                  href="/inscription"
                  onClick={() => setServicesOpen(false)}
                  className="group rounded-2xl border border-blue-100/15 bg-white p-4 text-slate-950 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-blue-950/10">
                    <Users className="size-5 text-blue-950" />
                  </div>
                  <h3 className="font-semibold">Inscrire une école</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ajoutez votre établissement et augmentez votre visibilité.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE MENU */}
        {open && (
          <div className="border-t border-blue-100/15 bg-blue-950 md:hidden">
            <div className="space-y-1 p-4">
              <Link
                href="/"
                className={mobileLinkClass}
              >
                Accueil
              </Link>
              <Link
                href="/etablissements"
                className={mobileLinkClass}
              >
                Établissements
              </Link>
              <Link
                href="/filieres"
                className={mobileLinkClass}
              >
                Filières
              </Link>
              <Link
                href="/inscription"
                className={mobileLinkClass}
              >
                Inscrire une école
              </Link>
              <Link
                href="/contact"
                className={mobileLinkClass}
              >
                Contact
              </Link>

              {session?.user ? (
                <div className="pt-3">
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    <LogOut className="mr-2 size-4" />
                    {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-3">
                  <Button variant="outline" className="w-full">
                    <Link href="/auth/sign-in">Connexion</Link>
                  </Button>
                  <Button className="w-full">
                    <Link href="/auth/sign-up">Inscription</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* OVERLAY */}
      <div
        onClick={() => setAuthOpen(false)}
        className={`
    fixed inset-0 z-[1000]
    bg-black/40 backdrop-blur-sm
    transition-opacity duration-300
    ${authOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
  `}
      />

      {/* DRAWER */}
      <div
        className={`
    fixed top-0 right-0 z-[1001]
    h-screen w-full sm:w-[450px]
    bg-background/95 backdrop-blur-3xl
    border-l shadow-2xl
    transition-transform duration-500 ease-out
    ${authOpen ? "translate-x-0" : "translate-x-full"}
  `}
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          {/* Glow */}
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-blue-950/10 blur-3xl" />

          {/* HEADER */}
          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h2 className="text-2xl font-bold">
                {authMode === "login" ? "Connexion" : "Créer un compte"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {authMode === "login"
                  ? "Accédez à votre espace Klambocore Sarl"
                  : "Rejoignez Klambocore Sarl"}
              </p>
            </div>

            {/* 🔥 FIX ICI (IMPORTANT) */}
            <button
              type="button"
              onClick={() => setAuthOpen(false)}
              className="relative z-[1002] rounded-xl border p-2 hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <Form {...form}>
            <form
              method="post"
              className="flex flex-col gap-5 p-5 md:p-7"
              noValidate
              onSubmit={form.handleSubmit(
                onSubmit as SubmitHandler<AuthValues>,
              )}
            >
              {/* BODY */}
              <div className="flex-1 p-6">
                <div className="space-y-4">
                  <input type="hidden" {...form.register("mode")} />
                  {/* NAME (SIGNUP ONLY) */}
                  {authMode === "signup" && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Nom d'utilisateur
                      </label>

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                type="text"
                                autoComplete="name"
                                placeholder="Jean Dupont"
                                className="h-11"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* EMAIL */}
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Adresse email
                    </label>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="vous@klambocore.example"
                              className="h-13 w-full rounded-2xl border px-4 py-3 focus:ring-2 focus:ring-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Mot de passe
                    </label>

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder={
                                authMode === "login"
                                  ? "********"
                                  : "Min 8 caractères"
                              }
                              className="h-13 w-full rounded-2xl border px-4 py-3 focus:ring-2 focus:ring-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* ERROR */}
                  {form.formState.errors.root?.message &&
                    authMode === "login" && (
                      <p className="text-xs text-destructive">
                        {String(form.formState.errors.root.message)}
                      </p>
                    )}

                  {/* SUBMIT BUTTON */}
                  <Button
                    className="h-12 w-full rounded-2xl"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {authMode === "login" ? "Se connecter" : "Créer un compte"}
                  </Button>

                  {/* SOCIAL */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                  </div>
                  {authMode === "login" ? (
                    <>
                      <div className="relative flex justify-center">
                        <span className="bg-background px-3 text-xs text-muted-foreground">
                          ou continuer avec
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-2xl"
                      >
                        Google
                      </Button>
                    </>
                  ) : (
                    ""
                  )}
                </div>
              </div>

              {/* FOOTER SWITCH (TON BUTTON EXISTANT RESTE IDENTIQUE) */}
              <div className="border-t p-6">
                <p className="text-center text-sm text-muted-foreground">
                  {authMode === "login"
                    ? "Pas encore de compte ?"
                    : "Déjà inscrit ?"}
                </p>

                <Button
                  variant="outline"
                  className="mt-3 w-full rounded-2xl"
                  type="button"
                  onClick={switchMode}
                >
                  {authMode === "login" ? "Créer un compte" : "Se connecter"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </header>
  );
}
