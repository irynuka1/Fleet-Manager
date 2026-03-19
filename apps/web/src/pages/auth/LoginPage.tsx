import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Moon, Sun, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  'Monitorizare GPS in Timp Real',
  'Alerte Automate ITP/RCA',
  'Management Flota Complet',
];

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Email sau parola incorecta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT PANEL - Branding (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-12 text-white">
        {/* Geometric grid pattern */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <svg className="absolute h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-teal-400" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated gradient orbs - subtle, not blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/10 blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-gradient-to-br from-cyan-500/15 to-teal-500/5 blur-3xl animate-float-slower" />

        {/* Decorative lines */}
        <div className="absolute top-20 right-12 w-32 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />
        <div className="absolute bottom-32 left-8 w-24 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
        <div className="absolute top-1/2 right-20 w-px h-24 bg-gradient-to-b from-transparent via-teal-400/30 to-transparent" />

        {/* Top - Branding */}
        <div className="relative z-10 flex flex-col items-start">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">OmniKinetix</h1>
              <p className="text-sm text-teal-200/70">Fleet Management Platform</p>
            </div>
          </div>
        </div>

        {/* Center - Tagline */}
        <div className="relative z-10 -mt-12 space-y-4">
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Platforma de<br />
            Management<br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Flota Auto
            </span>
          </h2>
          <p className="max-w-md text-lg text-slate-400">
            Gestioneaza eficient intreaga flota cu instrumente moderne de monitorizare si raportare.
          </p>
        </div>

        {/* Bottom - Feature highlights */}
        <div className="relative z-10 space-y-3">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
              </div>
              <span className="text-sm font-medium text-slate-300">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="relative flex w-full flex-col items-center justify-center bg-background px-6 py-12 lg:w-1/2 xl:w-[45%]">
        {/* Theme toggle - absolute top right */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="absolute right-4 top-4 rounded-full"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        {/* Mobile-only header with logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">OmniKinetix</h1>
          <p className="text-sm text-muted-foreground">Platforma de Management Flota Auto</p>
        </div>

        {/* Login card */}
        <Card className="w-full max-w-sm border-0 shadow-lg lg:max-w-md lg:border lg:shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold">Autentificare</CardTitle>
            <CardDescription>Introduceti datele de acces</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@omnikininetix.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Parola
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Introdu parola"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 rounded-l-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-gradient-to-r from-teal-600 to-teal-500 font-semibold text-white shadow-md shadow-teal-500/20 transition-all hover:from-teal-500 hover:to-teal-400 hover:shadow-lg hover:shadow-teal-500/30"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Autentificare'
                )}
              </Button>
            </form>

            {/* Demo accounts - subtle muted box */}
            <div className="mt-6 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Conturi demo
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground/70">Super Admin:</span>{' '}
                  admin@omnikininetix.ro
                </p>
                <p>
                  <span className="font-medium text-foreground/70">Manager Tara:</span>{' '}
                  manager@omnikininetix.ro
                </p>
                <p>
                  <span className="font-medium text-foreground/70">Manager Agentie:</span>{' '}
                  bucuresti@omnikininetix.ro
                </p>
                <p className="mt-2 border-t border-dashed border-muted-foreground/15 pt-2">
                  <span className="font-medium text-foreground/70">Parola:</span> admin123
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
