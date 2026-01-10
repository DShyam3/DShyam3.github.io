import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
    isAdmin: boolean;
    login: (password: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin password from environment variable
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAdmin, setIsAdmin] = useState(false);

    // Check localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('admin_authenticated');
        if (stored === 'true') {
            setIsAdmin(true);
        }
    }, []);

    const login = (password: string): boolean => {
        if (password === ADMIN_PASSWORD) {
            setIsAdmin(true);
            localStorage.setItem('admin_authenticated', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAdmin(false);
        localStorage.removeItem('admin_authenticated');
    };

    return (
        <AuthContext.Provider value={{ isAdmin, login, logout }}>
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
