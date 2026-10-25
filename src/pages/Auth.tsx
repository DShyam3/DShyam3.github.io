import { AppShell } from '@/components/layout/AppShell';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { TwoFactorSetup } from '@/components/admin/TwoFactorSetup';
import { Loader2, Lock } from 'lucide-react';

// Where to go once signed in or out: the page the header link was clicked
// on, carried in router state. Only an in-app path is accepted -- anything
// else (a direct visit, a protocol-relative URL, /auth itself) falls back to
// the home page.
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== 'string') return '/';
  if (!from.startsWith('/') || from.startsWith('//')) return '/';
  if (from === '/auth' || from.startsWith('/auth?') || from.startsWith('/auth#')) return '/';
  return from;
}

const Auth = () => {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verifyCode, isAdmin, mfaRequired, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = returnPath(location.state);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await login(password);
      if (result === 'signed-in') {
        toast({ title: 'Welcome back, Admin.' });
        navigate(from, { replace: true });
      } else if (result === 'needs-code') {
        // The code step renders from `mfaRequired`, which the auth listener
        // has already set -- the same path a reload mid-sign-in takes.
        setPassword('');
      } else {
        toast({ 
          title: 'Access Denied', 
          description: 'Incorrect password.', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (await verifyCode(code)) {
        toast({ title: 'Welcome back, Admin.' });
        navigate(from, { replace: true });
      } else {
        toast({ title: 'Invalid code', description: 'Check the code and try again.', variant: 'destructive' });
        setCode('');
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (await logout()) return true;
    toast({
      title: 'Still signed in',
      description: 'Could not reach the server to sign out. Check your connection and try again.',
      variant: 'destructive',
    });
    return false;
  };

  const handleLogout = async () => {
    if (!(await signOut())) return;
    toast({ title: 'Logged out successfully' });
    navigate(from, { replace: true });
  };

  const handleCancel = async () => {
    if (await signOut()) setCode('');
  };

  return (
    <AppShell title="Authentication" subtitle="Admin Access">
      <div className="flex-1 flex flex-col selection:bg-primary/30">
        
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div data-palette="lavender" className="ambient-card w-full max-w-md bg-card/40 backdrop-blur-md rounded-[2rem] p-8 border border-primary/10 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <DotMatrixText text="ADMIN ACCESS" size="md" className="tracking-[0.2em]" />
              <p className="text-muted-foreground text-sm mt-2">
                {mfaRequired
                  ? 'Verify your identity to enable admin mode'
                  : isAdmin
                    ? 'Admin mode is enabled'
                    : 'Enter your password to enable admin mode'}
              </p>
            </div>

            {mfaRequired ? (
              <form onSubmit={handleVerify} className="space-y-6">
                <p id="admin-code-hint" className="text-sm text-center">Enter the 6-digit code from your authenticator app</p>
                <div className="space-y-2">
                  <label htmlFor="admin-code" className="sr-only">
                    Authentication code
                  </label>
                  {/* No maxLength: it would cut a pasted "123 456" to five
                      digits before the spaces are stripped. */}
                  <Input
                    id="admin-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    aria-describedby="admin-code-hint"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-12 bg-background/50 border-primary/20 rounded-lg px-4 focus-visible:ring-primary/30"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/20 group"
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2">
                        Verify Code
                      </span>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} disabled={loading} className="rounded-lg h-12 border-primary/20">
                    Cancel
                  </Button>
                </div>
              </form>
            ) : isAdmin ? (
              <div className="space-y-6 text-center">
                <p className="text-sm font-medium text-primary">You are currently logged in as Admin.</p>
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate(from, { replace: true })} className="rounded-lg h-12">
                    {from === '/' ? 'Go to Home' : 'Go back'}
                  </Button>
                  <Button variant="outline" onClick={handleLogout} className="rounded-lg h-12 border-primary/20">
                    Logout
                  </Button>
                </div>
                <div className="border-t border-primary/10 pt-6">
                  <TwoFactorSetup />
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  {/* A placeholder is not a label: it disappears the moment
                      you type, and a screen reader may never announce it.
                      Visually hidden, so the design is unchanged. */}
                  <label htmlFor="admin-password" className="sr-only">
                    Password
                  </label>
                  <Input
                    id="admin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50 border-primary/20 rounded-lg px-4 focus-visible:ring-primary/30"
                    autoFocus
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/20 group"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Authorize Access
                    </span>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
};

export default Auth;
