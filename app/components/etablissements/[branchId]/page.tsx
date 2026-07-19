import { notFound } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LibraryBig,
  Mail,
  MapPin,
  Phone,
  School,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { prisma } from "@/lib/prisma";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { getBranchImage } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

export default async function EtablissementDetailPage({ params }: PageProps) {
  const { branchId } = await params;

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      adresse: true,
      tel: true,
      ville: true,
      pays: true,
      idnat: true,
      image: true,
      createdAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      branchemembers: {
        select: {
          role: true,
          student: {
            select: {
              id: true,
              createdAt: true,
              branchMember: {
                select: {
                  member: {
                    select: {
                      user: {
                        select: {
                          name: true,
                          prenom: true,
                          postnom: true,
                          sexe: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          parent: {
            select: {
              id: true,
            },
          },
          member: {
            select: {
              user: {
                select: {
                  name: true,
                  prenom: true,
                  postnom: true,
                  email: true,
                  telephone: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!branch) notFound();

  const images = getBranchImage(branch.image);
  const cover =
    images.ecole[0] ||
    images.event[0] ||
    images.gallery[0] ||
    images.logo ||
    KLAMBOCORE_DEFAULT_IMAGE_PATH;

  const students = branch.branchemembers.flatMap((member) => member.student);

  const totalStudents = students.length;

  const girls = students.filter(
    (student) => student.branchMember.member.user.sexe === "F",
  );

  const boys = students.filter(
    (student) => student.branchMember.member.user.sexe === "M",
  );

  const teachers = branch.branchemembers.filter(
    (member) => member.role === "TEACHER",
  );

  const admins = branch.branchemembers.filter((member) =>
    ["ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"].includes(member.role),
  );

  const parents = branch.branchemembers.filter((member) => member.parent);

  const studentsByYear = students.reduce<Record<string, number>>(
    (acc, student) => {
      const year = student?.createdAt
        ? new Date(student.createdAt).getFullYear().toString()
        : "Inconnue";

      acc[year] = (acc[year] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const gallery = Array.from(
    new Set([...images.ecole, ...images.gallery, ...images.event]),
  ).slice(0, 8);

  const references = [
    {
      label: "Code école",
      value: branch.code,
    },
    {
      label: "ID NAT",
      value: branch.idnat,
    },
    {
      label: "Organisation",
      value: branch.organization?.name,
    },
    {
      label: "Ville",
      value: branch.ville,
    },
    {
      label: "Pays",
      value: branch.pays,
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <HomeNavbar />

      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url('${cover}')` }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/30" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <Badge className="bg-primary-foreground/15 text-primary-foreground">
              <School className="mr-1 h-3 w-3" />
              Établissement partenaire
            </Badge>

            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
              {branch.name}
            </h1>

            <div className="mt-5 grid gap-3 text-sm text-primary-foreground/90 sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {branch.adresse || "Adresse non renseignée"}
              </p>

              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {branch.tel || "Téléphone non renseigné"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 backdrop-blur">
            <p className="text-sm text-primary-foreground/80">Résumé rapide</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Élèves" value={totalStudents} icon={Users} />
              <Stat
                label="Enseignants"
                value={teachers.length}
                icon={GraduationCap}
              />
              <Stat label="Parents" value={parents.length} icon={UserRound} />
              <Stat
                label="Administration"
                value={admins.length}
                icon={BriefcaseBusiness}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card title="Références de l’établissement" icon={Building2}>
            <div className="grid gap-3 sm:grid-cols-2">
              {references.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-primary/5 p-4"
                >
                  <p className="text-xs font-bold uppercase text-primary">
                    {item.label}
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {item.value || "Non renseigné"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Statistiques élèves" icon={Users}>
            <div className="grid gap-4 sm:grid-cols-3">
              <BigStat label="Total élèves" value={totalStudents} />
              <BigStat label="Garçons" value={boys.length} />
              <BigStat label="Filles" value={girls.length} />
            </div>

            <div className="mt-6">
              <h3 className="mb-3 font-black text-foreground">
                Nombre d’élèves par année
              </h3>

              <div className="space-y-2">
                {Object.entries(studentsByYear).map(([year, count]) => (
                  <div
                    key={year}
                    className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3"
                  >
                    <span className="font-semibold text-foreground">
                      Année {year}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                      {count} élève(s)
                    </span>
                  </div>
                ))}

                {!Object.keys(studentsByYear).length ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun élève enregistré pour le moment.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title="Galerie de l’école" icon={LibraryBig}>
            {gallery.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {gallery.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="aspect-square rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url('${image}')` }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune galerie disponible.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Équipe pédagogique" icon={GraduationCap}>
            <p className="text-3xl font-black text-foreground">
              {teachers.length}
            </p>
            <p className="text-sm text-muted-foreground">enseignant(s)</p>

            <div className="mt-4 space-y-2">
              {teachers.slice(0, 8).map((teacher, index) => {
                const user = teacher.member.user;
                const name = [user.prenom, user.name, user.postnom]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <PersonRow
                    key={`${name}-${index}`}
                    name={name || "Enseignant"}
                    detail={
                      user.email || user.telephone || "Contact non renseigné"
                    }
                  />
                );
              })}
            </div>
          </Card>

          <Card title="Personnel administratif" icon={BriefcaseBusiness}>
            <p className="text-3xl font-black text-foreground">{admins.length}</p>
            <p className="text-sm text-muted-foreground">membre(s)</p>

            <div className="mt-4 space-y-2">
              {admins.slice(0, 8).map((admin, index) => {
                const user = admin.member.user;
                const name = [user.prenom, user.name, user.postnom]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <PersonRow
                    key={`${name}-${index}`}
                    name={name || "Personnel"}
                    detail={`Poste : ${admin.role}`}
                  />
                );
              })}
            </div>
          </Card>

          <Card title="Infrastructures" icon={BookOpen}>
            <div className="grid gap-3">
              <FeatureItem
                icon={LibraryBig}
                title="Bibliothèque"
                enabled={false}
                description="À connecter avec un champ hasLibrary dans Branch."
              />

              <FeatureItem
                icon={Wrench}
                title="Ateliers pratiques"
                enabled={false}
                description="À connecter avec un champ hasWorkshops dans Branch."
              />

              <FeatureItem
                icon={CheckCircle2}
                title="Fondation"
                enabled={false}
                description="À connecter avec foundationName dans Branch."
              />
            </div>
          </Card>
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl bg-primary-foreground/10 p-4">
      <Icon className="h-5 w-5 text-primary-foreground/80" />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs text-primary-foreground/80">{label}</p>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
      <p className="text-3xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-sm font-semibold text-primary">{label}</p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-black text-foreground">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function PersonRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
      <div>
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
  enabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-primary/5 p-4">
      <Icon className="mt-1 h-5 w-5 text-primary" />

      <div>
        <p className="font-black text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <Badge
          className={
            enabled
              ? "mt-3 bg-emerald-100 text-emerald-700"
              : "mt-3 bg-muted text-muted-foreground"
          }
        >
          {enabled ? "Disponible" : "Non renseigné"}
        </Badge>
      </div>
    </div>
  );
}
