import { cn } from '@/lib/utils';
import { useAuthenticatedImageUrl } from '@/hooks/useAuthenticatedImageUrl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DriverAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoPath?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export default function DriverAvatar({
  firstName,
  lastName,
  profilePhotoPath,
  className,
  fallbackClassName,
}: DriverAvatarProps) {
  const imageUrl = useAuthenticatedImageUrl(profilePhotoPath);
  const showImage = Boolean(profilePhotoPath && imageUrl);
  const initials =
    `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <Avatar
      key={profilePhotoPath ?? 'no-photo'}
      className={cn('shrink-0', className)}
    >
      {showImage ? (
        <AvatarImage src={imageUrl} alt={`${firstName ?? ''} ${lastName ?? ''}`} />
      ) : null}
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-teal-500 to-teal-600 text-white font-semibold',
          fallbackClassName
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
