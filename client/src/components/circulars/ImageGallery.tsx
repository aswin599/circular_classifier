import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { fetchImageBlobUrl } from '../../lib/images';
import type { CircularImage } from '../../types';

interface ImageGalleryProps {
  images: CircularImage[];
}

function sourceLabel(image: CircularImage): string {
  switch (image.sourceType) {
    case 'pdf_page':
      return `Page ${image.page ?? image.index ?? 1}`;
    case 'pdf_embed':
      return `Embedded image${image.page ? ` (page ${image.page})` : ''}`;
    case 'docx':
      return 'Document image';
    case 'email_inline':
      return 'Email inline image';
    default:
      return 'Image';
  }
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [openImage, setOpenImage] = useState<CircularImage | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullError, setFullError] = useState(false);
  const [, forceTick] = useState(0);

  const revokedRef = useRef<Set<string>>(new Set());
  const revoke = (url: string) => {
    if (url && !revokedRef.current.has(url)) {
      revokedRef.current.add(url);
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const urls: Record<string, string> = {};

    const load = async () => {
      for (const image of images) {
        try {
          const url = await fetchImageBlobUrl(image.thumbPath);
          if (cancelled) {
            revoke(url);
            return;
          }
          urls[image.id] = url;
        } catch {
          // Individual thumbnail failures are non-fatal.
        }
      }
      if (!cancelled) setThumbUrls({ ...urls });
    };

    void load();

    return () => {
      cancelled = true;
      Object.values(urls).forEach(revoke);
    };
     
  }, [images]);

  useEffect(() => {
    if (!openImage) return;
    let cancelled = false;
    setFullLoading(true);
    setFullError(false);
    setFullUrl(null);

    fetchImageBlobUrl(openImage.viewPath)
      .then((url) => {
        if (!cancelled) {
          setFullUrl(url);
          setFullLoading(false);
        } else {
          revoke(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullError(true);
          setFullLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
     
  }, [openImage]);

  const closeModal = () => {
    if (fullUrl) revoke(fullUrl);
    setFullUrl(null);
    setOpenImage(null);
    forceTick((t) => t + 1);
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="card-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-900">Images ({images.length})</h2>
        <span className="text-xs text-brand-400">
          Extracted from attachments & email
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image) => (
          <button
            key={image.id}
            onClick={() => setOpenImage(image)}
            className="group overflow-hidden rounded-xl border border-brand-100 bg-white text-left shadow-card transition-all hover:shadow-card-hover hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <div className="flex h-40 items-center justify-center overflow-hidden bg-brand-50">
              {thumbUrls[image.id] ? (
                <img
                  src={thumbUrls[image.id]}
                  alt={image.filename}
                  className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <span className="animate-pulse text-xs text-brand-300">Loading…</span>
              )}
            </div>
            <div className="border-t border-brand-50 px-2.5 py-2">
              <p className="truncate text-xs font-medium text-brand-700">{sourceLabel(image)}</p>
              {image.width && image.height ? (
                <p className="mt-0.5 text-[10px] text-brand-400">
                  {image.width}×{image.height}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <Modal isOpen={!!openImage} onClose={closeModal} title={openImage ? sourceLabel(openImage) : ''} maxWidth="sm:max-w-3xl">
        <div className="flex items-center justify-center">
          {fullLoading && <span className="py-16 text-sm text-brand-400">Loading image…</span>}
          {fullError && <span className="py-16 text-sm text-red-500">Failed to load image.</span>}
          {fullUrl && (
            <img src={fullUrl} alt={openImage?.filename || 'image'} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>
        {openImage?.filename && (
          <p className="mt-3 break-all text-center text-xs text-brand-400">{openImage.filename}</p>
        )}
      </Modal>
    </div>
  );
}