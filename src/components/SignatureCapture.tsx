import { useRef, useState, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PenTool, RotateCcw, Check } from 'lucide-react';

interface SignatureCaptureProps {
  value?: string;
  onChange: (signature: string) => void;
  disabled?: boolean;
}

export function SignatureCapture({ value, onChange, disabled }: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Redraw the canvas from the saved value after resize. HTML canvas
  // clears itself whenever its pixel dimensions change, so we need to
  // restore the content from the data URL.
  const redrawFromValue = useCallback(() => {
    if (!signatureRef.current || !value) return;
    // Small delay to let the canvas dimensions settle after resize
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

  function handleClear() {
    signatureRef.current?.clear();
    setIsEmpty(true);
    onChange('');
  }

  function handleEnd() {
    if (signatureRef.current) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      onChange(dataUrl);
      setIsEmpty(signatureRef.current.isEmpty());
    }
  }

  function handleResign() {
    setIsSigning(true);
    onChange('');
  }

  function handleDoneSigning() {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      onChange(dataUrl);
    }
    setIsSigning(false);
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
          <div className="space-y-2">
            <div className="border rounded-s bg-white p-2">
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
                onEnd={handleEnd}
                backgroundColor="white"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 btn-action"
                onClick={handleClear}
                disabled={isEmpty || disabled}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
              {!isEmpty && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleDoneSigning}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Done
                </Button>
              )}
            </div>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
