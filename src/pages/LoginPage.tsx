import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { BayerNoiseBackground } from '@/components/BayerNoiseBackground';

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error || 'Login failed');
    }

    setIsSubmitting(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <BayerNoiseBackground className="absolute inset-0 w-full h-full" color={theme === 'dark' ? '#FFFFFF' : '#351F09'} />
      <Card className="w-full max-w-md relative z-10 bg-card/60 backdrop-blur-md aspect-[3/4] md:aspect-[7/8] flex flex-col">
        <CardHeader className="text-center">
          <svg viewBox="0 0 724 240" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={toggleTheme} role="button" aria-label="Toggle theme" className="w-full mb-2 text-primary cursor-pointer">
            <path d="M84.0208 186V53.9952H218.592V86.4464H127.106V104.964H214.926V134.665H127.106V153.549H218.592V186H84.0208Z" fill="currentColor"/>
            <path d="M323.08 189.667C270.278 189.667 235.627 162.349 235.627 119.998C235.627 78.1961 270.278 51.0618 323.08 51.0618C371.849 51.0618 406.133 73.4292 409.617 107.347H363.782C361.582 96.1634 345.815 87.1797 323.08 87.1797C297.229 87.1797 280.545 100.38 280.545 119.998C280.545 139.982 297.229 153.365 323.08 153.365C345.815 153.365 361.582 144.382 363.782 132.831H409.617C406.133 167.116 371.849 189.667 323.08 189.667Z" fill="currentColor"/>
            <path d="M427.604 186V53.9952H494.89L533.941 136.315L572.81 53.9952H639.912V186H596.827V94.88L553.742 186H513.774L470.689 94.88V186H427.604Z" fill="currentColor"/>
            <path d="M0 0H56C56 0 10.5 40 10.5 120C10.5 200 56 240 56 240H0V0Z" fill="currentColor"/>
            <path d="M724 0H668C668 0 713.5 40 713.5 120C713.5 200 668 240 668 240H724V0Z" fill="currentColor"/>
          </svg>
<CardDescription>
            Daily Report Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="space-y-4">
              {error && (
                <div className="flex items-center h-9 md:h-8 px-2 text-base md:text-xs/relaxed text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>

            <div className="flex-1" />

            <div className="pt-[20px] border-t text-center text-xs text-muted-foreground">
              <p className="mb-1">For assistance, contact the office:</p>
              <p>
                <a href="tel:+17148974326" className="text-primary hover:underline">+1 (714) 897-4326</a>
              </p>
              <p>
                <a href="mailto:info@4ecm.com" className="text-primary hover:underline">info@4ecm.com</a>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
