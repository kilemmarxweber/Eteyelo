"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import {
  IconUsers,
  IconSchool,
  IconBook,
  IconCurrencyDollar,
  IconChartBar,
  IconTrendingUp,
  IconCalendar,
} from "@tabler/icons-react";
import {
  createParentFeedback,
  getAdminStats,
  getDashboardMetrics,
  getParentFeedbackStatus,
} from "./admin-stats";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCalendarEvents } from "./CalendarEvent/CalendarEvent.acton";

export default function AdminDashboard() {
  // ✅ params (Promise style support indirect via useParams)
  const params = useParams();

  const organizationId = params.organizationId as string;
  const branchId = params.branchId as string;
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  // Fonction pour récupérer les statistiques
  const [metrics, setMetrics] = useState({
    attendance: 0,
    successRate: 0,
    satisfaction: 0,
  });
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminStats({ branchId, organizationId });
        setStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, err] = await getCalendarEvents();

        if (!err) {
          setEvents(eventsData || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const [data, err] = await getDashboardMetrics();

        if (err) {
          console.error(err);
          return;
        }

        setMetrics(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, []);

  useEffect(() => {
    const check = async () => {
      const [data, err] = await getParentFeedbackStatus({
        branchId,
        organizationId,
      });

      if (err) return;

      if (data?.showFeedbackPopup) {
        setShowFeedback(true);
      } else {
        setShowFeedback(false);
      }
    };

    check();
  }, []);
  const quickActions = [
    {
      title: "Gérer les élèves",
      description: "Ajouter, modifier ou archiver des eleves",
      icon: <IconUsers className="h-6 w-6" />,
      href: "/admin/student",
      color: "bg-blue-500",
    },
    {
      title: "Gérer les classes",
      description: "Créer et organiser les classes",
      icon: <IconSchool className="h-6 w-6" />,
      href: "/admin/classe",
      color: "bg-green-500",
    },
    {
      title: "Gérer les cours",
      description: "Configurer les cours et matières",
      icon: <IconBook className="h-6 w-6" />,
      href: "/admin/cours",
      color: "bg-purple-500",
    },
    {
      title: "Gérer les frais",
      description: "Configurer les frais scolaires",
      icon: <IconCurrencyDollar className="h-6 w-6" />,
      href: "/admin/frais",
      color: "bg-orange-500",
    },
  ];
  const upcomingEvents = events
    .filter((event) => new Date(event.dateStart).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime(),
    )
    .slice(0, 5);
  return (
    <>
      {showFeedback && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md min-w-[320px] flex-shrink-0 bg-white rounded-2xl shadow-xl p-6 text-center">
            <h2 className="text-lg font-bold mb-5">
              Comment trouvez-vous l’établissement ?
            </h2>

            {/* emojis */}
            <div className="flex items-center justify-between gap-2 mb-6">
              {[
                { value: 1, icon: "😡" },
                { value: 2, icon: "😕" },
                { value: 3, icon: "😐" },
                { value: 4, icon: "😊" },
                { value: 5, icon: "😍" },
              ].map((e) => (
                <button
                  key={e.value}
                  onClick={() => setSelectedRating(e.value)}
                  className={`text-4xl transition-transform hover:scale-110 active:scale-95 ${
                    selectedRating === e.value ? "scale-110" : ""
                  }`}
                >
                  {e.icon}
                </button>
              ))}
            </div>
            {selectedRating === 1 && (
              <div className="mb-4 text-left">
                <label className="text-sm font-medium text-red-600">
                  Expliquez pourquoi vous êtes insatisfait *
                </label>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full mt-2 p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                  rows={3}
                  placeholder="Décrivez le problème..."
                />

                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
            )}
            <button
              disabled={!selectedRating}
              onClick={async () => {
                if (!selectedRating) return;

                if (selectedRating === 1 && comment.trim().length < 5) {
                  setError("Veuillez expliquer votre insatisfaction");
                  return;
                }

                setError("");

                const res = await createParentFeedback(
                  selectedRating,
                  selectedRating === 1 ? comment : null,
                );

                if (res?.error) {
                  setError(res.error);
                  return;
                }

                setShowFeedback(false);
                setSelectedRating(null);
                setComment("");
                setError("");

                // 🔄 refresh metrics
                const [data, err] = await getDashboardMetrics();

                if (!err) {
                  setMetrics(data);
                }
              }}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}

      <Layout>
        <LayoutBody className="space-y-4">
          <PageHeader
            title="Tableau de bord"
            description="Vue d'ensemble de votre établissement scolaire"
            badge={
              <Badge
                variant="outline-primary"
                icon={<IconChartBar size={14} />}
              >
                Dashboard
              </Badge>
            }
            className="mb-0 space-y-1"
          />
          {/* Statistiques principales */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Élèves</CardTitle>
                <IconUsers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.students?.total}
                </div>
                <p className="text-xs text-muted-foreground">
                  <IconTrendingUp className="inline h-3 w-3 mr-1" />+
                  {stats?.students?.enrollmentRate}% par rapport au mois dernier
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Enseignants
                </CardTitle>
                <IconUsers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.teachers?.total}
                </div>
                <p className="text-xs text-muted-foreground">
                  <IconTrendingUp className="inline h-3 w-3 mr-1" />+
                  {stats?.teachers?.active}% par rapport au mois dernier
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Classes</CardTitle>
                <IconSchool className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.classes?.total}
                </div>
                <p className="text-xs text-muted-foreground">
                  <IconTrendingUp className="inline h-3 w-3 mr-1" />+
                  {stats?.classes?.occupancyRate}% par rapport au mois dernier
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus</CardTitle>
                <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.revenue?.current} $
                </div>
                <p className="text-xs text-muted-foreground">
                  <IconTrendingUp className="inline h-3 w-3 mr-1" />+ z dernier
                </p>
              </CardContent>
            </Card>
          </div>
          {/* Actions rapides */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                    <div
                      className={`p-2 rounded-lg ${action.color} text-white`}
                    >
                      {action.icon}
                    </div>
                    <CardTitle className="text-sm font-medium ml-3">
                      {action.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {/* Graphiques et métriques supplémentaires */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconCalendar className="h-5 w-5" />
                  Prochains événements
                </CardTitle>
                <CardDescription>
                  Événements à venir dans votre établissement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((event) => {
                      const eventDate = new Date(event.dateStart);

                      const diffDays = Math.ceil(
                        (eventDate.getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      );

                      return (
                        <div
                          key={event.id}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{event.title}</p>

                            <p className="text-xs text-muted-foreground">
                              {eventDate.toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <Badge variant="outline">
                            {diffDays === 0
                              ? "Aujourd'hui"
                              : `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun événement à venir
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChartBar className="h-5 w-5" />
                  Métriques de performance
                </CardTitle>
                <CardDescription>
                  Indicateurs clés de votre établissement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Taux de présence
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.attendance}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${metrics.attendance}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Taux de réussite
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.successRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${metrics.successRate}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Satisfaction parents
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.satisfaction}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${metrics.satisfaction}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </LayoutBody>
      </Layout>
    </>
  );
}
