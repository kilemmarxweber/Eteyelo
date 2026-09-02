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
import { TemporaryGrantModal } from "@/components/auth/temporary-grant-modal";
import {
  getOrganizationTemporaryGrantsAction,
  listTemporaryGrantMembersAction,
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
  const [members, setMembers] = useState<{ userId: string; name: string; email?: string | null; role?: string | null }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadGrants = async () => {
    setLoading(true);
    try {
      const [res, membersResult] = await Promise.all([
        getOrganizationTemporaryGrantsAction(organizationId),
        listTemporaryGrantMembersAction(organizationId),
      ]);
      if (res.ok && res.grants) {
        setGrants(res.grants as unknown as GrantItem[]);

        // Déduire la liste unique des membres pour le sélecteur
        const memberMap = new Map();
        res.grants.forEach((g) => {
          if (g.user && !memberMap.has(g.user.id)) {
            memberMap.set(g.user.id, {
              userId: g.user.id,
              name: g.user.name,
              email: g.user.email,
              role: g.user.role,
            });
          }
        });
        setMembers(Array.from(memberMap.values()));
      } else if (!res.ok) {
        toast.error(res.message);
      }
      if (membersResult.ok) setMembers(membersResult.members);
      else toast.error(membersResult.message);
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
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" /> Gestion des Privilèges Temporaires
          </h1>
          <p className="text-sm text-muted-foreground">
            Accordez des autorisations d'accès temporaires (Just-In-Time) révoquées automatiquement à l'échéance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadGrants} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Accorder un Privilège
          </Button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span>Privilèges Actifs</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 pb-4">
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{activeGrants.length}</div>
            <p className="text-xs text-muted-foreground">En cours d'utilisation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Total Octroyés</span>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 pb-4">
            <div className="text-2xl font-bold">{grants.length}</div>
            <p className="text-xs text-muted-foreground">Depuis l'historique</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-emerald-700 dark:text-emerald-300">
              <span>Révoqués / Expirés</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 pb-4">
            <div className="text-2xl font-bold">{historyGrants.length}</div>
            <p className="text-xs text-muted-foreground">Accès désactivés</p>
          </CardContent>
        </Card>
      </div>

      {/* Privilèges Actifs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Privilèges Temporaires Actifs
          </CardTitle>
          <CardDescription>
            Liste des accès temporaires en cours de validité.
          </CardDescription>
        </CardHeader>
        <CardContent>
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

      {/* Historique des Privilèges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" /> Historique et Audit Log
          </CardTitle>
          <CardDescription>
            Registre des privilèges expiré ou révoqués antérieurement.
          </CardDescription>
        </CardHeader>
        <CardContent>
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

      {/* Modal d'octroi */}
      <TemporaryGrantModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        organizationId={organizationId}
        members={members}
        onSuccess={loadGrants}
      />
    </div>
  );
}
