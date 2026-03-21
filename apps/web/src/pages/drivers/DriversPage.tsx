import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  FileText,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Car,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';

import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agency {
  id: string;
  name: string;
}

interface DriverDocument {
  id: string;
  type: 'DRIVING_LICENSE' | 'MEDICAL_CERTIFICATE';
  expiryDate: string | null;
  fileName: string;
  filePath: string | null;
}

interface DriverVehicle {
  vehicle: {
    id: string;
    name: string;
    plateNumber: string;
  };
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  agencyId: string;
  agency: Agency;
  documents: DriverDocument[];
  vehicles: DriverVehicle[];
}

interface DriversResponse {
  success: boolean;
  data: Driver[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const driverFormSchema = z.object({
  firstName: z.string().min(1, 'Prenumele este obligatoriu'),
  lastName: z.string().min(1, 'Numele este obligatoriu'),
  phone: z.string().optional(),
  email: z.string().email('Email invalid').optional().or(z.literal('')),
  agencyId: z.string().min(1, 'Agentia este obligatorie'),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

// ---------------------------------------------------------------------------
// Document type helpers
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  DRIVING_LICENSE: 'Permis Conducere',
  MEDICAL_CERTIFICATE: 'Fisa Medicala',
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Pagina <span className="font-medium text-foreground">{page}</span> din{' '}
        <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="transition-colors disabled:opacity-40"
        >
          Urmator
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents tab
// ---------------------------------------------------------------------------

function DocumentsTab({ driver }: { driver: Driver }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>('DRIVING_LICENSE');
  const [expiryDate, setExpiryDate] = useState('');

  const handleDownload = async (doc: any) => {
    if (!doc.filePath) {
      toast.error('Fisierul nu este disponibil');
      return;
    }
    try {
      const response = await api.get(`/uploads/${doc.filePath?.split('/').pop()}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Eroare la descarcarea fisierului');
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      if (expiryDate) {
        formData.append('expiryDate', new Date(expiryDate).toISOString());
      }
      await api.post(`/drivers/${driver.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Document incarcat cu succes');
      queryClient.invalidateQueries({ queryKey: ['driver', driver.id] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setExpiryDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la incarcarea documentului');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/drivers/${driver.id}/documents/${docId}`);
    },
    onSuccess: () => {
      toast.success('Document sters');
      queryClient.invalidateQueries({ queryKey: ['driver', driver.id] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea documentului');
    },
  });

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Selecteaza un fisier');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6">
      {/* Existing documents */}
      {driver.documents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Niciun document adaugat.
        </p>
      ) : (
        <div className="space-y-3">
          {driver.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        doc.type === 'DRIVING_LICENSE'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : doc.type === 'MEDICAL_CERTIFICATE'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : ''
                      }
                    >
                      {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                    </Badge>
                    {doc.expiryDate && (
                      <span className="text-xs text-muted-foreground">
                        Expira: {formatDate(doc.expiryDate)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{doc.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Descarca
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteDocMutation.mutate(doc.id)}
                  disabled={deleteDocMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Upload new document */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Adauga Document</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tip document</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRIVING_LICENSE">Permis Conducere</SelectItem>
                <SelectItem value="MEDICAL_CERTIFICATE">Fisa Medicala</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data expirare</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Fisier</Label>
          <Input type="file" ref={fileInputRef} accept=".pdf,.jpg,.jpeg,.png" />
        </div>
        <Button
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          size="sm"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Incarca document
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicles tab
// ---------------------------------------------------------------------------

function VehiclesTab({ driver }: { driver: Driver }) {
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list', driver.agencyId],
    queryFn: async () => {
      const { data } = await api.get('/vehicles', { params: { limit: 100, agencyId: driver.agencyId } });
      return data;
    },
  });

  const assignedIds = new Set(driver.vehicles.map((v) => v.vehicle.id));
  const availableVehicles: Vehicle[] = (vehiclesData?.data ?? []).filter(
    (v: Vehicle) => !assignedIds.has(v.id)
  );

  const assignMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      await api.post(`/vehicles/${vehicleId}/drivers`, { driverId: driver.id });
    },
    onSuccess: () => {
      toast.success('Vehicul asignat cu succes');
      queryClient.invalidateQueries({ queryKey: ['driver', driver.id] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      setSelectedVehicleId('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la asignarea vehiculului');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      await api.delete(`/vehicles/${vehicleId}/drivers/${driver.id}`);
    },
    onSuccess: () => {
      toast.success('Vehicul dezasignat');
      queryClient.invalidateQueries({ queryKey: ['driver', driver.id] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la dezasignarea vehiculului');
    },
  });

  return (
    <div className="space-y-6">
      {/* Assigned vehicles */}
      {driver.vehicles.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Niciun vehicul asignat.
        </p>
      ) : (
        <div className="space-y-3">
          {driver.vehicles.map(({ vehicle }) => (
            <div
              key={vehicle.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{vehicle.name}</p>
                  <p className="text-xs text-muted-foreground">{vehicle.plateNumber}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => unassignMutation.mutate(vehicle.id)}
                disabled={unassignMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Assign vehicle */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Asigneaza Vehicul</h4>
        <div className="flex gap-3">
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecteaza vehicul" />
            </SelectTrigger>
            <SelectContent>
              {availableVehicles.length === 0 ? (
                <SelectItem value="_none" disabled>
                  Niciun vehicul disponibil in aceasta agentie
                </SelectItem>
              ) : (
                availableVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} — {v.plateNumber}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (selectedVehicleId) assignMutation.mutate(selectedVehicleId);
            }}
            disabled={!selectedVehicleId || assignMutation.isPending}
            size="sm"
          >
            {assignMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Asigneaza
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Driver edit / create dialog
// ---------------------------------------------------------------------------

function DriverDialog({
  open,
  onOpenChange,
  driverId,
  initialData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driverId: string | null;
  initialData?: Driver | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAgencyManager = user?.role === 'AGENCY_MANAGER';
  const isEditing = !!driverId;

  const { data: driver } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: async () => {
      const { data } = await api.get(`/drivers/${driverId}`);
      return data.data as Driver;
    },
    enabled: !!driverId && open,
    initialData: initialData || undefined,
  });

  const { data: agenciesData } = useQuery({
    queryKey: ['agencies-all'],
    queryFn: async () => {
      const { data } = await api.get('/agencies', { params: { limit: 100 } });
      return data;
    },
    enabled: !isAgencyManager,
  });

  const agencies: Agency[] = agenciesData?.data ?? [];

  const defaultValues = {
    firstName: driver?.firstName ?? '',
    lastName: driver?.lastName ?? '',
    phone: driver?.phone ?? '',
    email: driver?.email ?? '',
    agencyId: driver?.agencyId ?? (isAgencyManager ? user?.agencyId ?? '' : ''),
  };

  const form = useForm<DriverFormValues>({
    // @ts-ignore
    resolver: zodResolver(driverFormSchema),
    defaultValues,
    values: defaultValues,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: DriverFormValues) => {
      const body = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        email: values.email || undefined,
        agencyId: values.agencyId,
      };
      if (isEditing && driverId) {
        await api.put(`/drivers/${driverId}`, body);
      } else {
        await api.post('/drivers', body);
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Sofer actualizat cu succes' : 'Sofer adaugat cu succes');
      if (driverId) queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la salvarea soferului');
    },
  });

  const onSubmit = (values: DriverFormValues) => saveMutation.mutate(values);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing && driver
              ? `${driver.firstName} ${driver.lastName}`
              : 'Adauga sofer nou'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Editeaza informatiile soferului, documentele si vehiculele asignate.'
              : 'Completeaza informatiile pentru noul sofer.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && driver ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="info">Informatii</TabsTrigger>
              <TabsTrigger value="documents">Documente</TabsTrigger>
              <TabsTrigger value="vehicles">Vehicule</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              <DriverInfoForm
                form={form}
                onSubmit={onSubmit}
                isLoading={saveMutation.isPending}
                isAgencyManager={isAgencyManager}
                agencies={agencies}
                submitLabel="Salveaza modificarile"
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <DocumentsTab driver={driver} />
            </TabsContent>

            <TabsContent value="vehicles" className="mt-4">
              <VehiclesTab driver={driver} />
            </TabsContent>
          </Tabs>
        ) : (
          <DriverInfoForm
            form={form}
            onSubmit={onSubmit}
            isLoading={saveMutation.isPending}
            isAgencyManager={isAgencyManager}
            agencies={agencies}
            submitLabel="Adauga sofer"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Driver info form (reused for create / edit)
// ---------------------------------------------------------------------------

function DriverInfoForm({
  form,
  onSubmit,
  isLoading,
  isAgencyManager,
  agencies,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<DriverFormValues>>;
  onSubmit: (v: DriverFormValues) => void;
  isLoading: boolean;
  isAgencyManager: boolean;
  agencies: Agency[];
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prenume</Label>
          <Input id="firstName" {...register('firstName')} placeholder="Prenume" />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nume</Label>
          <Input id="lastName" {...register('lastName')} placeholder="Nume" />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" {...register('phone')} placeholder="Telefon" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} placeholder="Email" />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {!isAgencyManager && (
        <div className="space-y-2">
          <Label>Agentie</Label>
          <Controller
            control={control}
            name="agencyId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteaza agentia" />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.agencyId && (
            <p className="text-xs text-destructive">{errors.agencyId.message}</p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DriversPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  // Fetch drivers
  const {
    data: driversResponse,
    isLoading,
  } = useQuery<DriversResponse>({
    queryKey: ['drivers', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get('/drivers', {
        params: { page, limit: 20, search: debouncedSearch || undefined },
      });
      return data;
    },
  });

  const drivers = driversResponse?.data ?? [];
  const totalPages = driversResponse?.totalPages ?? 1;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drivers/${id}`);
    },
    onSuccess: () => {
      toast.success('Sofer sters cu succes');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDeleteDialogOpen(false);
      setDriverToDelete(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea soferului');
    },
  });

  const openCreate = () => {
    setSelectedDriver(null);
    setDialogOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setSelectedDriver(driver);
    setDialogOpen(true);
  };

  const openDelete = (driver: Driver, e: React.MouseEvent) => {
    e.stopPropagation();
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (driver: Driver, e: React.MouseEvent) => {
    e.stopPropagation();
    openEdit(driver);
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <PageHeader
        className="-mt-2 -mb-1"
        title="Management Soferi"
        description={`${driversResponse?.total ?? 0} soferi inregistrati`}
      >
        <Button onClick={() => openCreate()} className="mt-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20">
          <Plus className="mr-2 h-4 w-4" />
          Adauga Sofer
        </Button>
      </PageHeader>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cauta dupa nume, email sau telefon..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : drivers.length === 0 ? (
            <SharedEmptyState
              icon={Users}
              title={debouncedSearch ? 'Niciun sofer gasit' : 'Niciun sofer inregistrat'}
              description={
                debouncedSearch
                  ? 'Incearca sa modifici cautarea sau sa stergi filtrul.'
                  : 'Adauga primul sofer pentru a incepe.'
              }
              action={
                !debouncedSearch ? (
                  <Button onClick={() => openCreate()} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20">
                    <Plus className="mr-2 h-4 w-4" />
                    Adauga Sofer
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-14">Nume Complet</TableHead>
                    <TableHead className="text-center">Telefon</TableHead>
                    <TableHead className="text-center">Email</TableHead>
                    {user?.role !== 'AGENCY_MANAGER' && (
                      <TableHead className="text-center">Agentie</TableHead>
                    )}
                    <TableHead className="text-center">Documente</TableHead>
                    <TableHead className="text-center">Vehicule</TableHead>
                    <TableHead className="text-center">Actiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow
                      key={driver.id}
                      className="cursor-pointer group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-primary"
                      onClick={() => openEdit(driver)}
                    >
                      <TableCell className="font-medium pl-14">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-[11px] font-bold text-white shadow-sm shadow-teal-500/20">
                            {driver.firstName?.[0]}{driver.lastName?.[0]}
                          </div>
                          <span>
                            {driver.firstName} {driver.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{driver.phone ?? '-'}</TableCell>
                      <TableCell className="text-center">{driver.email ?? '-'}</TableCell>
                      {user?.role !== 'AGENCY_MANAGER' && (
                        <TableCell className="text-center">{driver.agency?.name ?? '-'}</TableCell>
                      )}
                      <TableCell className="text-center">
                        <Badge variant="secondary">{driver.documents.length}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{driver.vehicles.length}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Editeaza"
                            onClick={(e) => handleEditClick(driver, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="Sterge"
                            onClick={(e) => openDelete(driver, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      {dialogOpen && (
        <DriverDialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setSelectedDriver(null);
          }}
          driverId={selectedDriver?.id || null}
          initialData={selectedDriver}
        />
      )}

      {/* Delete confirmation */}
      {driverToDelete && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={(v) => {
            setDeleteDialogOpen(v);
            if (!v) setDriverToDelete(null);
          }}
          title="Confirmare stergere"
          description={`Esti sigur ca vrei sa stergi soferul ${driverToDelete.firstName} ${driverToDelete.lastName}? Aceasta actiune nu poate fi anulata.`}
          onConfirm={() => deleteMutation.mutate(driverToDelete.id)}
          loading={deleteMutation.isPending}
          variant="destructive"
        />
      )}
    </div>
  );
}
