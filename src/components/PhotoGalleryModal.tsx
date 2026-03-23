import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryPhoto {
  id: string;
  imageData: string;
  caption?: string;
  date?: string;
}

interface PhotoGalleryModalProps {
  title: string;
  photos: GalleryPhoto[];
  onClose: () => void;
}

export function PhotoGalleryModal({ title, photos, onClose }: PhotoGalleryModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (selectedIndex !== null) {
    const photo = photos[selectedIndex];
    return (
      <div className="fixed inset-0 bg-black/90 flex flex-col z-50" onClick={() => setSelectedIndex(null)}>
        <div className="flex items-center justify-between p-4">
          <div className="text-white text-sm">
            {photo.date && <span className="font-medium">{photo.date}</span>}
            {photo.caption && <span className="ml-3 text-white/70">{photo.caption}</span>}
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center px-12 pb-4 min-h-0">
          {selectedIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex - 1); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}
          <img
            src={photo.imageData}
            alt={photo.caption || 'Photo'}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedIndex < photos.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex + 1); }}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}
        </div>
        <div className="text-center text-white/50 text-sm pb-4">
          {selectedIndex + 1} / {photos.length}
        </div>
      </div>
    );
  }

  // Group photos by date if dates are present
  const hasGroupDates = photos.some((p) => p.date);
  let groupedPhotos: { date: string; photos: GalleryPhoto[] }[] = [];
  if (hasGroupDates) {
    const groups = new Map<string, GalleryPhoto[]>();
    for (const photo of photos) {
      const key = photo.date || 'No date';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }
    groupedPhotos = Array.from(groups.entries()).map(([date, photos]) => ({ date, photos }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[85dvh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {photos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No photos</p>
          ) : hasGroupDates ? (
            <div className="space-y-6">
              {groupedPhotos.map((group) => (
                <div key={group.date}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.date}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {group.photos.map((photo) => {
                      const idx = photos.indexOf(photo);
                      return (
                        <div key={photo.id} className="cursor-pointer" onClick={() => setSelectedIndex(idx)}>
                          <div className="aspect-square border rounded overflow-hidden bg-muted">
                            <img src={photo.imageData} alt={photo.caption || 'Photo'} className="w-full h-full object-cover" />
                          </div>
                          {photo.caption && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, idx) => (
                <div key={photo.id} className="cursor-pointer" onClick={() => setSelectedIndex(idx)}>
                  <div className="aspect-square border rounded overflow-hidden bg-muted">
                    <img src={photo.imageData} alt={photo.caption || 'Photo'} className="w-full h-full object-cover" />
                  </div>
                  {photo.caption && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
