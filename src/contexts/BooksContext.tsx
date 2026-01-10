import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Book, BookCategory } from '@/types/books';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;

interface BooksContextType {
    books: Book[];
    allBooks: Book[];
    activeCategory: BookCategory;
    setActiveCategory: (category: BookCategory) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addBook: (book: Omit<Book, 'id' | 'created_at'>) => Promise<void>;
    removeBook: (id: string) => Promise<void>;
    updateBook: (id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>) => Promise<void>;
    categories: { key: BookCategory; label: string }[];
    getCategoryCount: (category: BookCategory) => number;
    loading: boolean;
    refreshBooks: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | undefined>(undefined);

export const BooksProvider = ({ children }: { children: ReactNode }) => {
    const [books, setBooks] = useState<Book[]>([]);
    const [activeCategory, setActiveCategory] = useState<BookCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchBooks = useCallback(async () => {
        try {
            const { data, error } = await db.from('books').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setBooks(data?.map((b: any) => ({ ...b, created_at: new Date(b.created_at) })) || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchBooks(); }, [fetchBooks]);

    const addBook = async (book: Omit<Book, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await db.from('books').insert(book).select().single();
            if (error) throw error;
            setBooks(prev => [{ ...data, created_at: new Date(data.created_at) }, ...prev]);
            toast({ title: 'Book added!' });
        } catch (error) { toast({ title: 'Error adding book', variant: 'destructive' }); }
    };

    const removeBook = async (id: string) => {
        try {
            const { error } = await db.from('books').delete().eq('id', id);
            if (error) throw error;
            setBooks(prev => prev.filter(b => b.id !== id));
            toast({ title: 'Book removed' });
        } catch (error) { toast({ title: 'Error removing book', variant: 'destructive' }); }
    };

    const updateBook = async (id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>) => {
        try {
            const { error } = await db.from('books').update(updates).eq('id', id);
            if (error) throw error;
            setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
            toast({ title: 'Book updated!' });
        } catch (error) { toast({ title: 'Error updating book', variant: 'destructive' }); }
    };

    const filteredBooks = useMemo(() => {
        let filtered = books;
        if (activeCategory !== 'all') filtered = filtered.filter(b => b.category === activeCategory);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
        }
        return filtered;
    }, [books, activeCategory, searchQuery]);

    const categories: { key: BookCategory; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'reading', label: 'Reading' },
        { key: 'completed', label: 'Completed' },
        { key: 'wishlist', label: 'To Read' },
    ];

    const getCategoryCount = (category: BookCategory) => category === 'all' ? books.length : books.filter(b => b.category === category).length;

    return (
        <BooksContext.Provider value={{ books: filteredBooks, allBooks: books, activeCategory, setActiveCategory, searchQuery, setSearchQuery, addBook, removeBook, updateBook, categories, getCategoryCount, loading, refreshBooks: fetchBooks }}>
            {children}
        </BooksContext.Provider>
    );
};

export const useBooksContext = () => useContext(BooksContext);
