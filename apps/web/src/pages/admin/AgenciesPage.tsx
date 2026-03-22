import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Search, Building2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
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

interface Agency {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  createdAt: string;
  _count: {
    vehicles: number;
    users: number;
  };
}

interface AgenciesResponse {
  success: boolean;
  data: Agency[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Schemas ---

const agencySchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu'),
  address: z.string().optional(),
  city: z.string().optional(),
});

type AgencyFormValues = z.infer<typeof agencySchema>;

// --- Component ---

export default function AgenciesPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<Agency | null>(null);

  const limit = 20;

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // --- Queries ---

  const { data: agenciesData, isLoading } = useQuery<AgenciesResponse>({
    queryKey: ['agencies', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get('/agencies', {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      return data;
    },
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (values: AgencyFormValues) => api.post('/agencies', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast.success('Agentia a fost creata cu succes');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la crearea agentiei');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AgencyFormValues }) =>
      api.put(`/agencies/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast.success('Agentia a fost actualizata cu succes');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la actualizarea agentiei');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agencies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast.success('Agentia a fost stearsa cu succes');
      setDeleteDialogOpen(false);
      setDeletingAgency(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea agentiei');
    },
  });

  // --- Form ---

  const form = useForm<AgencyFormValues>({
    // @ts-ignore
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
    },
    values: editingAgency
      ? {
          name: editingAgency.name,
          address: editingAgency.address ?? '',
          city: editingAgency.city ?? '',
        }
      : undefined,
  });

  // --- Handlers ---

  function handleOpenCreate() {
    setEditingAgency(null);
    form.reset({ name: '', address: '', city: '' });
    setDialogOpen(true);
  }

  function handleOpenEdit(agency: Agency) {
    setEditingAgency(agency);
    form.reset({
      name: agency.name,
      address: agency.address ?? '',
      city: agency.city ?? '',
    });
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setEditingAgency(null);
    form.reset({ name: '', address: '', city: '' });
  }

  function handleOpenDelete(agency: Agency) {
    setDeletingAgency(agency);
    setDeleteDialogOpen(true);
  }

  function onSubmit(values: AgencyFormValues) {
    if (editingAgency) {
      updateMutation.mutate({ id: editingAgency.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  function handleConfirmDelete() {
    if (deletingAgency) {
      deleteMutation.mutate(deletingAgency.id);
    }
  }

  const agencies = agenciesData?.data ?? [];
  const totalPages = agenciesData?.totalPages ?? 1;
  const total = agenciesData?.total ?? 0;
  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader title="Management Agentii" description={`${total} agentii inregistrate`}>
        <Button onClick={handleOpenCreate} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20">
          <Plus className="mr-2 h-4 w-4" />
          Adauga Agentie
        </Button>
      </PageHeader>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Agentii ({total})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cauta agentie..."
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
          ) : agencies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search ? 'Nicio agentie gasita' : 'Nicio agentie inregistrata'}
              description={search ? 'Incearca sa modifici termenii de cautare.' : 'Adauga prima agentie pentru a incepe.'}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-[20%]">Nume</TableHead>
                    <TableHead className="text-center w-[20%]">Adresa</TableHead>
                    <TableHead className="text-center w-[15%]">Oras</TableHead>
                    <TableHead className="text-center w-[15%]">Vehicule</TableHead>
                    <TableHead className="text-center w-[10%]">Utilizatori</TableHead>
                    <TableHead className="text-center w-[10%]">Data Creare</TableHead>
                    <TableHead className="text-center w-[10%]">Actiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agencies.map((agency) => (
                    <TableRow key={agency.id} className="group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-primary">
                      <TableCell className="font-medium text-center">{agency.name}</TableCell>
                      <TableCell className="text-muted-foreground text-center">
                        {agency.address || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center">
                        {agency.city || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{agency._count.vehicles}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{agency._count.users}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center">
                        {formatDate(agency.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editeaza"
                            onClick={() => handleOpenEdit(agency)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sterge"
                            onClick={() => handleOpenDelete(agency)}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingAgency ? 'Editeaza Agentia' : 'Adauga Agentie'}
            </DialogTitle>
            <DialogDescription>
              {editingAgency
                ? 'Modifica datele agentiei selectate.'
                : 'Completeaza datele pentru noua agentie.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nume *</Label>
              <Input
                id="name"
                placeholder="Numele agentiei"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresa</Label>
              <Input
                id="address"
                placeholder="Adresa agentiei"
                {...form.register('address')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Oras</Label>
              <Input
                id="city"
                placeholder="Orasul agentiei"
                {...form.register('city')}
              />
            </div>
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
                {editingAgency ? 'Salveaza' : 'Adauga'}
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
            setDeletingAgency(null);
          }
        }}
        title="Confirma Stergerea"
        description={`Esti sigur ca vrei sa stergi agentia "${deletingAgency?.name}"? Aceasta actiune este ireversibila.`}
        onConfirm={handleConfirmDelete}
        loading={deleteMutation.isPending}
        variant="destructive"
      />
    </div>
  );
}
