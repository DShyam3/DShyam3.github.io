import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { LinkItem, LinkCategory } from '@/types/links';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;

interface LinksContextType {
    links: LinkItem[];
    allLinks: LinkItem[];
    activeCategory: LinkCategory;
    setActiveCategory: (category: LinkCategory) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addLink: (link: Omit<LinkItem, 'id' | 'createdAt'>) => Promise<void>;
    removeLink: (id: string) => Promise<void>;
    updateLink: (id: string, updates: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => Promise<void>;
    categories: { key: LinkCategory; label: string }[];
    getCategoryCount: (category: LinkCategory) => number;
    loading: boolean;
    refreshLinks: () => Promise<void>;
}

const LinksContext = createContext<LinksContextType | undefined>(undefined);

export const LinksProvider = ({ children }: { children: ReactNode }) => {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<LinkCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchLinks = useCallback(async () => {
        try {
            const { data, error } = await db
                .from('links')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setLinks(
                data?.map((link: any) => ({
                    id: link.id,
                    name: link.name,
                    url: link.url,
                    description: link.description || '',
                    category: link.category as Exclude<LinkCategory, 'all'>,
                    icon: link.icon || undefined,
                    createdAt: new Date(link.created_at),
                })) || []
            );
        } catch (error) {
            console.error('Error fetching links:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const addLink = async (link: Omit<LinkItem, 'id' | 'createdAt'>) => {
        try {
            const { data, error } = await db
                .from('links')
                .insert({ name: link.name, url: link.url, description: link.description, category: link.category, icon: link.icon })
                .select().single();
            if (error) throw error;
            setLinks((prev) => [{ id: data.id, name: data.name, url: data.url, description: data.description || '', category: data.category as any, icon: data.icon || undefined, createdAt: new Date(data.created_at) }, ...prev]);
            toast({ title: 'Link added!' });
        } catch (error) { toast({ title: 'Error adding link', variant: 'destructive' }); }
    };

    const removeLink = async (id: string) => {
        try {
            const { error } = await db.from('links').delete().eq('id', id);
            if (error) throw error;
            setLinks((prev) => prev.filter((link) => link.id !== id));
            toast({ title: 'Link removed' });
        } catch (error) { toast({ title: 'Error removing link', variant: 'destructive' }); }
    };

    const updateLink = async (id: string, updates: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => {
        try {
            const { error } = await db.from('links').update(updates).eq('id', id);
            if (error) throw error;
            setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, ...updates } : link)));
            toast({ title: 'Link updated!' });
        } catch (error) { toast({ title: 'Error updating link', variant: 'destructive' }); }
    };

    const filteredLinks = useMemo(() => {
        let filtered = links;
        if (activeCategory !== 'all') filtered = filtered.filter((link) => link.category === activeCategory);
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((link) => link.name.toLowerCase().includes(query) || link.description.toLowerCase().includes(query));
        }
        return filtered;
    }, [links, activeCategory, searchQuery]);

    const categories: { key: LinkCategory; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'websites', label: 'Websites' },
        { key: 'iphone-apps', label: 'iPhone Apps' },
        { key: 'ipad-apps', label: 'iPad Apps' },
        { key: 'mac-apps', label: 'Mac Apps' },
        { key: 'dev-setup', label: 'Dev Setup' },
    ];

    const getCategoryCount = (category: LinkCategory) => {
        if (category === 'all') return links.length;
        return links.filter((link) => link.category === category).length;
    };

    return (
        <LinksContext.Provider value={{ links: filteredLinks, allLinks: links, activeCategory, setActiveCategory, searchQuery, setSearchQuery, addLink, removeLink, updateLink, categories, getCategoryCount, loading, refreshLinks: fetchLinks }}>
            {children}
        </LinksContext.Provider>
    );
};

export const useLinksContext = () => {
    const context = useContext(LinksContext);
    if (!context) throw new Error('useLinksContext must be used within a LinksProvider');
    return context;
};
