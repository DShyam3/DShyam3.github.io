import { useSupabaseTable } from './useSupabaseTable';

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  logo_url: string;
  description?: string;
  order: number;
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  start_date: string;
  end_date: string;
  logo_url: string;
  order: number;
}

// Internal type for the database row
interface SiteContentRow {
  key: string;
  section: string;
  metadata: any;
  content: string;
  order: number;
}

export function useExperience() {
  const { data, loading, addItem, removeItem, updateItem } = useSupabaseTable<SiteContentRow>('site_content', {
    filter: { column: 'section', value: 'experience' },
    orderBy: { column: 'order', ascending: true },
    primaryKey: 'key'
  });
  
  const mappedData: Experience[] = data.map(row => ({
    id: row.key,
    order: row.order,
    ...(row.metadata as any)
  }));

  return {
    experience: mappedData,
    loading,
    addExperience: (exp: Omit<Experience, 'id'>) => {
      const { order, ...metadata } = exp;
      // Generate a key for experience
      const key = `exp_${crypto.randomUUID()}`;
      return addItem({ key, section: 'experience', metadata, order, content: '' });
    },
    removeExperience: removeItem,
    updateExperience: (key: string, updates: Partial<Experience>) => {
      const { order, ...metadataUpdates } = updates;
      return updateItem({ id: key, updates: { ...(order !== undefined ? { order } : {}), metadata: metadataUpdates } as any });
    },
  };
}

export function useEducation() {
  const { data, loading, addItem, removeItem, updateItem } = useSupabaseTable<SiteContentRow>('site_content', {
    filter: { column: 'section', value: 'education' },
    orderBy: { column: 'order', ascending: true },
    primaryKey: 'key'
  });
  
  const mappedData: Education[] = data.map(row => ({
    id: row.key,
    order: row.order,
    ...(row.metadata as any)
  }));

  return {
    education: mappedData,
    loading,
    addEducation: (edu: Omit<Education, 'id'>) => {
      const { order, ...metadata } = edu;
      // Generate a key for education
      const key = `edu_${crypto.randomUUID()}`;
      return addItem({ key, section: 'education', metadata, order, content: '' });
    },
    removeEducation: removeItem,
    updateEducation: (key: string, updates: Partial<Education>) => {
      const { order, ...metadataUpdates } = updates;
      return updateItem({ id: key, updates: { ...(order !== undefined ? { order } : {}), metadata: metadataUpdates } as any });
    },
  };
}
