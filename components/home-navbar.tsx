"use client";

import {
  BarChart3,
  ChevronDown,
  GraduationCap,
  Menu,
  School,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { UserNav } from "@/components/user-nav";
import { authClient } from "@/lib/auth-client";
import { useAppLoading } from "@/hooks/use-app-loading";

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

const serviceMenuItems = [
  {
    label: "Gestion scolaire",
    href: "#services",
    description: "Classes, notes, présences et administration.",
    icon: School,
  },
  {
    label: "Filières",
    href: "/filieres",
    description: "Formations, options et parcours disponibles.",
    icon: GraduationCap,
  },
  {
    label: "Résultats",
    href: "#resultats",
    description: "Bulletins, classements et performances.",
    icon: BarChart3,
  },
  {
    label: "Inscription école",
    href: "/inscription-ecole",
    description: "Ajoutez votre établissement sur Klambocore.",
    icon: UserPlus,
  },
];

export function HomeNavbar() {
  const [open, setOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const { withLoading } = useAppLoading();
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      mode: "login",
      email: "",
      password: "",
      name: "",
    } as AuthValues,
  });

  const isSubmitting = form.formState.isSubmitting || isRedirecting;

  const closeMobileMenu = () => {
    setOpen(false);
    setMobileServicesOpen(false);
  };

  const openAuthDrawer = () => {
    closeMobileMenu();
    setAuthOpen(true);
  };

  const resolveDashboardPath = async () => {
    return withLoading(async () => {
      try {
        const redirectRes = await fetch("/api/auth/post-login-redirect", {
          credentials: "include",
        });

        const redirectBody = (await redirectRes.json()) as { path?: string };

        return redirectRes.ok && redirectBody.path
          ? redirectBody.path
          : "/admin/";
      } catch {
        return "/admin/";
      }
    });
  };

  const goToDashboard = async () => {
    setIsRedirecting(true);

    const destination = await resolveDashboardPath();

    setAuthOpen(false);
    closeMobileMenu();
    router.push(destination);
    setIsRedirecting(false);
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
    setAuthMode("login");
    form.reset({
      mode: "login",
      email: values.email,
      password: "",
    });
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

  const mobileLinkClass =
    "block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700";

  return (
    <header className="sticky top-0 z-50 border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          onClick={closeMobileMenu}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white">
            <School />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-blue-700">
              Klambocore
            </h1>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Gestion scolaire RDC
            </p>
          </div>
        </Link>

        <div className="relative hidden flex-1 xl:block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-blue-950" />
          <Input
            className="rounded-full border-blue-100 bg-blue-50/70 pl-10 text-blue-950 placeholder:text-blue-950/45 focus-visible:ring-blue-950"
            placeholder="Rechercher une école, ville ou filière..."
          />
        </div>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex">
          <div className="group relative -my-3 py-3 after:absolute after:left-0 after:top-full after:h-4 after:w-full after:content-['']">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-1 py-2 transition hover:text-blue-600"
            >
              Services
              <ChevronDown className="h-4 w-4 transition duration-300 group-hover:rotate-180" />
            </button>

            <div className="invisible absolute left-1/2 top-[calc(100%-0.25rem)] z-50 w-[26rem] -translate-x-1/2 translate-y-3 rounded-3xl border border-blue-100 bg-white p-3 opacity-0 shadow-2xl shadow-blue-950/10 transition duration-200 group-hover:visible group-hover:translate-y-1 group-hover:opacity-100">
              <div className="grid gap-2">
                {serviceMenuItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-blue-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                      <item.icon className="h-5 w-5" />
                    </span>

                    <span>
                      <span className="block font-black text-blue-950">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {[
            ["Support", "/support"],
            ["Résultats", "#resultats"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="relative transition hover:text-blue-600 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-blue-600 after:transition-all after:duration-300 hover:after:w-full"
            >
              {label}
            </Link>
          ))}
        </nav>

        {session?.user ? (
          <UserNav />
        ) : (
          <Button
            variant="outline"
            onClick={openAuthDrawer}
            className=" rounded-full border-blue-950 text-blue-950 hover:bg-blue-950 hover:text-white"
          >
            Se connecter
          </Button>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setMobileServicesOpen(false);
          }}
          className="rounded-xl border border-blue-100 p-2 text-blue-950 transition hover:bg-blue-50 lg:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-blue-100 bg-white lg:hidden">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-4 sm:px-6">
            <div className="relative md:hidden">
              <Search className="absolute left-3 top-3 h-4 w-4 text-blue-950" />
              <Input
                className="rounded-full border-blue-100 bg-blue-50/70 pl-10"
                placeholder="Rechercher..."
              />
            </div>

            <Link
              href="#etablissements"
              onClick={closeMobileMenu}
              className={mobileLinkClass}
            >
              Établissements
            </Link>

            <Link
              href="#resultats"
              onClick={closeMobileMenu}
              className={mobileLinkClass}
            >
              Résultats
            </Link>

            <Link
              href="#contact"
              onClick={closeMobileMenu}
              className={mobileLinkClass}
            >
              Contact
            </Link>

            <div className="rounded-2xl bg-blue-50 p-3">
              <button
                type="button"
                onClick={() => setMobileServicesOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-blue-950 transition hover:bg-white"
              >
                Services
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${
                    mobileServicesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {mobileServicesOpen && (
                <div className="mt-2 grid gap-2">
                  {serviceMenuItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm transition hover:bg-blue-100"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-950 text-white">
                        <item.icon className="h-4 w-4" />
                      </span>

                      <span className="font-semibold text-blue-950">
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {session?.user ? (
                <div className="hidden justify-center lg:flex">
                  <UserNav />
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={openAuthDrawer}
                  className="hidden rounded-full border-blue-950 text-blue-950 hover:bg-blue-950 hover:text-white lg:inline-flex"
                >
                  Se connecter
                </Button>
              )}
              <Button
                asChild
                className="hidden rounded-full bg-blue-600 hover:bg-blue-700 lg:inline-flex"
              >
                <Link href="/inscription-ecole">Inscrire une école</Link>
              </Button>
              <Button
                asChild
                className="
    group
    relative
    hidden
    overflow-hidden
    rounded-full
    border-0
    bg-gradient-to-r
    from-blue-600
    via-cyan-500
    to-blue-700
    px-6
    font-semibold
    text-white
    shadow-[0_0_20px_rgba(59,130,246,.35)]
    transition-all
    duration-300
    hover:scale-105
    hover:shadow-[0_0_35px_rgba(34,211,238,.8)]
    lg:inline-flex
  "
              >
                <Link
                  href="/inscription-ecole"
                  className="relative flex items-center gap-2"
                >
                  {/* Effet électrique */}
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="electric-line" />
                  </span>

                  <span className="relative z-10 flex items-center gap-2">
                    ⚡ Inscrire une école
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {authOpen && (
        <>
          {/* OVERLAY */}
          <div
            onClick={() => setAuthOpen(false)}
            className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm"
          />

          {/* DRAWER */}
          <div
            className="
        fixed right-0 top-0 z-[1001]
        h-screen w-full max-w-[450px]
        bg-background/95 backdrop-blur-3xl
        border-l shadow-2xl
      "
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
                        {authMode === "login"
                          ? "Se connecter"
                          : "Créer un compte"}
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
                      {authMode === "login"
                        ? "Créer un compte"
                        : "Se connecter"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
