import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';
import { generateId, now } from '@/db/database';
import type { PhotoAttachment } from '@/types';

interface PhotoAttachmentsProps {
  photos: PhotoAttachment[];
  onChange: (photos: PhotoAttachment[]) => void;
  dailyReportId: string;
}

export function PhotoAttachments({ photos, onChange, dailyReportId }: PhotoAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: PhotoAttachment[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      try {
        const base64 = await fileToBase64(file);
        newPhotos.push({
          id: generateId(),
          dailyReportId,
          imageData: base64,
          caption: '',
          createdAt: now(),
        });
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }

    onChange([...photos, ...newPhotos]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(photoId: string) {
    onChange(photos.filter((p) => p.id !== photoId));
  }

  function updateCaption(photoId: string, caption: string) {
    onChange(
      photos.map((p) => (p.id === photoId ? { ...p, caption } : p))
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2 px-4">
        <Camera className="w-5 h-5" />
        Photos
      </h2>
      <Card>
        <CardContent className="space-y-4 pt-4">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-none overflow-hidden border bg-muted"
              >
                <img
                  src={photo.imageData}
                  alt={photo.caption || 'Photo'}
                  className="w-full aspect-square object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-1 right-1 h-6 w-6"
                >
                  <X className="w-3 h-3" />
                </Button>
                <Input
                  type="text"
                  placeholder="Add caption..."
                  value={photo.caption || ''}
                  onChange={(e) => updateCaption(photo.id, e.target.value)}
                  className="border-0 border-t rounded-none text-sm h-8"
                />
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <p className="text-sm">No photos attached</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          className="w-full btn-action"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
        </CardContent>
      </Card>
    </div>
  );
}
