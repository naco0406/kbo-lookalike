import type { FC } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const PlayerImage: FC<PlayerImageProps> = ({ src, alt, className }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-[inherit]" />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        loading="lazy"
      />
    </div>
  );
};
