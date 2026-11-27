import { useMemo, useState } from 'react';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { loadFineMapSurface, loadMapSurface } from './loadMapSurface';

export const MAP_SURFACES = {
    classic: 'Classic',
    topographic: 'Topographic',
    satellite: 'Satellite mosaic',
} as const;

type MapSurface = keyof typeof MAP_SURFACES;
const STORAGE_KEY = 'travel-map-surface';

function isSurface(value: string | null): value is MapSurface {
    return value === 'classic' || value === 'topographic' || value === 'satellite';
}

function readSurface(): MapSurface {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (isSurface(stored)) return stored;
    } catch {
        // Storage can be unavailable in private browsing.
    }
    return 'classic';
}

export function useMapSurface(showFine: boolean) {
    const [look, setLook] = useState(readSurface);
    const query = useQuery({
        queryKey: ['travel', 'map-surface', look],
        queryFn: look === 'classic' ? skipToken : () => loadMapSurface(look),
        placeholderData: look === 'classic' ? undefined : keepPreviousData,
        staleTime: Infinity,
        structuralSharing: false,
        retry: false,
    });

    const visibleLook = query.data?.look ?? look;
    const fine = useQuery({
        queryKey: ['travel', 'map-surface-detail', visibleLook],
        queryFn: visibleLook === 'classic' ? skipToken : () => loadFineMapSurface(visibleLook),
        enabled: showFine && visibleLook !== 'classic',
        staleTime: Infinity,
        structuralSharing: false,
        retry: false,
    });
    const surface = useMemo(() => {
        const current = query.data;
        if (!current) return undefined;
        return { ...current, fineImages: fine.data };
    }, [query.data, fine.data]);

    function chooseLook(value: string) {
        if (!isSurface(value)) return;
        setLook(value);
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // Keep the choice for this visit.
        }
    }

    return {
        look, chooseLook, surface,
        loading: query.isFetching,
        failed: query.isError,
        detailFailed: showFine && !query.isError && fine.isError,
        retry: query.isError ? query.refetch : fine.refetch,
    };
}
