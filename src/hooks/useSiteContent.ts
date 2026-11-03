import { useMemo } from 'react';
import { useSupabaseTable, type TableReadOptions } from './useSupabaseTable';

interface SiteContentRow {
  id: string;
  key: string;
  section: string;
  content: string;
}

/** The `site_content` read behind the About copy, exported for the background warm-up. */
export const ABOUT_READ: TableReadOptions = {
  filter: { column: 'section', value: 'about' },
  orderBy: { column: 'updated_at', ascending: false },
};

export function useSiteContent(keys: string[]) {
  const { data, loading } = useSupabaseTable<SiteContentRow>('site_content', ABOUT_READ);

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
