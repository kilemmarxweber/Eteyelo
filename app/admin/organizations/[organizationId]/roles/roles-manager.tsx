"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconCopy, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PERMISSION_MATRIX_GROUPS,
  actionLabelFr,
  permissionLabelFr,
  resourceLabelFr,
} from "@/lib/permission-labels-fr";
import { accessControlStatements } from "@/lib/permissions";
import {
  createOrganizationRoleAction,
  deleteOrganizationRoleAction,
  listOrganizationRolesAction,
  resetOrganizationRoleToSeedAction,
  updateOrganizationRoleAction,
  type OrgRoleListItem,
} from "./roles.action";

function emptyPermission(): Record<string, string[]> {
  return {};
}

function toggleAction(
  current: Record<string, string[]>,
  resource: string,
  action: string,
  checked: boolean,
): Record<string, string[]> {
  const next = { ...current };
  const set = new Set(next[resource] ?? []);
  if (checked) set.add(action);
  else set.delete(action);
  if (set.size === 0) delete next[resource];
  else next[resource] = [...set];
  return next;
}

function RoleMatrixEditor({
  permission,
  disabled,
  onChange,
}: {
  permission: Record<string, string[]>;
  disabled?: boolean;
  onChange: (next: Record<string, string[]>) => void;
}) {
  const catalog = accessControlStatements as Record<string, readonly string[]>;

  return (
    <div className="space-y-6">
      {PERMISSION_MATRIX_GROUPS.map((group) => {
        const resources = group.resources.filter((r) => catalog[r]);
        if (!resources.length) return null;
        return (
          <section key={group.id} className="space-y-3">
            <h4 className="text-sm font-semibold">{group.label}</h4>
            <div className="space-y-4">
              {resources.map((resource) => {
                const actions = catalog[resource] ?? [];
                return (
                  <div key={resource} className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {resourceLabelFr(resource)}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {actions.map((action) => {
                        const a = String(action);
                        const checked = (permission[resource] ?? []).includes(a);
                        return (
                          <label
                            key={`${resource}:${a}`}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(v) => {
                                onChange(
                                  toggleAction(
                                    permission,
                                    resource,
                                    a,
                                    v === true,
                                  ),
                                );
                              }}
                            />
                            <span title={permissionLabelFr(resource, a)}>
                              {actionLabelFr(a)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function OrganizationRolesManager({
  organizationId,
}: {
  organizationId: string;
}) {
  const [items, setItems] = useState<OrgRoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OrgRoleListItem | null>(null);
  const [draftPermission, setDraftPermission] = useState<
    Record<string, string[]>
  >({});
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [data, err] = await listOrganizationRolesAction({ organizationId });
    setLoading(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    setItems(data);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const customs = useMemo(
    () => items.filter((i) => !i.isSystem),
    [items],
  );
  const systems = useMemo(
    () => items.filter((i) => i.isSystem),
    [items],
  );

  function openEdit(item: OrgRoleListItem) {
    setEditing(item);
    // Copie profonde des tableaux d’actions (évite de muter l’item listé).
    const permissionCopy: Record<string, string[]> = {};
    for (const [key, actions] of Object.entries(item.permission)) {
      permissionCopy[key] = [...actions];
    }
    setDraftPermission(permissionCopy);
    setDraftLabel(item.label);
    setDraftDescription(item.description);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const [, err] = await updateOrganizationRoleAction({
      organizationId,
      slug: editing.slug,
      label: draftLabel,
      description: draftDescription,
      permission: draftPermission,
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(
      "Rôle enregistré. Les utilisateurs de ce rôle voient les nouveaux droits après rechargement.",
    );
    setEditing(null);
    await load();
  }

  async function handleReset(slug: string) {
    setSaving(true);
    const [, err] = await resetOrganizationRoleToSeedAction({
      organizationId,
      slug,
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Rôle réinitialisé au seed.");
    setEditing(null);
    await load();
  }

  async function handleDelete(slug: string) {
    setSaving(true);
    const [, err] = await deleteOrganizationRoleAction({
      organizationId,
      slug,
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Rôle supprimé.");
    setEditing(null);
    await load();
  }

  async function handleCreate() {
    setSaving(true);
    const [, err] = await createOrganizationRoleAction({
      organizationId,
      slug: newSlug.trim().toLowerCase(),
      label: newLabel.trim(),
      cloneFrom: cloneFrom || undefined,
      permission: cloneFrom ? undefined : emptyPermission(),
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Rôle créé.");
    setCreating(false);
    setNewSlug("");
    setNewLabel("");
    setCloneFrom("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="max-w-7xl text-sm text-muted-foreground">
          Matrice des rôles de l&apos;organisation. Les presets système sont
          éditables (sauf propriétaire). Les customs peuvent être créés, clonés
          et supprimés s&apos;ils n&apos;ont plus de membres.
        </p>
        <Button
          type="button"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => setCreating(true)}
        >
          <IconPlus size={16} className="mr-2" />
          Créer un rôle
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement des rôles…</p>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Presets système</h2>
            <div className="divide-y rounded-md border">
              {systems.map((item) => (
                <div
                  key={item.slug}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="font-medium">{item.label}</h3>
                      <Badge variant="secondary">système</Badge>
                      {item.locked ? (
                        <Badge variant="outline">verrouillé</Badge>
                      ) : null}
                      <span className="max-w-full break-all font-mono text-xs text-muted-foreground">
                        {item.slug}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.memberCount} membre(s) ·{" "}
                      {Object.values(item.permission).flat().length} permission(s)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={item.locked}
                    onClick={() => openEdit(item)}
                  >
                    {item.locked ? "Lecture seule" : "Modifier"}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Rôles personnalisés</h2>
            {!customs.length ? (
              <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Aucun rôle custom. Créez par ex. « Secrétaire » et cochez les
                droits finance / inscription.
              </p>
            ) : (
              <div className="divide-y rounded-md border">
                {customs.map((item) => (
                  <div
                    key={item.slug}
                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="font-medium">{item.label}</h3>
                        <Badge variant="outline">custom</Badge>
                        <span className="max-w-full break-all font-mono text-xs text-muted-foreground">
                          {item.slug}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.description || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.memberCount} membre(s)
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openEdit(item)}
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive sm:w-auto"
                        disabled={item.memberCount > 0 || saving}
                        onClick={() => void handleDelete(item.slug)}
                      >
                        <IconTrash size={16} className="mr-1.5" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,42rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[42rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>{editing?.label}</SheetTitle>
            <SheetDescription>
              slug · {editing?.slug}
              {editing?.isSystem
                ? " — preset système (slug non renommable)"
                : " — rôle personnalisé"}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="role-label">Libellé</Label>
              <Input
                id="role-label"
                value={draftLabel}
                disabled={editing?.locked}
                onChange={(e) => setDraftLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={draftDescription}
                disabled={editing?.locked}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </div>
            <RoleMatrixEditor
              permission={draftPermission}
              disabled={editing?.locked}
              onChange={(next) => setDraftPermission(next)}
            />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t px-5 py-3 sm:px-6">
            {editing?.isSystem && !editing.locked ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void handleReset(editing.slug)}
              >
                <IconRefresh size={16} className="mr-1.5" />
                Réinitialiser au seed
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={saving || editing?.locked}
                onClick={() => void handleSave()}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,28rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Créer un rôle</SheetTitle>
            <SheetDescription>
              Clonez un preset (ex. caissier) puis ajustez la matrice.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="new-slug">Slug</Label>
              <Input
                id="new-slug"
                placeholder="secretaire"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-label">Libellé</Label>
              <Input
                id="new-label"
                placeholder="Secrétaire"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-from">Cloner depuis</Label>
              <select
                id="clone-from"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={cloneFrom}
                onChange={(e) => setCloneFrom(e.target.value)}
              >
                <option value="">— vide —</option>
                {items.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreating(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={saving || !newSlug.trim() || !newLabel.trim()}
              onClick={() => void handleCreate()}
            >
              <IconCopy size={16} className="mr-1.5" />
              {saving ? "Création…" : "Créer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
