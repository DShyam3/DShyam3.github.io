import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ScheduleItem {
    id: string;
    watchlistItemId: string;
    day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    time?: string; // Optional time like "20:00"
    title: string;
    category: 'TV Shows' | 'Movies' | 'Updates';
    image_url?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function useSchedule() {
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        // Load schedule from localStorage
        try {
            const stored = localStorage.getItem('weekly_schedule');
            if (stored) {
                setSchedule(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }, []);

    const addToSchedule = (item: Omit<ScheduleItem, 'id'>) => {
        const newItem: ScheduleItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9),
        };
        const updated = [...schedule, newItem];
        setSchedule(updated);

        // Save to localStorage
        try {
            localStorage.setItem('weekly_schedule', JSON.stringify(updated));
        } catch (error) {
            console.error('Error saving schedule:', error);
        }

        toast({
            title: 'Added to schedule',
            description: `${item.title} added to ${item.day}`,
        });
    };

    const removeFromSchedule = (id: string) => {
        const updated = schedule.filter((item) => item.id !== id);
        setSchedule(updated);

        // Save to localStorage
        try {
            localStorage.setItem('weekly_schedule', JSON.stringify(updated));
        } catch (error) {
            console.error('Error saving schedule:', error);
        }

        toast({
            title: 'Removed from schedule',
        });
    };

    const getScheduleForDay = (day: typeof DAYS[number]) => {
        return schedule.filter((item) => item.day === day);
    };

    const isInSchedule = (watchlistItemId: string) => {
        return schedule.some((item) => item.watchlistItemId === watchlistItemId);
    };

    return {
        schedule,
        addToSchedule,
        removeFromSchedule,
        getScheduleForDay,
        isInSchedule,
        DAYS,
    };
}
