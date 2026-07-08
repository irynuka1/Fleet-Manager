import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { invalidateAuthenticatedImage } from '@/hooks/useAuthenticatedImageUrl';
import DriverAvatar from '@/components/shared/DriverAvatar';
import { Button } from '@/components/ui/button';

interface DriverProfilePhotoUploadProps {
  driverId: string;
  firstName: string;
  lastName: string;
  profilePhotoPath?: string | null;
}

export default function DriverProfilePhotoUpload({
  driverId,
  firstName,
  lastName,
  profilePhotoPath,
}: DriverProfilePhotoUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/drivers/${driverId}/photo`, formData);
    },
    onSuccess: () => {
      invalidateAuthenticatedImage(profilePhotoPath);
      toast.success('Imagine de profil actualizata');
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['live-map-fleet'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.details?.[0]?.message ||
        error?.message;
      toast.error(msg || 'Eroare la incarcarea imaginii');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/drivers/${driverId}/photo`);
    },
    onSuccess: () => {
      invalidateAuthenticatedImage(profilePhotoPath);
      queryClient.setQueryData(['driver', driverId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return {
          ...(old as Record<string, unknown>),
          profilePhotoPath: null,
          profilePhotoName: null,
        };
      });
      queryClient.setQueriesData({ queryKey: ['drivers'] }, (old: unknown) => {
        if (!old || typeof old !== 'object' || !('data' in old)) return old;
        const list = old as { data: Array<{ id: string; profilePhotoPath?: string | null; profilePhotoName?: string | null }> };
        return {
          ...list,
          data: list.data.map((d) =>
            d.id === driverId
              ? { ...d, profilePhotoPath: null, profilePhotoName: null }
              : d
          ),
        };
      });
      toast.success('Imagine de profil stearsa');
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['live-map-fleet'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error;
      toast.error(msg || 'Eroare la stergerea imaginii');
    },
  });

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col items-center gap-3 pb-2">
      <div className="relative">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-teal-500/50 hover:bg-teal-500/5',
            isLoading && 'opacity-60'
          )}
          aria-label="Incarca imagine de profil"
        >
          <DriverAvatar
            firstName={firstName}
            lastName={lastName}
            profilePhotoPath={profilePhotoPath}
            className="h-24 w-24"
            fallbackClassName="text-2xl"
          />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/35">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white opacity-0 group-hover:opacity-100" />
            ) : (
              <Camera className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Imagine de profil</p>
        <p className="text-xs text-muted-foreground">Apasa pe cerc pentru a incarca o fotografie</p>
      </div>

      {profilePhotoPath && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:text-destructive"
          disabled={isLoading}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Sterge fotografia
        </Button>
      )}
    </div>
  );
}
