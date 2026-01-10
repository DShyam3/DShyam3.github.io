import { useState, useCallback, useMemo, useEffect } from 'react';
import { Photo } from '@/types/photos';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPhotos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPhotos(
        data?.map((p) => ({
          ...p,
          created_at: new Date(p.created_at),
        })) || []
      );
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast({ title: 'Error fetching photos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const addPhoto = useCallback(async (photo: Omit<Photo, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .insert({
          image_url: photo.image_url,
          caption: photo.caption,
          location: photo.location,
        })
        .select()
        .single();

      if (error) throw error;

      setPhotos((prev) => [{
        ...data,
        created_at: new Date(data.created_at),
      }, ...prev]);
      
      toast({ title: 'Photo added!' });
    } catch (error) {
      console.error('Error adding photo:', error);
      toast({ title: 'Error adding photo', variant: 'destructive' });
    }
  }, [toast]);

  const removePhoto = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) throw error;
      setPhotos((prev) => prev.filter((photo) => photo.id !== id));
      toast({ title: 'Photo removed' });
    } catch (error) {
      console.error('Error removing photo:', error);
      toast({ title: 'Error removing photo', variant: 'destructive' });
    }
  }, [toast]);

  const updatePhoto = useCallback(async (id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((photo) => (photo.id === id ? { ...photo, ...updates } : photo))
      );
      toast({ title: 'Photo updated!' });
    } catch (error) {
      console.error('Error updating photo:', error);
      toast({ title: 'Error updating photo', variant: 'destructive' });
    }
  }, [toast]);

  const filteredPhotos = useMemo(() => {
    if (!searchQuery) return photos;

    const query = searchQuery.toLowerCase();
    return photos.filter(
      (photo) =>
        (photo.caption && photo.caption.toLowerCase().includes(query)) ||
        (photo.location && photo.location.toLowerCase().includes(query))
    );
  }, [photos, searchQuery]);

  return {
    photos: filteredPhotos,
    allPhotos: photos,
    searchQuery,
    setSearchQuery,
    addPhoto,
    removePhoto,
    updatePhoto,
    loading,
  };
}