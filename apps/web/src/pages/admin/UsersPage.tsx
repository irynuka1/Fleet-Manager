import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Search, Users, UserCog, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';

// --- Types ---

type UserRole = 'SUPER_ADMIN' | 'COUNTRY_MANAGER' | 'AGENCY_MANAGER';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  agencyId: string | null;
  agency: { id: string; name: string } | null;
  createdAt: string;
}

interface UsersResponse {
  success: boolean;
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AgencyOption {
  id: string;
  name: string;
}

// --- Constants ---

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  COUNTRY_MANAGER: 'Manager Tara',
  AGENCY_MANAGER: 'Manager Agentie',
};

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-500/10 text-red-600 border-red-500/20',
  COUNTRY_MANAGER: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  AGENCY_MANAGER: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

// --- Schemas ---

const createUserSchema = z
  .object({
    firstName: z.string().min(1, 'Prenumele este obligatoriu'),
    lastName: z.string().min(1, 'Numele este obligatoriu'),
    email: z.string().email('Adresa de email invalida'),
    password: z.string().min(6, 'Parola trebuie sa aiba minim 6 caractere'),
    role: z.enum(['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'], {
      required_error: 'Rolul este obligatoriu',
    }),
    agencyId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'AGENCY_MANAGER' && !data.agencyId) return false;
      return true;
    },
    {
      message: 'Agentia este obligatorie pentru Manager Agentie',
      path: ['agencyId'],
    }
  );

const editUserSchema = z
  .object({
    firstName: z.string().min(1, 'Prenumele este obligatoriu'),
    lastName: z.string().min(1, 'Numele este obligatoriu'),
    email: z.string().email('Adresa de email invalida'),
    password: z.string().optional(),
    role: z.enum(['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'], {
      required_error: 'Rolul este obligatoriu',
    }),
    agencyId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'AGENCY_MANAGER' && !data.agencyId) return false;
      return true;
    },
    {
      message: 'Agentia este obligatorie pentru Manager Agentie',
      path: ['agencyId'],
    }
  );

type UserFormValues = z.infer<typeof createUserSchema>;

// --- Component ---

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const limit = 20;

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // --- Queries ---

  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get('/users', {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      return data;
    },
  });

  const { data: agenciesData } = useQuery<{ data: AgencyOption[] }>({
    queryKey: ['agencies-list'],
    queryFn: async () => {
      const { data } = await api.get('/agencies', { params: { limit: 100 } });
      return data;
    },
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => api.post('/users', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilizatorul a fost creat cu succes');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la crearea utilizatorului');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<UserFormValues> }) =>
      api.put(`/users/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilizatorul a fost actualizat cu succes');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la actualizarea utilizatorului');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilizatorul a fost sters cu succes');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea utilizatorului');
    },
  });

  // --- Form ---

  const form = useForm<UserFormValues>({
    resolver: zodResolver(editingUser ? editUserSchema : createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'AGENCY_MANAGER' as UserRole,
      agencyId: '',
    },
  });

  const watchedRole = form.watch('role');

  // Clear agencyId when role is not AGENCY_MANAGER
  useEffect(() => {
    if (watchedRole !== 'AGENCY_MANAGER') {
      form.setValue('agencyId', '');
    }
  }, [watchedRole, form]);

  // --- Handlers ---

  function handleOpenCreate() {
    setEditingUser(null);
    form.reset({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'AGENCY_MANAGER',
      agencyId: '',
    });
    setDialogOpen(true);
  }

  function handleOpenEdit(user: User) {
    setEditingUser(user);
    form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
      agencyId: user.agencyId ?? '',
    });
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    form.reset({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'AGENCY_MANAGER',
      agencyId: '',
    });
  }

  function handleOpenDelete(user: User) {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  }

  function onSubmit(values: UserFormValues) {
    if (editingUser) {
      const payload: Partial<UserFormValues> = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        role: values.role,
        agencyId: values.role === 'AGENCY_MANAGER' ? values.agencyId : null,
      };
      if (values.password) {
        payload.password = values.password;
      }
      updateMutation.mutate({ id: editingUser.id, values: payload });
    } else {
      const payload = {
        ...values,
        agencyId: values.role === 'AGENCY_MANAGER' ? values.agencyId : null,
      };
      createMutation.mutate(payload);
    }
  }

  function handleConfirmDelete() {
    if (deletingUser) {
      deleteMutation.mutate(deletingUser.id);
    }
  }

  const users = usersData?.data ?? [];
  const totalPages = usersData?.totalPages ?? 1;
  const total = usersData?.total ?? 0;
  const agencies = agenciesData?.data ?? [];
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader title="Management Utilizatori" description={`${total} utilizatori inregistrati`}>
        <Button onClick={handleOpenCreate} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20">
          <Plus className="mr-2 h-4 w-4" />
          Adauga Utilizator
        </Button>
      </PageHeader>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Utilizatori ({total})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cauta utilizator..."
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => {
                    setDebouncedSearch(val);
                    setPage(1);
                  }, 400);
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title={search ? 'Niciun utilizator gasit' : 'Niciun utilizator inregistrat'}
              description={search ? 'Incearca sa modifici termenii de cautare.' : 'Adauga primul utilizator pentru a incepe.'}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Agentie</TableHead>
                    <TableHead>Data Creare</TableHead>
                    <TableHead className="text-right">Actiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-primary">
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_BADGE_STYLES[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.agency?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editeaza"
                            onClick={() => handleOpenEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sterge"
                            onClick={() => handleOpenDelete(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Pagina {page} din {totalPages} ({total} rezultate)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Inapoi
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Inainte
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editeaza Utilizator' : 'Adauga Utilizator'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifica datele utilizatorului selectat.'
                : 'Completeaza datele pentru noul utilizator.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenume *</Label>
                <Input
                  id="firstName"
                  placeholder="Prenumele"
                  {...form.register('firstName')}
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nume *</Label>
                <Input
                  id="lastName"
                  placeholder="Numele"
                  {...form.register('lastName')}
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplu.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Parola {editingUser ? '' : '*'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={
                  editingUser
                    ? 'Lasa gol pentru a pastra parola curenta'
                    : 'Parola'
                }
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rol *</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteaza rolul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="COUNTRY_MANAGER">Manager Tara</SelectItem>
                      <SelectItem value="AGENCY_MANAGER">Manager Agentie</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.role && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>

            {watchedRole === 'AGENCY_MANAGER' && (
              <div className="space-y-2">
                <Label>Agentie *</Label>
                <Controller
                  control={form.control}
                  name="agencyId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteaza agentia" />
                      </SelectTrigger>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.agencyId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.agencyId.message}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Anuleaza
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Salveaza' : 'Adauga'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDeletingUser(null);
          }
        }}
        title="Confirma Stergerea"
        description={`Esti sigur ca vrei sa stergi utilizatorul "${deletingUser?.firstName} ${deletingUser?.lastName}"? Aceasta actiune este ireversibila.`}
        onConfirm={handleConfirmDelete}
        loading={deleteMutation.isPending}
        variant="destructive"
      />
    </div>
  );
}
