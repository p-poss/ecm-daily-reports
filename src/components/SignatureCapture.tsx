import { useRef, useState, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PenTool, RotateCcw } from 'lucide-react';

interface SignatureCaptureProps {
  value?: string;
  onChange: (signature: string) => void;
  disabled?: boolean;
}

export function SignatureCapture({ value, onChange, disabled }: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isSigning, setIsSigning] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Sync internal state when value changes externally (e.g. undo)
  useEffect(() => {
    if (!value) {
      signatureRef.current?.clear();
      setIsEmpty(true);
    } else {
      setIsEmpty(false);
    }
  }, [value]);

  // Redraw the canvas from the saved value after resize.
  const redrawFromValue = useCallback(() => {
    if (!signatureRef.current || !value) return;
    setTimeout(() => {
      signatureRef.current?.fromDataURL(value, {
        width: containerRef.current?.clientWidth || 300,
        height: 128,
      });
    }, 50);
  }, [value]);

  useEffect(() => {
    if (!isSigning || !containerRef.current) return;
    const ro = new ResizeObserver(() => redrawFromValue());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isSigning, redrawFromValue]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearTimeout(doneTimerRef.current);
  }, []);

  function handleBegin() {
    // Cancel any pending auto-done timer (user is still drawing)
    clearTimeout(doneTimerRef.current);
    setIsSigning(true);
  }

  function handleEnd() {
    if (signatureRef.current) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      onChange(dataUrl);
      setIsEmpty(signatureRef.current.isEmpty());
      // Auto-exit signing mode after 1.5s of no new strokes
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => setIsSigning(false), 1500);
    }
  }

  function handleClear() {
    clearTimeout(doneTimerRef.current);
    signatureRef.current?.clear();
    setIsEmpty(true);
    onChange('');
  }

  function handleResign() {
    clearTimeout(doneTimerRef.current);
    setIsSigning(true);
    onChange('');
  }

  // Show the saved signature image when we have a value and aren't
  // actively signing. Otherwise show the canvas.
  const showImage = !!value && !isSigning;

  return (
    <div className="space-y-[20px]">
      <h2 className="text-lg font-semibold flex items-center gap-2 px-4 text-primary">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><PenTool className="w-3 h-3" /></span>
        Signature
      </h2>
      <Card>
        <CardContent className="space-y-3">
        {showImage ? (
          // Show saved signature
          <div className="space-y-3">
            <div className="border rounded-s bg-white overflow-hidden">
              <img src={value} alt="Signature" className="w-full h-32 object-contain object-center" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResign}
              disabled={disabled}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Re-sign
            </Button>
          </div>
        ) : (
          // Signature canvas
          <>
            <div ref={containerRef} className="border rounded-s bg-white overflow-hidden touch-none">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'w-full h-32',
                  style: { width: '100%', height: '128px' },
                }}
                onBegin={handleBegin}
                onEnd={handleEnd}
                backgroundColor="white"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full btn-action"
              onClick={handleClear}
              disabled={isEmpty || disabled}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
