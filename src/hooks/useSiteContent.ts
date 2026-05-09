import { useMemo } from 'react';
import { useSupabaseTable } from './useSupabaseTable';

interface SiteContentRow {
  id: string;
  key: string;
  section: string;
  content: string;
}

export function useSiteContent(keys: string[]) {
  const { data, loading } = useSupabaseTable<SiteContentRow>('site_content', {
    filter: { column: 'section', value: 'about' },
    orderBy: { column: 'updated_at', ascending: false }
  });

  const contentMap = useMemo(() => {
    return data.reduce((acc, item) => {
      if (keys.includes(item.key)) {
        acc[item.key] = item.content;
      }
      return acc;
    }, {} as Record<string, string>);
  }, [data, keys]);

  return { content: contentMap, loading };
}
