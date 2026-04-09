import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
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
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-primary text-primary-foreground px-4 py-2 text-xs animate-in fade-in slide-in-from-top duration-300">
      <span>A new version is available</span>
      <Button
        size="xs"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Update
      </Button>
      <button
        onClick={() => setShow(false)}
        className="text-primary-foreground/70 hover:text-primary-foreground ml-1"
      >
        &times;
      </button>
    </div>
  );
}
