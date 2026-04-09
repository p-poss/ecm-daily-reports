import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for new versions every 60 seconds
      if (registration) {
        setInterval(() => registration.update(), 60_000);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) setShow(true);
  }, [needRefresh]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/[.13] animate-in fade-in duration-200">
      <Card className="w-72 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm font-medium">A new version is available</p>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShow(false)}
            >
              Later
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                updateServiceWorker(true);
                setTimeout(() => window.location.reload(), 1000);
              }}
            >
              Update
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
