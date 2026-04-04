import { useRef, useState } from 'react';
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
  const [isEmpty, setIsEmpty] = useState(!value);

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

  return (
    <div className="space-y-[20px]">
      <h2 className="text-lg font-semibold flex items-center gap-3 px-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><PenTool className="w-3 h-3" /></span>
        Signature
      </h2>
      <Card>
        <CardContent className="space-y-3 pt-4">
        {value && !signatureRef.current ? (
          // Show saved signature
          <div className="space-y-2">
            <div className="border rounded-s bg-white p-2">
              <img src={value} alt="Signature" className="w-full h-auto" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onChange('')}
              disabled={disabled}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Re-sign
            </Button>
          </div>
        ) : (
          // Signature canvas
          <>
            <div className="border rounded-s bg-white overflow-hidden touch-none">
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
                <div className="flex items-center text-sm text-green-600">
                  <Check className="w-4 h-4 mr-1" />
                  Signed
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Sign above to confirm this report
            </p>
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
