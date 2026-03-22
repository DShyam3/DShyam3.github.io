import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, Plus, Check, MapPin, ChevronLeft, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CityEntry } from '@/hooks/useCityMap';
import type { VisitedCity } from '@/hooks/useVisitedCities';

interface CountryCityPanelProps {
    countryCode: string;
    countryName: string;
    flagUrl: string;
    cities: CityEntry[];                // from dot-city-map.json
    visitedCities: VisitedCity[];       // from Supabase
    isAdmin: boolean;
    onAddCity: (
        countryCode: string,
        cityName: string,
        lat: number,
        lon: number,
        dotCol: number,
        dotRow: number
    ) => Promise<boolean>;
    onRemoveCity: (countryCode: string, cityName: string) => Promise<boolean>;
    onBack: () => void;
}

export function CountryCityPanel({
    countryCode,
    countryName,
    flagUrl,
    cities,
    visitedCities,
    isAdmin,
    onAddCity,
    onRemoveCity,
    onBack,
}: CountryCityPanelProps) {
    const [search, setSearch] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [adding, setAdding] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const visitedSet = useMemo(
        () => new Set(visitedCities.map(c => c.city_name)),
        [visitedCities]
    );

    // Filter cities from the dot-city-map by search query
    const filteredCities = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return cities
            .filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.ascii.toLowerCase().includes(q)
            )
            .slice(0, 10);
    }, [search, cities]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowResults(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    const handleAdd = useCallback(async (city: CityEntry) => {
        setAdding(city.name);
        const ok = await onAddCity(
            countryCode,
            city.name,
            city.lat,
            city.lon,
            city.dot[0],
            city.dot[1]
        );
        setAdding(null);
        if (ok) {
            setSearch('');
            setShowResults(false);
            inputRef.current?.focus();
        }
    }, [countryCode, onAddCity]);

    const handleRemove = useCallback(async (cityName: string) => {
        setRemoving(cityName);
        await onRemoveCity(countryCode, cityName);
        setRemoving(null);
    }, [countryCode, onRemoveCity]);

    const formatPopulation = (pop: number) => {
        if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
        if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
        return pop.toString();
    };

    return (
        <div className="city-panel" ref={containerRef}>
            {/* Header with back button */}
            <div className="city-panel-header">
                <button className="city-panel-back" onClick={onBack} aria-label="Back to countries">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <img
                    src={flagUrl}
                    alt={`${countryName} flag`}
                    className="city-panel-flag"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
                <div className="city-panel-title">
                    <span className="city-panel-country-name">{countryName}</span>
                    <span className="city-panel-city-count">
                        {visitedCities.length} {visitedCities.length === 1 ? 'city' : 'cities'} visited
                        {cities.length > 0 && ` · ${cities.length} total`}
                    </span>
                </div>
            </div>

            {/* Search bar (admin only) */}
            {isAdmin && (
                <div className="city-panel-search">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            type="text"
                            placeholder={`Search cities in ${countryName}…`}
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                            onFocus={() => { if (search.trim()) setShowResults(true); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && filteredCities.length === 1 && !visitedSet.has(filteredCities[0].name)) {
                                    handleAdd(filteredCities[0]);
                                }
                                if (e.key === 'Escape') setShowResults(false);
                            }}
                            className="pl-10 pr-4 bg-secondary/50 border-transparent focus:border-border focus:bg-card transition-all text-sm"
                            autoComplete="off"
                        />
                    </div>

                    {/* Search results dropdown */}
                    {showResults && search.trim() && (
                        <div className="city-panel-results">
                            {filteredCities.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                    No cities found for "{search}"
                                </div>
                            ) : (
                                filteredCities.map(city => {
                                    const isAdding = adding === city.name;
                                    const isVisited = visitedSet.has(city.name);
                                    return (
                                        <button
                                            key={`${city.name}-${city.lat}-${city.lon}`}
                                            className={`city-panel-result-item${isVisited ? ' city-result-visited' : ''}`}
                                            onClick={() => !isVisited && handleAdd(city)}
                                            disabled={isAdding || isVisited}
                                        >
                                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-medium text-sm leading-tight truncate">
                                                    {city.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground leading-tight">
                                                    pop. {formatPopulation(city.pop)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {isAdding ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                ) : isVisited ? (
                                                    <Check className="h-3.5 w-3.5 text-amber-500" />
                                                ) : (
                                                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                            {filteredCities.length === 1 && !visitedSet.has(filteredCities[0].name) && (
                                <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/50">
                                    Press Enter to add
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Visited cities list */}
            <div className="city-panel-list">
                {visitedCities.length === 0 ? (
                    <div className="city-panel-empty">
                        <MapPin className="w-5 h-5 text-muted-foreground/50" />
                        <span>No cities tracked yet</span>
                    </div>
                ) : (
                    <ul className="city-list">
                        {visitedCities.map(city => (
                            <li key={`${city.country_code}-${city.city_name}`} className="city-list-row">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-amber-500/70" />
                                <span className="city-list-name">{city.city_name}</span>
                                {isAdmin && (
                                    <button
                                        className="city-remove-btn"
                                        onClick={() => handleRemove(city.city_name)}
                                        disabled={removing === city.city_name}
                                        aria-label={`Remove ${city.city_name}`}
                                    >
                                        {removing === city.city_name ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <X className="w-3 h-3" />
                                        )}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
