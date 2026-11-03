'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, Plus, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AdminPageTitle,
  ErrorBanner,
  MetricCard,
  PaginationControls,
  StatusBadge,
} from '@/components/admin/admin-components';
import { useAuth } from '@/components/auth/auth-provider';
import {
  adminApi,
  type AdminRole,
  type AdminUser,
  type PageMeta,
  type UserStatus,
} from '@/lib/admin-api';
import { AUTH_MODE } from '@/lib/auth';

const PAGE_SIZE = 20;
const INITIAL_META: PageMeta = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function UserStatusCell({ user }: { user: AdminUser }) {
  const blockedUntil = user.bloqueadoHasta ? new Date(user.bloqueadoHasta) : null;
  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    return (
      <div className="space-y-1">
        <span className="inline-flex rounded-full bg-[hsl(var(--warning-bg))] px-2.5 py-1 caption-small font-medium text-[hsl(var(--warning))]">
          Bloqueo temporal
        </span>
        <p className="caption-small text-muted-foreground">Finaliza {formatDate(user.bloqueadoHasta)}</p>
      </div>
    );
  }
  return <StatusBadge status={user.estado} />;
}

function CreateUserDialog({
  open,
  roles,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  roles: AdminRole[];
  onOpenChange: (open: boolean) => void;
  onCreate: (user: {
    username: string;
    email?: string;
    password: string;
    rolId: string;
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rolId && roles.length > 0) setRolId(roles[0].id);
  }, [rolId, roles]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username.trim())) {
      setError('El usuario debe tener entre 3 y 100 caracteres: letras, números, punto, guion o guion bajo.');
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,200}$/.test(password)) {
      setError('La contraseña debe tener 8 caracteres, una mayúscula, un número y un símbolo.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        username: username.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
        rolId,
      });
      setUsername('');
      setEmail('');
      setPassword('');
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Registra una cuenta y asigna uno de los roles existentes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <label className="block space-y-1.5">
            <span className="body-medium">Usuario</span>
            <Input
              required
              minLength={3}
              maxLength={100}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="nombre.apellido"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="body-medium">Correo (opcional)</span>
            <Input
              type="email"
              maxLength={200}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@arca.bo"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="body-medium">Contraseña inicial</span>
            <Input
              type="password"
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,200}"
              title="Debe tener 8 caracteres, una mayúscula, un número y un símbolo."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="body-medium">Rol</span>
            <select
              required
              value={rolId}
              onChange={(event) => setRolId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nombre}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || roles.length === 0}>
              {saving ? 'Creando…' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { request } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleList, userPage] = await Promise.all([
        adminApi.listRoles(request),
        adminApi.listUsers(request, {
          q: search.trim(),
          estado: statusFilter,
          rol: roleFilter,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setRoles(roleList);
      setUsers(userPage.data);
      setMeta(userPage.meta);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, [page, request, roleFilter, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const temporaryLocks = users.filter((user) => {
    const until = user.bloqueadoHasta ? new Date(user.bloqueadoHasta).getTime() : 0;
    return until > Date.now();
  }).length;
  const activeUsers = users.filter((user) => user.estado === 'ACTIVO').length;
  const lastCreated = useMemo(
    () =>
      users.reduce<string | null>(
        (latest, user) =>
          !latest || new Date(user.creadoEn) > new Date(latest) ? user.creadoEn : latest,
        null,
      ),
    [users],
  );

  const mutate = async (userId: string, operation: () => Promise<AdminUser>, message: string) => {
    setPendingUserId(userId);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el usuario.');
    } finally {
      setPendingUserId(null);
    }
  };

  const createUser = async (user: {
    username: string;
    email?: string;
    password: string;
    rolId: string;
  }) => {
    await adminApi.createUser(request, user);
    setPage(1);
    setNotice('El usuario se creó correctamente.');
    await load();
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    void load();
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageTitle
        title="Usuarios y roles"
        description="Administra accesos, roles y estados de seguridad."
        action={
          <Button onClick={() => setCreateOpen(true)} className="h-10 gap-2">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: los cambios quedan guardados solo en esta sesión del navegador.
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {notice && (
        <div role="status" className="mb-4 rounded-md border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-bg))] px-4 py-3 body-default text-[hsl(var(--success))]">
          {notice}
        </div>
      )}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Usuarios activos en esta página" value={activeUsers} />
        <MetricCard label="Bloqueos temporales en esta página" value={temporaryLocks} />
        <MetricCard label="Roles asignables" value={roles.length} />
        <MetricCard label="Último usuario creado en esta página" value={formatDate(lastCreated)} />
      </section>

      <form
        onSubmit={applyFilters}
        className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(220px,1fr)_200px_180px_auto]"
      >
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="pl-9"
          />
        </label>
        <select
          aria-label="Filtrar por rol"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Todos los roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.codigo}>
              {role.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
          <option value="BLOQUEADO">Bloqueado manual</option>
        </select>
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableHead className="px-4">Usuario</TableHead>
              <TableHead>Rol asignado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="min-w-72">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Cargando usuarios…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  No se encontraron usuarios con esos filtros.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {user.username.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate body-medium text-card-foreground">
                          {user.username}
                        </span>
                        <span className="block truncate caption-small text-muted-foreground">
                          {user.email ?? 'Sin correo registrado'}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Rol de ${user.username}`}
                      value={user.rol.id}
                      disabled={pendingUserId === user.id}
                      onChange={(event) =>
                        void mutate(
                          user.id,
                          () => adminApi.assignRole(request, user.id, event.target.value),
                          `Rol de ${user.username} actualizado.`,
                        )
                      }
                      className="max-w-52 rounded-full border border-border bg-muted px-2.5 py-1 caption-small text-foreground disabled:opacity-50"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.nombre}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <UserStatusCell user={user} />
                  </TableCell>
                  <TableCell className="caption-small text-muted-foreground">
                    {formatDate(user.creadoEn)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {user.estado === 'BLOQUEADO' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingUserId === user.id}
                          onClick={() =>
                            void mutate(
                              user.id,
                              () => adminApi.unlockUser(request, user.id),
                              `Se desbloqueó a ${user.username}.`,
                            )
                          }
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Desbloquear
                        </Button>
                      ) : user.estado === 'ACTIVO' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingUserId === user.id}
                          onClick={() =>
                            void mutate(
                              user.id,
                              () => adminApi.updateUserStatus(request, user.id, 'BLOQUEADO'),
                              `Se bloqueó manualmente a ${user.username}.`,
                            )
                          }
                        >
                          Bloquear
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingUserId === user.id}
                          onClick={() =>
                            void mutate(
                              user.id,
                              () => adminApi.updateUserStatus(request, user.id, 'ACTIVO'),
                              `Se activó a ${user.username}.`,
                            )
                          }
                        >
                          Activar
                        </Button>
                      )}
                      {user.estado === 'ACTIVO' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingUserId === user.id}
                          onClick={() =>
                            void mutate(
                              user.id,
                              () => adminApi.updateUserStatus(request, user.id, 'INACTIVO'),
                              `Se inactivó a ${user.username}.`,
                            )
                          }
                        >
                          Inactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </section>

      <p className="caption-small mt-3 flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        Las acciones se registran en el historial de auditoría.
      </p>

      <CreateUserDialog
        open={createOpen}
        roles={roles}
        onOpenChange={setCreateOpen}
        onCreate={createUser}
      />
    </div>
  );
}
