import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleItem {
    id: string;
    watchlistItemId: string;
    day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    time?: string;
    title?: string;
    category?: 'TV Shows' | 'Movies' | 'Upcoming';
    image_url?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function useSchedule() {
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchSchedule = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('weekly_schedule')
                .select('*');

            if (error) throw error;

            const mapped: ScheduleItem[] = (data || []).map(item => ({
                id: item.id.toString(),
                watchlistItemId: (item.tv_show_id || item.movie_id || '').toString(),
                day: item.day_of_week as any,
                category: item.tv_show_id ? 'TV Shows' : 'Movies',
            }));

            setSchedule(mapped);
        } catch (error) {
            console.error('Error fetching schedule:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const addToSchedule = async (item: Omit<ScheduleItem, 'id'>) => {
        try {
            const isTVShow = item.category === 'TV Shows';
            const payload: any = {
                day_of_week: item.day,
                tv_show_id: isTVShow ? parseInt(item.watchlistItemId) : null,
                movie_id: !isTVShow ? parseInt(item.watchlistItemId) : null,
            };

            const { data, error } = await supabase
                .from('weekly_schedule')
                .insert([payload])
                .select();

            if (error) throw error;

            if (data && data[0]) {
                const newItem: ScheduleItem = {
                    ...item,
                    id: data[0].id.toString(),
                };
                setSchedule(prev => [...prev, newItem]);
            }

            toast({
                title: 'Added to schedule',
                description: `${item.title} added to ${item.day}`,
            });
        } catch (error) {
            console.error('Error adding to schedule:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to add item to schedule.',
            });
        }
    };

    const removeFromSchedule = async (id: string) => {
        try {
            const { error } = await supabase
                .from('weekly_schedule')
                .delete()
                .eq('id', parseInt(id));

            if (error) throw error;

            setSchedule(prev => prev.filter(item => item.id !== id));

            toast({
                title: 'Removed from schedule',
            });
        } catch (error) {
            console.error('Error removing from schedule:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to remove item from schedule.',
            });
        }
    };

    const updateScheduleDay = async (id: string, newDay: typeof DAYS[number]) => {
        try {
            const { error } = await supabase
                .from('weekly_schedule')
                .update({ day_of_week: newDay })
                .eq('id', parseInt(id));

            if (error) throw error;

            setSchedule(prev => prev.map(item =>
                item.id === id ? { ...item, day: newDay } : item
            ));

            toast({
                title: 'Schedule updated',
                description: `Moved to ${newDay}`,
            });
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update schedule.',
            });
        }
    };

    const getScheduleForDay = (day: typeof DAYS[number]) => {
        return schedule.filter((item) => item.day === day);
    };

    const isInSchedule = (watchlistItemId: string) => {
        return schedule.some((item) => item.watchlistItemId === watchlistItemId);
    };

    return {
        schedule,
        loading,
        addToSchedule,
        removeFromSchedule,
        updateScheduleDay,
        getScheduleForDay,
        isInSchedule,
        DAYS,
    };
}
