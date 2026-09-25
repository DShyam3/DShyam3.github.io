import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleItem {
  id: string;
  watchlistItemId: string;
  day:
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday'
    | 'Sunday';
  time?: string;
  title?: string;
  category?: 'TV Shows' | 'Movies' | 'Upcoming';
  image_url?: string;
  scheduledDate?: string;
  mode?: 'weekly' | 'date';
}

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSchedule = useCallback(async () => {
    try {
      let { data, error } = await supabase.from('weekly_schedule').select('*');

      // Keep the existing weekly scheduler usable while the date columns are
      // being rolled out. The legacy projection is safe because all existing
      // rows are equivalent to recurring weekly entries.
      if (error) {
        const fallback = await supabase
          .from('weekly_schedule')
          .select('id, day_of_week, tv_show_id, movie_id');
        data = fallback.data?.map((item) => ({
          ...item,
          scheduled_date: null,
          schedule_mode: 'weekly',
        })) ?? null;
        error = fallback.error;
      }

      if (error) throw error;

      const mapped: ScheduleItem[] = (data || []).map((item) => ({
        id: item.id.toString(),
        watchlistItemId: (item.tv_show_id || item.movie_id || '').toString(),
        day: item.day_of_week as ScheduleItem['day'],
        category: item.tv_show_id ? 'TV Shows' : 'Movies',
        scheduledDate: item.scheduled_date ?? undefined,
        mode: item.schedule_mode === 'date' ? 'date' : 'weekly',
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
      const payload = {
        day_of_week: item.day,
        tv_show_id: isTVShow ? parseInt(item.watchlistItemId) : null,
        movie_id: !isTVShow ? parseInt(item.watchlistItemId) : null,
        scheduled_date: item.scheduledDate ?? null,
        schedule_mode: item.mode ?? 'weekly',
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
        setSchedule((prev) => [...prev, newItem]);
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

      setSchedule((prev) => prev.filter((item) => item.id !== id));

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

  const updateScheduleDay = async (id: string, newDay: (typeof DAYS)[number]) => {
    try {
      const { error } = await supabase
        .from('weekly_schedule')
        .update({ day_of_week: newDay })
        .eq('id', parseInt(id));

      if (error) throw error;

      setSchedule((prev) =>
        prev.map((item) => (item.id === id ? { ...item, day: newDay } : item)),
      );

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

  const getScheduleForDay = (day: (typeof DAYS)[number]) => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return schedule.filter((item) =>
      item.mode !== 'date'
        ? item.day === day
        : item.day === day && item.scheduledDate?.startsWith(monthKey),
    );
  };

  const isInSchedule = (watchlistItemId: string) => {
    return schedule.some((item) => item.watchlistItemId === watchlistItemId);
  };

  const removeFromScheduleByWatchlistId = async (watchlistItemId: string) => {
    const item = schedule.find((i) => i.watchlistItemId === watchlistItemId);
    if (item) {
      await removeFromSchedule(item.id);
    }
  };

  return {
    schedule,
    loading,
    addToSchedule,
    removeFromSchedule,
    removeFromScheduleByWatchlistId,
    updateScheduleDay,
    getScheduleForDay,
    isInSchedule,
    DAYS,
  };
}
