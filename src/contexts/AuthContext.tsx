import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    isAdmin: boolean;
    isAuthLoading: boolean;
    login: (password: string) => Promise<boolean>;
    /** False when the sign-out failed and the session is still stored. */
    logout: () => Promise<boolean>;
    session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The address the password box signs in as, and nothing more.
//
// This site has one password field rather than an email and a password, so the
// client has to supply an address to `signInWithPassword`. It is a convenience,
// not a permission: administrator identity lives in `public.admin_users` and is
// decided by `public.is_admin()`. Pointing this at a test account (see
// `.env.example`) is how a local stack signs in as one. No fallback: a fork
// without this set signs in as no one rather than as the original owner.
const LOGIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// A hung `is_admin` call would otherwise hold every protected route on its
// loading state until the browser gave up on the request.
const ADMIN_CHECK_TIMEOUT_MS = 8000;

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
        // The last answer the database gave, and for whom. Every token
        // refresh re-asks; one dropped request on a refresh used to take the
        // admin controls away mid-session.
        let lastAnswer: { userId: string; admin: boolean } | null = null;

        const resolveAdmin = async (session: Session | null) => {
            const current = ++generation;
            if (!session) {
                lastAnswer = null;
                return { current, admin: false };
            }
            const userId = session.user.id;
            const { data, error } = await supabase
                .rpc('is_admin')
                .abortSignal(AbortSignal.timeout(ADMIN_CHECK_TIMEOUT_MS));
            if (error) {
                // A failure is not a grant. The same user keeps the answer
                // they already had; anyone else is denied. Either way this
                // only decides what renders -- the database refuses the write
                // regardless of what the UI shows.
                console.error('Could not resolve admin status:', error.message);
                return { current, admin: lastAnswer?.userId === userId ? lastAnswer.admin : false };
            }
            lastAnswer = { userId, admin: data === true };
            return { current, admin: lastAnswer.admin };
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
        if (!LOGIN_EMAIL) {
            console.error('Login failed: sign-in is not configured (VITE_ADMIN_EMAIL is unset).');
            return false;
        }
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

    const logout = useCallback(async (): Promise<boolean> => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            // Offline, auth-js keeps the stored session when the server call
            // fails (in every scope), so this device is still signed in. Say
            // so, rather than hide the admin controls until the next token
            // refresh or reload brings them back.
            console.error('Sign-out failed:', error.message);
            return false;
        }
        setIsAdmin(false);
        setSession(null);
        return true;
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
