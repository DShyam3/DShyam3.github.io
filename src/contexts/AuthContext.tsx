import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    isAdmin: boolean;
    login: (password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This fallback must match the literal checked by public.is_admin(). The env
// value controls the UI only; the database remains the authorization boundary.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'd.shyam1256@gmail.com';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        const checkAdmin = (session: Session | null) => {
            if (!session || !session.user || !session.user.email) return false;
            return session.user.email === ADMIN_EMAIL;
        };

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsAdmin(checkAdmin(session));
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setIsAdmin(checkAdmin(session));
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = useCallback(async (password: string): Promise<boolean> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: ADMIN_EMAIL,
                password: password,
            });

            if (error) {
                console.error('Login failed:', error.message);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }, []);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setIsAdmin(false);
        setSession(null);
    }, []);

    const value = useMemo(
        () => ({ isAdmin, login, logout, session }),
        [isAdmin, login, logout, session],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
