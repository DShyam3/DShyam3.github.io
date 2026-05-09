import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Loader2, Lock } from 'lucide-react';

const Auth = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAdmin, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const success = await login(password);
      if (success) {
        toast({ title: 'Welcome back, Admin.' });
        navigate('/');
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

  const handleLogout = async () => {
    await logout();
    toast({ title: 'Logged out successfully' });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <div className="wide-container flex-1 flex flex-col">
        <Header title="Authentication" subtitle="Admin Access" />
        
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-card/40 backdrop-blur-md rounded-[2rem] p-8 border border-primary/10 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <DotMatrixText text="ADMIN ACCESS" size="md" className="tracking-[0.2em]" />
              <p className="text-muted-foreground text-sm mt-2">Enter your password to enable admin mode</p>
            </div>

            {isAdmin ? (
              <div className="space-y-6 text-center">
                <p className="text-sm font-medium text-primary">You are currently logged in as Admin.</p>
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate('/')} className="rounded-xl h-12">
                    Go to Home
                  </Button>
                  <Button variant="outline" onClick={handleLogout} className="rounded-xl h-12 border-primary/20">
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50 border-primary/20 rounded-xl px-4 focus-visible:ring-primary/30"
                    autoFocus
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/20 group"
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
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Auth;
