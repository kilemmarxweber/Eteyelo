"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Camera,
  Globe,
  KeyRound,
  Lock,
  Mail,
  MessageCircleWarning,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  intlLocaleFromUserLocale,
  LOCALE_OPTIONS,
  isUserLocale,
  normalizeUserLocale,
  writeUserLocalePreference,
  type UserLocale,
} from "@/lib/user-locale";
import { updateUserLocaleAction } from "@/lib/user-locale.action";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { normalizeImageSrc } from "@/lib/utils";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { clearMustChangePasswordAction } from "@/app/admin/account/change-password/actions";
import {
  changeEmailSchema,
  changePasswordSchema,
  updateProfileSchema,
  type ChangeEmailValues,
  type ChangePasswordValues,
  type UpdateProfileValues,
} from "./schema";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const SUPPORT_EMAIL = "support@kalasa.cd";

const LOCALE_UPDATED_TOAST: Record<UserLocale, string> = {
  fr: "Langue : français",
  en: "Language: English",
  pt: "Idioma: português de Portugal",
};

type AccountViewProps = {
  memberSince: string | null;
  organizationName: string | null;
  organizationRole: string | null;
  userCreatedAt: string;
};

function getUserInitials(name?: string | null, email?: string | null) {
  const display = name?.trim() || email?.split("@")[0] || "U";
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return display.charAt(0).toUpperCase();
}

function formatDateLocalized(iso: string, locale: string) {
  const tag = locale.startsWith("en")
    ? "en-GB"
    : locale.startsWith("pt")
      ? "pt-PT"
      : "fr-FR";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function AccountView({
  memberSince,
  organizationName,
  organizationRole,
  userCreatedAt,
}: AccountViewProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const activeLocale = useLocale();
  const router = useRouter();
  const [pendingLocale, startLocaleTransition] = useTransition();
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [locale, setLocale] = useState<UserLocale>(
    normalizeUserLocale(activeLocale),
  );

  useEffect(() => {
    setLocale(normalizeUserLocale(activeLocale));
  }, [activeLocale]);

  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: "", image: "" },
  });

  const emailForm = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "" },
  });

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      name: user.name ?? "",
      image: user.image ?? "",
    });
    emailForm.reset({ newEmail: user.email ?? "" });
  }, [user, profileForm, emailForm]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:max-w-4xl md:px-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const initials = getUserInitials(user.name, user.email);
  const memberSinceLabel = memberSince
    ? formatDateLocalized(memberSince, locale)
    : null;
  const accountSinceLabel = formatDateLocalized(userCreatedAt, locale);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error("Image trop volumineuse (max. 5 Mo).");
      return;
    }

    const uploaded = await uploadFile(file);
    if (!uploaded.ok) {
      toast.error(uploaded.message);
      return;
    }

    const { error } = await authClient.updateUser({ image: uploaded.url });
    if (error) {
      toast.error(error.message ?? "Impossible de mettre à jour la photo.");
      return;
    }
    toast.success("Photo de profil mise à jour.");
    await refetch();
  }

  async function onProfileSubmit(values: UpdateProfileValues) {
    const { error } = await authClient.updateUser({
      name: values.name.trim(),
      image: values.image?.trim() || undefined,
    });
    if (error) {
      toast.error(error.message ?? "Mise à jour impossible.");
      return;
    }
    toast.success("Profil mis à jour.");
    setProfileOpen(false);
    await refetch();
  }

  async function onEmailSubmit(values: ChangeEmailValues) {
    const { error } = await authClient.changeEmail({
      newEmail: values.newEmail.trim(),
      callbackURL: "/admin/account",
    });
    if (error) {
      toast.error(error.message ?? "Changement d’email impossible.");
      return;
    }
    toast.success("Vérifiez votre boîte mail pour confirmer le nouvel email.");
    setEmailOpen(false);
  }

  async function onPasswordSubmit(values: ChangePasswordValues) {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      toast.error(error.message ?? "Mot de passe non modifié.");
      return;
    }
    await clearMustChangePasswordAction();
    toast.success("Mot de passe modifié.");
    passwordForm.reset();
    setPasswordOpen(false);
  }

  function handleLocaleChange(value: string) {
    if (!isUserLocale(value)) return;
    const next = value;
    const previous = locale;
    setLocale(next);
    writeUserLocalePreference(next, user.id);
    document.documentElement.lang = intlLocaleFromUserLocale(next);
    startLocaleTransition(() => {
      void updateUserLocaleAction(next)
        .then(() => {
          toast.success(LOCALE_UPDATED_TOAST[next]);
          router.refresh();
        })
        .catch(() => {
          setLocale(previous);
          writeUserLocalePreference(previous, user.id);
          document.documentElement.lang = intlLocaleFromUserLocale(previous);
          toast.error(tCommon("errorGeneric"));
        });
    });
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] md:max-w-4xl md:px-6">
      <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-6 text-center">
        <button
          type="button"
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("changePhoto")}
        >
          <Avatar className="size-20">
            <AvatarImage
              src={normalizeImageSrc(user.image)}
              alt={user.name ?? ""}
            />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border bg-background shadow-sm">
            <Camera className="size-3.5 text-muted-foreground" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImageFile(file);
            event.target.value = "";
          }}
        />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {organizationName ? (
            <p className="text-xs text-muted-foreground">
              {organizationName}
              {organizationRole
                ? ` · ${orgRoleLabel(organizationRole)}`
                : null}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {memberSinceLabel ?? accountSinceLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setProfileOpen(true)}
        >
          {t("editProfile")}
        </Button>
      </section>

      <ListGroup title={t("sectionAccount")}>
        <ListItem
          title={t("nameAndPhoto")}
          subtitle={user.name}
          leading={<User className="size-5 text-muted-foreground" />}
          onClick={() => setProfileOpen(true)}
        />
        <ListItem
          title={t("email")}
          subtitle={user.email}
          leading={<Mail className="size-5 text-muted-foreground" />}
          onClick={() => setEmailOpen(true)}
        />
        <ListItem
          title={t("language")}
          subtitle={LOCALE_OPTIONS.find((o) => o.value === locale)?.label}
          leading={<Globe className="size-5 text-muted-foreground" />}
          trailing={
            <Select
              value={locale}
              onValueChange={handleLocaleChange}
              disabled={pendingLocale}
            >
              <SelectTrigger
                className="h-9 w-[8.5rem] shrink-0"
                aria-label={t("languageHint")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.nativeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          showChevron={false}
        />
        <ListItem
          title={t("password")}
          subtitle={t("passwordHint")}
          leading={<KeyRound className="size-5 text-muted-foreground" />}
          onClick={() => setPasswordOpen(true)}
        />
      </ListGroup>

      <ListGroup title={t("sectionApp")}>
        <ListItem
          title={t("privacy")}
          subtitle={t("privacyHint")}
          leading={<Lock className="size-5 text-muted-foreground" />}
          href="/admin/help"
        />
        <ListItem
          title={t("version")}
          subtitle={`Kalasa v${APP_VERSION}`}
          showChevron={false}
        />
        <ListItem
          title={t("reportIssue")}
          subtitle={t("reportHint")}
          leading={
            <MessageCircleWarning className="size-5 text-muted-foreground" />
          }
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Signalement Kalasa")}`}
        />
      </ListGroup>

      <ResponsiveDialog open={profileOpen} onOpenChange={setProfileOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("profileTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("profileDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...profileForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            >
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" autoComplete="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la photo (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-11"
                        placeholder="https://…"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={profileForm.formState.isSubmitting}
                >
                  {profileForm.formState.isSubmitting
                    ? tCommon("loading")
                    : tCommon("save")}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={emailOpen} onOpenChange={setEmailOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("email")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Un lien de confirmation sera envoyé à la nouvelle adresse.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...emailForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            >
              <FormField
                control={emailForm.control}
                name="newEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouvel email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        className="h-11"
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting
                    ? tCommon("loading")
                    : tCommon("continue")}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("password")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Les autres sessions seront déconnectées après le changement.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...passwordForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe actuel</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {passwordForm.formState.isSubmitting
                    ? tCommon("loading")
                    : t("passwordHint")}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
