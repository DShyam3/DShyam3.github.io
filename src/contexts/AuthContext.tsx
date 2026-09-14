import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    isAdmin: boolean;
    isAuthLoading: boolean;
    login: (password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The address the password box signs in as, and nothing more.
//
// This site has one password field rather than an email and a password, so the
// client has to supply an address to `signInWithPassword`. It is a convenience,
// not a permission: administrator identity lives in `public.admin_users` and is
// decided by `public.is_admin()`. Pointing this at a test account (see
// `.env.example`) is how a local stack signs in as one.
const LOGIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'd.shyam1256@gmail.com';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        // Ask the database rather than compare the email ourselves. The client
        // used to test the session's address against a literal, which was a
        // second copy of the rule `is_admin()` enforces -- and a copy that
        // could drift, showing admin controls to someone every write would
        // then be refused for. One source of truth, queried.
        let generation = 0;

        const resolveAdmin = async (session: Session | null) => {
            const current = ++generation;
            if (!session) return { current, admin: false };
            const { data, error } = await supabase.rpc('is_admin');
            if (error) {
                // Deny on failure. A network error is not a grant, and the
                // database refuses the write regardless of what the UI shows.
                console.error('Could not resolve admin status:', error.message);
                return { current, admin: false };
            }
            return { current, admin: data === true };
        };

        // INITIAL_SESSION resolves the saved session before protected routes
        // decide whether to redirect. One subscription also avoids a stale
        // getSession response overwriting a newer sign-in or sign-out event.
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            void resolveAdmin(session).then(({ current, admin }) => {
                // A sign-out that lands while an earlier check is still in
                // flight must win. Without this the resolved older answer
                // could restore admin state after the session had gone.
                if (current !== generation) return;
                setIsAdmin(admin);
                setIsAuthLoading(false);
            });
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = useCallback(async (password: string): Promise<boolean> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: LOGIN_EMAIL,
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
        () => ({ isAdmin, isAuthLoading, login, logout, session }),
        [isAdmin, isAuthLoading, login, logout, session],
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
