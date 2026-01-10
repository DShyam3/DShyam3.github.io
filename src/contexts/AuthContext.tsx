import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    isAdmin: boolean;
    login: (password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default admin email to use with the password.
// The user should create this user in Supabase Auth if not already created.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@dhyanshyam.com';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsAdmin(!!session);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setIsAdmin(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (password: string): Promise<boolean> => {
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
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setIsAdmin(false);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ isAdmin, login, logout, session }}>
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
