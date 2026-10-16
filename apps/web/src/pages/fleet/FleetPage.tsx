import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Car,
  FolderOpen,
  AlertCircle,
  Truck,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agency {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
}

interface VehicleDocument {
  id: string;
  type: string;
  expiryDate: string | null;
  fileName: string | null;
  filePath: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  monitoringType: 'KILOMETERS' | 'HOURS';
  currentKm: number | null;
  currentHours: number | null;
  revisionThreshold: number | null;
  itpExpiryDate: string | null;
  rcaExpiryDate: string | null;
  agency: Agency;
  drivers: { driver: Driver }[];
  documents: VehicleDocument[];
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface VehiclesByCategory {
  category: Category;
  vehicles: Vehicle[];
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu'),
  plateNumber: z.string().min(1, 'Numarul de inmatriculare este obligatoriu'),
  categoryId: z.string().min(1, 'Categoria este obligatorie'),
  agencyId: z.string().min(1, 'Agentia este obligatorie'),
  monitoringType: z.enum(['KILOMETERS', 'HOURS']),
  currentKm: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : Number(val)), z.number().nonnegative().nullable().optional()),
  currentHours: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : Number(val)), z.number().nonnegative().nullable().optional()),
  revisionThreshold: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : Number(val)), z.number().positive().nullable().optional()),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

const categorySchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu'),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRevisionRemaining(vehicle: Vehicle): number | null {
  const threshold = vehicle.revisionThreshold;
  if (threshold == null || threshold <= 0) return null;

  if (vehicle.monitoringType === 'KILOMETERS') {
    if (vehicle.currentKm == null) return null;
    return threshold - (vehicle.currentKm % threshold);
  }

  if (vehicle.currentHours == null) return null;
  return threshold - (vehicle.currentHours % threshold);
}

function RevisionStatusBadge({ vehicle }: { vehicle: Vehicle }) {
  const remaining = getRevisionRemaining(vehicle);

  if (remaining === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  let colorClass =
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  let label = 'OK';

  if (remaining < 1000) {
    colorClass = 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400';
    label = 'Urgent';
  } else if (remaining < 3000) {
    colorClass = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    label = 'Atentie';
  }

  const unit = vehicle.monitoringType === 'KILOMETERS' ? 'km' : 'h';

  return (
    <Badge variant="outline" className={cn('w-[84px] justify-center', colorClass)} title={`${remaining.toLocaleString('ro-RO')} ${unit} pana la revizie`}>
      {label}
    </Badge>
  );
}

function DocumentCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-[32px] items-center justify-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
      {count}
    </span>
  );
}

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

const VEHICLE_DOCUMENT_TYPES = ['ITP', 'RCA', 'REGISTRATION', 'INSURANCE', 'OTHER'] as const;

function getDefaultVehicleDocType(documents: VehicleDocument[] | undefined): string {
  const available = VEHICLE_DOCUMENT_TYPES.find(
    (type) => !documents?.some((doc) => doc.type === type)
  );
  return available ?? 'OTHER';
}

// ---------------------------------------------------------------------------
// Vehicle Modal
// ---------------------------------------------------------------------------

interface VehicleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  defaultCategoryId?: string;
}

function VehicleModal({
  open,
  onOpenChange,
  vehicle,
  defaultCategoryId,
}: VehicleModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAgencyManager = user?.role === 'AGENCY_MANAGER';

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as Category[];
    },
  });

  const { data: agenciesData } = useQuery({
    queryKey: ['agencies-all'],
    queryFn: async () => {
      const { data } = await api.get('/agencies', { params: { limit: 100 } });
      return data.data as Agency[];
    },
    enabled: !isAgencyManager,
  });

  const defaultValues: VehicleFormValues = vehicle
    ? {
      name: vehicle.name,
      plateNumber: vehicle.plateNumber,
      categoryId: defaultCategoryId || '',
      agencyId: vehicle.agency.id,
      monitoringType: vehicle.monitoringType,
      currentKm: vehicle.currentKm,
      currentHours: vehicle.currentHours,
      revisionThreshold: vehicle.revisionThreshold,
    }
    : {
      name: '',
      plateNumber: '',
      categoryId: defaultCategoryId || '',
      agencyId: isAgencyManager ? (user?.agencyId ?? '') : '',
      monitoringType: 'KILOMETERS' as const,
      currentKm: null,
      currentHours: null,
      revisionThreshold: null,
    };

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    // @ts-ignore
    resolver: zodResolver(vehicleSchema),
    defaultValues,
    values: defaultValues,
  });

  const monitoringType = watch('monitoringType');

  const createMutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const payload = {
        name: values.name,
        plateNumber: values.plateNumber,
        categoryId: values.categoryId,
        agencyId: values.agencyId,
        monitoringType: values.monitoringType,
        currentKm: values.monitoringType === 'KILOMETERS' ? (values.currentKm ?? null) : null,
        currentHours: values.monitoringType === 'HOURS' ? (values.currentHours ?? null) : null,
        revisionThreshold: values.revisionThreshold ?? null,
      };
      const { data } = await api.post('/vehicles', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Vehiculul a fost creat cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la crearea vehiculului');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const payload = {
        name: values.name,
        plateNumber: values.plateNumber,
        categoryId: values.categoryId,
        agencyId: values.agencyId,
        monitoringType: values.monitoringType,
        currentKm: values.monitoringType === 'KILOMETERS' ? (values.currentKm ?? null) : null,
        currentHours: values.monitoringType === 'HOURS' ? (values.currentHours ?? null) : null,
        revisionThreshold: values.revisionThreshold ?? null,
      };
      const { data } = await api.put(`/vehicles/${vehicle!.id}`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Vehiculul a fost actualizat cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la actualizarea vehiculului');
    },
  });

  const onSubmit = (values: VehicleFormValues) => {
    if (vehicle) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  // --- Document Upload State & Mutations ---
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('ITP');
  const [docExpiry, setDocExpiry] = useState<string>('');
  const docFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !vehicle) return;
    setDocFile(null);
    setDocExpiry('');
    setDocType(getDefaultVehicleDocType(vehicle.documents));
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  }, [open, vehicle?.id, vehicle?.documents?.length]);

  const canUploadDocument = Boolean(docFile && docType && docExpiry);

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!vehicle) throw new Error('Vehiculul nu este selectat.');
      if (!docFile) throw new Error('Selectati un fisier.');
      if (!docType) throw new Error('Selectati tipul documentului.');
      if (!docExpiry) throw new Error('Data de expirare este obligatorie.');

      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('type', docType);
      formData.append('expiryDate', docExpiry);

      await api.post(`/vehicles/${vehicle.id}/documents`, formData);
    },
    onSuccess: () => {
      toast.success('Document incarcat cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      setDocFile(null);
      setDocExpiry('');
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.details?.[0]?.message ||
        error?.message;
      toast.error(msg || 'Eroare la incarcarea documentului');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/vehicles/${vehicle!.id}/documents/${docId}`);
    },
    onSuccess: () => {
      toast.success('Document sters cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea documentului');
    },
  });

  const handleDownload = async (doc: VehicleDocument) => {
    if (!doc.filePath) {
      toast.error('Fisierul nu este disponibil');
      return;
    }
    try {
      const filename = doc.filePath.split('/').pop();
      const response = await api.get(`/uploads/${filename}`, { responseType: 'blob' });
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? 'Editeaza Vehicul' : 'Adauga Vehicul'}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? 'Modifica datele vehiculului selectat.'
              : 'Completeaza informatiile pentru noul vehicul.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit as any)}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mentenanta">Mentenanta</TabsTrigger>
              <TabsTrigger value="documente">Documente</TabsTrigger>
            </TabsList>

            {/* Tab: General */}
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nume vehicul</Label>
                <Input
                  id="name"
                  placeholder="ex: Dacia Duster 2024"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plateNumber">Numar de inmatriculare</Label>
                <Input
                  id="plateNumber"
                  placeholder="ex: B 123 ABC"
                  {...register('plateNumber')}
                />
                {errors.plateNumber && (
                  <p className="text-sm text-destructive">
                    {errors.plateNumber.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Categorie</Label>
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteaza categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesData?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.categoryId && (
                  <p className="text-sm text-destructive">
                    {errors.categoryId.message}
                  </p>
                )}
              </div>

              {!isAgencyManager && (
                <div className="space-y-2">
                  <Label>Agentie</Label>
                  <Controller
                    name="agencyId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteaza agentia" />
                        </SelectTrigger>
                        <SelectContent>
                          {agenciesData?.map((agency) => (
                            <SelectItem key={agency.id} value={agency.id}>
                              {agency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.agencyId && (
                    <p className="text-sm text-destructive">
                      {errors.agencyId.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Tip monitorizare</Label>
                <Controller
                  name="monitoringType"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-3 pt-1">
                      <span
                        className={cn(
                          'text-sm font-medium transition-colors',
                          field.value === 'KILOMETERS'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Kilometri
                      </span>
                      <Switch
                        checked={field.value === 'HOURS'}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? 'HOURS' : 'KILOMETERS')
                        }
                      />
                      <span
                        className={cn(
                          'text-sm font-medium transition-colors',
                          field.value === 'HOURS'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Ore
                      </span>
                    </div>
                  )}
                />
              </div>
            </TabsContent>

            {/* Tab: Mentenanta */}
            <TabsContent value="mentenanta" className="space-y-4 pt-4">
              {monitoringType === 'KILOMETERS' ? (
                <div className="space-y-2">
                  <Label htmlFor="currentKm">Kilometri curenti</Label>
                  <Input
                    id="currentKm"
                    type="number"
                    min={0}
                    placeholder="ex: 45000"
                    {...register('currentKm')}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="currentHours">Ore curente</Label>
                  <Input
                    id="currentHours"
                    type="number"
                    min={0}
                    placeholder="ex: 1200"
                    {...register('currentHours')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="revisionThreshold">Prag revizie</Label>
                <Input
                  id="revisionThreshold"
                  type="number"
                  min={1}
                  placeholder={
                    monitoringType === 'KILOMETERS'
                      ? 'ex: 15000 (km)'
                      : 'ex: 500 (ore)'
                  }
                  {...register('revisionThreshold')}
                />
                <p className="text-xs text-muted-foreground">
                  {monitoringType === 'KILOMETERS'
                    ? 'Intervalul in km la care trebuie efectuata revizia.'
                    : 'Intervalul in ore la care trebuie efectuata revizia.'}
                </p>
              </div>
            </TabsContent>

            {/* Tab: Documente */}
            <TabsContent value="documente" className="space-y-4 pt-4">

              {vehicle ? (
                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Fisiere atasate
                  </h4>

                  {vehicle.documents && vehicle.documents.length > 0 ? (
                    <div className="space-y-2 mb-6">
                      {vehicle.documents.map((doc) => (
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
                                    doc.type === 'ITP'
                                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                      : doc.type === 'RCA'
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : doc.type === 'REGISTRATION'
                                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                          : doc.type === 'INSURANCE'
                                            ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                            : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                                  }
                                >
                                  {doc.type === 'REGISTRATION' ? 'Talon/Inmatriculare' : doc.type === 'INSURANCE' ? 'Asigurare Casco' : doc.type}
                                </Badge>
                                {doc.expiryDate && (
                                  <span className="text-xs text-muted-foreground">
                                    Expira: {formatDate(doc.expiryDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => handleDownload(doc)}>
                              Download
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => deleteDocMutation.mutate(doc.id)} disabled={deleteDocMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-6">Niciun document fisier atasat inca.</p>
                  )}

                  {/* Upload new document form */}
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4 border">
                    <h5 className="text-sm font-medium">Incarca un document nou</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tip Document</Label>
                        <Select value={docType} onValueChange={setDocType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteaza tipul" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ITP" disabled={vehicle?.documents?.some((d) => d.type === 'ITP')}>ITP</SelectItem>
                            <SelectItem value="RCA" disabled={vehicle?.documents?.some((d) => d.type === 'RCA')}>RCA</SelectItem>
                            <SelectItem value="REGISTRATION" disabled={vehicle?.documents?.some((d) => d.type === 'REGISTRATION')}>Talon / Inmatriculare</SelectItem>
                            <SelectItem value="INSURANCE" disabled={vehicle?.documents?.some((d) => d.type === 'INSURANCE')}>Asigurare Casco</SelectItem>
                            <SelectItem value="OTHER">Altul</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Data Expirare (Obligatorie)</Label>
                        <Input
                          type="date"
                          max="9999-12-31"
                          value={docExpiry}
                          onKeyDown={(e) => {
                            if (docExpiry?.length === 10 && e.key >= '0' && e.key <= '9') {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => setDocExpiry(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vehicle-doc-upload-${vehicle.id}`}>Fisier (PDF/Imagine)</Label>
                      <input
                        ref={docFileInputRef}
                        id={`vehicle-doc-upload-${vehicle.id}`}
                        type="file"
                        accept=".pdf,image/*"
                        className="sr-only"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      />
                      <Label
                        htmlFor={`vehicle-doc-upload-${vehicle.id}`}
                        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {docFile ? docFile.name : 'Apasa pentru a selecta fisier'}
                      </Label>
                    </div>
                    {!canUploadDocument && (
                      <p className="text-xs text-muted-foreground">
                        Selecteaza tipul documentului, data expirarii si fisierul pentru a activa incarcarea.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={!canUploadDocument || uploadDocMutation.isPending}
                      onClick={() => uploadDocMutation.mutate()}
                    >
                      {uploadDocMutation.isPending && <Spinner className="mr-2" />}
                      Incarca Fisier
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t pt-4">
                  <div className="p-4 bg-amber-500/10 text-amber-600 rounded-md flex gap-2 items-center text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>Trebuie sa salvezi vehiculul mai intai pentru a putea adauga fisiere.</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="mr-2" />}
              {vehicle ? 'Salveaza' : 'Adauga'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Category Modal
// ---------------------------------------------------------------------------

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

function CategoryModal({ open, onOpenChange, category }: CategoryModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    // @ts-ignore
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, description: category.description ?? '' }
      : { name: '', description: '' },
    values: category
      ? { name: category.name, description: category.description ?? '' }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const { data } = await api.post('/categories', values);
      return data;
    },
    onSuccess: () => {
      toast.success('Categoria a fost creata cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la crearea categoriei');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const { data } = await api.put(`/categories/${category!.id}`, values);
      return data;
    },
    onSuccess: () => {
      toast.success('Categoria a fost actualizata cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la actualizarea categoriei');
    },
  });

  const onSubmit = (values: CategoryFormValues) => {
    if (category) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editeaza Categorie' : 'Adauga Categorie'}
          </DialogTitle>
          <DialogDescription>
            {category
              ? 'Modifica datele categoriei selectate.'
              : 'Completeaza informatiile pentru noua categorie.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nume categorie</Label>
            <Input
              id="cat-name"
              placeholder="ex: Autoturisme"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-description">Descriere (optional)</Label>
            <Input
              id="cat-description"
              placeholder="ex: Vehicule de teren, SUV-uri"
              {...register('description')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="mr-2" />}
              {category ? 'Salveaza' : 'Adauga'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// FleetPage
// ---------------------------------------------------------------------------

export default function FleetPage() {
  const queryClient = useQueryClient();

  // --- Vehicle modal state ---
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleDefaultCategoryId, setVehicleDefaultCategoryId] = useState<
    string | undefined
  >(undefined);

  // --- Category modal state ---
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // --- Delete state ---
  const [deleteVehicleTarget, setDeleteVehicleTarget] =
    useState<Vehicle | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<Category | null>(null);

  // --- Queries ---
  const {
    data: vehiclesByCategoryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['vehicles-by-category'],
    queryFn: async () => {
      const { data } = await api.get('/vehicles/by-category');
      return data.data as VehiclesByCategory[];
    },
  });

  // --- Mutations ---
  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/vehicles/${id}`);
    },
    onSuccess: () => {
      toast.success('Vehiculul a fost sters cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      setDeleteVehicleTarget(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea vehiculului');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      toast.success('Categoria a fost stearsa cu succes');
      queryClient.invalidateQueries({ queryKey: ['vehicles-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteCategoryTarget(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea categoriei');
    },
  });

  // --- Handlers ---
  const activeVehicle = useMemo(() => {
    if (!editingVehicle || !vehiclesByCategoryData) return editingVehicle;
    for (const cat of vehiclesByCategoryData) {
      const found = cat.vehicles.find((v) => v.id === editingVehicle.id);
      if (found) return found;
    }
    return editingVehicle;
  }, [editingVehicle, vehiclesByCategoryData]);

  const handleAddVehicle = (categoryId: string) => {
    setEditingVehicle(null);
    setVehicleDefaultCategoryId(categoryId);
    setVehicleModalOpen(true);
  };

  const handleEditVehicle = (vehicle: Vehicle, categoryId: string) => {
    setEditingVehicle(vehicle);
    setVehicleDefaultCategoryId(categoryId);
    setVehicleModalOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  // Sort categories: those with vehicles first
  const sortedCategories = useMemo(() => {
    if (!vehiclesByCategoryData) return [];
    return [...vehiclesByCategoryData].sort((a, b) => {
      const aEmpty = a.vehicles.length === 0;
      const bEmpty = b.vehicles.length === 0;
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      return a.category.name.localeCompare(b.category.name);
    });
  }, [vehiclesByCategoryData]);

  // Compute default open accordion items so only populated categories start expanded
  const defaultAccordionValues = useMemo(
    () =>
      sortedCategories
        .filter((g) => g.vehicles.length > 0)
        .map((g) => g.category.id),
    [sortedCategories]
  );

  // --- Render ---
  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Management Flota"
        className="-mt-2 mb-0"
        description={`${vehiclesByCategoryData?.reduce((acc: number, g: VehiclesByCategory) => acc + g.vehicles.length, 0) ?? 0} vehicule in ${vehiclesByCategoryData?.length ?? 0} categorii`}
      >
        <Button onClick={handleAddCategory} className="mt-3 bg-linear-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20">
          <Plus className="mr-2 h-4 w-4" />
          Adauga Categorie
        </Button>
      </PageHeader>

      {/* Loading */}
      {isLoading && (
        <TableSkeleton rows={8} cols={6} />
      )}

      {/* Error */}
      {isError && (
        <Card className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground text-sm">
            Nu am putut incarca datele. Te rugam sa incerci din nou.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ['vehicles-by-category'],
              })
            }
          >
            Reincearca
          </Button>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading &&
        !isError &&
        (!vehiclesByCategoryData || vehiclesByCategoryData.length === 0) && (
          <EmptyState
            icon={Truck}
            title="Nicio categorie"
            description="Creati prima categorie pentru a incepe sa adaugati vehicule"
            action={<Button onClick={handleAddCategory}>Adauga Categorie</Button>}
          />
        )}

      {/* Categories accordion */}
      {!isLoading &&
        !isError &&
        sortedCategories &&
        sortedCategories.length > 0 && (
          <Accordion
            type="multiple"
            defaultValue={defaultAccordionValues}
            className="space-y-2"
          >
            {sortedCategories.map(({ category, vehicles }) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="rounded-lg border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-1 items-center gap-3">
                    <span className="text-lg font-bold tracking-tight">
                      {category.name}
                    </span>
                    <Badge variant="secondary">
                      {vehicles.length}{' '}
                      {vehicles.length === 1 ? 'vehicul' : 'vehicule'}
                    </Badge>
                    {category.description && (
                      <span className="hidden text-sm text-muted-foreground sm:inline">
                        — {category.description}
                      </span>
                    )}
                    {/* Action buttons – stopPropagation prevents toggling accordion */}
                    <div
                      className="ml-auto flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Editeaza"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        aria-label="Sterge"
                        onClick={() => setDeleteCategoryTarget(category)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-dashed"
                        onClick={() => handleAddVehicle(category.id)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adauga Vehicul
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  {vehicles.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Car className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Niciun vehicul in aceasta categorie.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddVehicle(category.id)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adauga primul vehicul
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table className="[&_td]:py-2 [&_th]:py-0">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center w-[15%]">Nume</TableHead>
                            <TableHead className="text-center w-[15%]">Nr. Inmatriculare</TableHead>
                            <TableHead className="text-center w-[10%]">Stare</TableHead>
                            <TableHead className="text-center w-[12%]">Km/Ore Curente</TableHead>
                            <TableHead className="text-center w-[12%]">Prag Revizie</TableHead>
                            <TableHead className="text-center w-[8%]">Documente</TableHead>
                            <TableHead className="text-center w-[10%]">Soferi</TableHead>
                            <TableHead className="text-center w-[10%]">Actiuni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vehicles.map((vehicle) => (
                            <TableRow key={vehicle.id} className="group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-primary cursor-pointer">
                              <TableCell className="font-medium text-center">
                                {vehicle.name}
                              </TableCell>
                              <TableCell className="text-center">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                                  {vehicle.plateNumber}
                                </code>
                              </TableCell>
                              <TableCell className="text-center">
                                <RevisionStatusBadge vehicle={vehicle} />
                              </TableCell>
                              <TableCell className="text-center">
                                {vehicle.monitoringType === 'KILOMETERS'
                                  ? vehicle.currentKm != null
                                    ? `${vehicle.currentKm.toLocaleString('ro-RO')} km`
                                    : '-'
                                  : vehicle.currentHours != null
                                    ? `${vehicle.currentHours.toLocaleString('ro-RO')} h`
                                    : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {vehicle.revisionThreshold != null
                                  ? vehicle.monitoringType === 'KILOMETERS'
                                    ? `${vehicle.revisionThreshold.toLocaleString('ro-RO')} km`
                                    : `${vehicle.revisionThreshold.toLocaleString('ro-RO')} h`
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <DocumentCountBadge count={vehicle.documents?.length ?? 0} />
                              </TableCell>
                              <TableCell className="text-center">
                                {vehicle.drivers.length > 0 ? (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {vehicle.drivers.map(({ driver }) => (
                                      <Badge
                                        key={driver.id}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {driver.firstName} {driver.lastName}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    Niciun sofer
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Editeaza"
                                    onClick={() =>
                                      handleEditVehicle(vehicle, category.id)
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    aria-label="Sterge"
                                    onClick={() =>
                                      setDeleteVehicleTarget(vehicle)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

      {/* Vehicle Modal */}
      <VehicleModal
        open={vehicleModalOpen}
        onOpenChange={(open) => {
          setVehicleModalOpen(open);
          if (!open) {
            setEditingVehicle(null);
            setVehicleDefaultCategoryId(undefined);
          }
        }}
        vehicle={activeVehicle}
        defaultCategoryId={vehicleDefaultCategoryId}
      />

      {/* Category Modal */}
      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={(open) => {
          setCategoryModalOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
      />

      {/* Delete Vehicle Confirmation */}
      <ConfirmDialog
        open={deleteVehicleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteVehicleTarget(null);
        }}
        title="Sterge vehiculul"
        description={`Esti sigur ca vrei sa stergi vehiculul "${deleteVehicleTarget?.name ?? ''}"? Aceasta actiune este ireversibila.`}
        onConfirm={() => {
          if (deleteVehicleTarget) {
            deleteVehicleMutation.mutate(deleteVehicleTarget.id);
          }
        }}
        loading={deleteVehicleMutation.isPending}
      />

      {/* Delete Category Confirmation */}
      <ConfirmDialog
        open={deleteCategoryTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCategoryTarget(null);
        }}
        title="Sterge categoria"
        description={`Esti sigur ca vrei sa stergi categoria "${deleteCategoryTarget?.name ?? ''}"? Toate vehiculele asociate vor fi afectate.`}
        onConfirm={() => {
          if (deleteCategoryTarget) {
            deleteCategoryMutation.mutate(deleteCategoryTarget.id);
          }
        }}
        loading={deleteCategoryMutation.isPending}
      />
    </div>
  );
}
