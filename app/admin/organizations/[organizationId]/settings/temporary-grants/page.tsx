"use client";

import { useEffect, useState, use } from "react";
import {
  KeyRound,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { BackLink } from "@/components/ui/back-link";
import { TemporaryGrantModal } from "@/components/auth/temporary-grant-modal";
import {
  getOrganizationTemporaryGrantsAction,
  revokeTemporaryPrivilegeAction,
} from "./actions";

type GrantItem = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
    role?: string | null;
  };
  resource: string;
  action: string;
  reason: string;
  grantedBy: {
    id: string;
    name: string;
  };
  revokedBy?: {
    id: string;
    name: string;
  } | null;
  startsAt: Date | string;
  expiresAt: Date | string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  revocationReason?: string | null;
  createdAt: Date | string;
};

export default function TemporaryGrantsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = use(params);

  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadGrants = async () => {
    setLoading(true);
    try {
      const res = await getOrganizationTemporaryGrantsAction(organizationId);
      if (res.ok && res.grants) {
        setGrants(res.grants as unknown as GrantItem[]);
      } else if (!res.ok) {
        toast.error(res.message);
      }
    } catch {
      toast.error("Erreur lors du chargement des privilèges.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrants();
  }, [organizationId]);

  const handleRevoke = async (grantId: string) => {
    setRevokingId(grantId);
    try {
      const res = await revokeTemporaryPrivilegeAction(organizationId, grantId, "Révocation manuelle par l'administrateur");
      if (res.ok) {
        toast.success(res.message);
        loadGrants();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Échec de la révocation du privilège.");
    } finally {
      setRevokingId(null);
    }
  };

  const activeGrants = grants.filter((g) => g.status === "ACTIVE" && new Date(g.expiresAt) > new Date());
  const historyGrants = grants.filter((g) => g.status !== "ACTIVE" || new Date(g.expiresAt) <= new Date());

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <KeyRound className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Sécurité
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Gestion des Privilèges Temporaires
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Accordez des autorisations d'accès temporaires (Just-In-Time) révoquées automatiquement à l'échéance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadGrants} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Accorder un Privilège
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium text-amber-700 dark:text-amber-300">
              <span>Privilèges Actifs</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{activeGrants.length}</div>
            <p className="text-xs text-muted-foreground">En cours d'utilisation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>Total Octroyés</span>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{grants.length}</div>
            <p className="text-xs text-muted-foreground">Depuis l'historique</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <span>Révoqués / Expirés</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{historyGrants.length}</div>
            <p className="text-xs text-muted-foreground">Accès désactivés</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-1.5 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-amber-500" /> Privilèges Temporaires Actifs
          </CardTitle>
          <CardDescription>
            Liste des accès temporaires en cours de validité.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement des privilèges...
            </div>
          ) : activeGrants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              Aucun privilège temporaire n'est actif pour le moment.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Accordé par</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGrants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell className="font-medium">
                      <div>{grant.user.name}</div>
                      <div className="text-xs text-muted-foreground">{grant.user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30">
                        {grant.resource}:{grant.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={grant.reason}>
                      {grant.reason}
                    </TableCell>
                    <TableCell className="text-xs">
                      {grant.grantedBy.name}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-300">
                      {new Date(grant.expiresAt).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revokingId === grant.id}
                        onClick={() => handleRevoke(grant.id)}
                        className="h-8 gap-1.5"
                      >
                        {revokingId === grant.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Révoquer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1.5 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" /> Historique et Audit Log
          </CardTitle>
          <CardDescription>
            Registre des privilèges expiré ou révoqués antérieurement.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {historyGrants.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              L'historique des privilèges est vide.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Date d'échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyGrants.map((grant) => (
                  <TableRow key={grant.id} className="opacity-75">
                    <TableCell className="font-medium text-xs">
                      <div>{grant.user.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {grant.resource}:{grant.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {grant.status === "REVOKED" ? (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" /> Révoqué
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Expiré
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={grant.reason}>
                      {grant.reason}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {new Date(grant.expiresAt).toLocaleString("fr-FR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TemporaryGrantModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        organizationId={organizationId}
        onSuccess={loadGrants}
      />
    </div>
  );
}
