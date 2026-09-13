import type { PathologyGalleryItem } from '@sector/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sector/ui';
import { PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type PathologyCardProps = {
  pathology: PathologyGalleryItem;
};

/** One card in the grid; its dialog plays the clip. */
export function PathologyCard({ pathology }: PathologyCardProps) {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer overflow-hidden transition-transform hover:scale-[1.02] hover:shadow-lg">
          <CardHeader className="p-0">
            <div className="relative w-full bg-scan-ground" style={{ paddingBottom: '56.25%' }}>
              {pathology.videoThumbnailUrl ? (
                <img
                  src={pathology.videoThumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <PlayCircle
                  className="absolute inset-0 m-auto h-10 w-10 text-white/70"
                  aria-hidden
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-ink">{pathology.title}</h3>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="h-[90vh] max-h-[90vh] w-[95vw] max-w-[1200px] p-0">
        <DialogHeader className="border-b border-line p-4">
          <DialogTitle className="pr-8 text-base">{pathology.title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {pathology.videoUrl ? (
            <div
              className="relative w-full overflow-hidden rounded-token"
              style={{ paddingBottom: '56.25%' }}
            >
              <iframe
                src={pathology.videoUrl}
                title={pathology.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-ink-dim">{t('gallery.noVideoAvailable')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
