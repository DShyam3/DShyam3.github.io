import { useState, useMemo, useCallback } from 'react';
import { Photo } from '@/types/photos';
import { deletePhotoFromStorage } from '@/lib/storage';
import { useSupabaseTable } from './useSupabaseTable';

export function usePhotos() {
  const { data: rawPhotos, loading, addItem, removeItem, updateItem } = useSupabaseTable<any>('photos');
  const [searchQuery, setSearchQuery] = useState('');

  const photos = useMemo(
    () => rawPhotos.map((p) => ({ ...p, created_at: new Date(p.created_at) })) as Photo[],
    [rawPhotos],
  );

  const addPhoto = (photo: Omit<Photo, 'id' | 'created_at'>) =>
    addItem({
      image_url: photo.image_url,
      caption: photo.caption,
      location: photo.location,
    });

  const removePhoto = useCallback(
    async (id: string) => {
      const photoToRemove = photos.find((p) => p.id === id);
      await removeItem(id);
      if (photoToRemove?.image_url) {
        await deletePhotoFromStorage(photoToRemove.image_url);
      }
    },
    [photos, removeItem],
  );

  const updatePhoto = (id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>) =>
    updateItem({ id, updates });

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
