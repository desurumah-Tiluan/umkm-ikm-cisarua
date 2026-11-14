import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { resolveImageSrc } from '../lib/imageAssets';

interface ProductImageProps {
  imageKey: string;
  alt: string;
  className?: string;
}

export function ProductImage({ imageKey, alt, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageSrc(imageKey);

  useEffect(() => {
    setFailed(false);
  }, [imageKey]);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 text-emerald-700 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 mb-2 opacity-60" />
        <span className="text-xs font-medium text-slate-600 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
