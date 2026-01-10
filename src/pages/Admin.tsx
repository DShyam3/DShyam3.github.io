import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DotMatrixText } from '@/components/DotMatrixText';
import { LogOut, Lock, Unlock } from 'lucide-react';

const Admin = () => {
    const { isAdmin, login, logout } = useAuth();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await login(password);
        if (success) {
            setError('');
            // Redirect back to previous page or home
            navigate(-1);
        } else {
            setError('Invalid password');
            setShake(true);
            setTimeout(() => setShake(false), 500);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    // Already logged in - show logout option
    if (isAdmin) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-sm space-y-8 text-center">
                    <div className="space-y-2">
                        <div className="flex justify-center mb-4">
                            <Unlock className="h-12 w-12 text-green-500" />
                        </div>
                        <DotMatrixText text="Admin Access" size="lg" />
                        <p className="text-muted-foreground text-sm mt-4">
                            You are currently logged in as admin.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="w-full gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                        <Button
                            onClick={() => navigate('/')}
                            className="w-full"
                        >
                            Back to Home
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Not logged in - show login form
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className={`w-full max-w-sm space-y-8 ${shake ? 'animate-shake' : ''}`}>
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <Lock className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <DotMatrixText text="Admin Login" size="lg" />
                    <p className="text-muted-foreground text-sm">
                        Enter password to access admin features
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="text-center"
                            autoFocus
                        />
                        {error && (
                            <p className="text-destructive text-sm text-center">{error}</p>
                        )}
                    </div>

                    <Button type="submit" className="w-full">
                        Login
                    </Button>
                </form>

                <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate('/')}
                >
                    Back to Home
                </Button>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-10px); }
                    75% { transform: translateX(10px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default Admin;
