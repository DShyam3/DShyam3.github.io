import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Plus, Check } from 'lucide-react';
import './DotMatrixGlobe.css';

interface CountryData {
    code: string;
    name: string;
    flagUrl: string;
    hasMapDot: boolean; // whether this country appears on the dot map
}

interface GlobeAdminPanelProps {
    visitedCodes: string[];
    onAddCountry: (code: string, name: string) => Promise<boolean>;
    onRemoveCountry: (code: string) => Promise<boolean>;
}

// Cache so we only fetch once across renders
let cachedCountries: CountryData[] | null = null;

export function GlobeAdminPanel({ visitedCodes, onAddCountry, onRemoveCountry }: GlobeAdminPanelProps) {
    const [search, setSearch] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [allCountries, setAllCountries] = useState<CountryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null); // code currently being added
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load country data: REST Countries API + dot map codes
    useEffect(() => {
        if (cachedCountries) {
            setAllCountries(cachedCountries);
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                // Load dot map to know which countries have map dots
                const [dotRes, apiRes] = await Promise.all([
                    fetch('/data/dot-world-map.json'),
                    fetch('https://restcountries.com/v3.1/all?fields=name,cca2'),
                ]);

                const dotData = await dotRes.json();
                const dotCodes = new Set<string>(
                    (dotData.dots as [number, number, string][]).map(d => d[2])
                );

                const apiData = await apiRes.json();
                const countries: CountryData[] = apiData
                    .map((c: any) => ({
                        code: c.cca2 as string,
                        name: c.name.common as string,
                        flagUrl: `https://flagcdn.com/w40/${c.cca2.toLowerCase()}.png`,
                        hasMapDot: dotCodes.has(c.cca2),
                    }))
                    .sort((a: CountryData, b: CountryData) => a.name.localeCompare(b.name));

                cachedCountries = countries;
                setAllCountries(countries);
            } catch (error) {
                console.error('Error loading country data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

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

    // Keyboard: Escape closes dropdown
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowResults(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    const visitedSet = useMemo(() => new Set(visitedCodes), [visitedCodes]);

    const filteredCountries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return allCountries
            .filter(c =>
                c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
            )
            .slice(0, 8);
    }, [search, allCountries]);

    const handleAdd = useCallback(async (code: string, name: string) => {
        setAdding(code);
        const ok = await onAddCountry(code, name);
        setAdding(null);
        if (ok) {
            setSearch('');
            setShowResults(false);
            inputRef.current?.focus();
        }
    }, [onAddCountry]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setShowResults(true);
    };

    const handleInputFocus = () => {
        if (search.trim()) setShowResults(true);
    };

    // Keyboard navigation in dropdown
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && filteredCountries.length === 1) {
            handleAdd(filteredCountries[0].code, filteredCountries[0].name);
        }
        if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    return (
        <div className="globe-admin-panel" ref={containerRef}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Add Visited Country</h3>
                <span className="globe-country-count">
                    {visitedCodes.length} {visitedCodes.length === 1 ? 'country' : 'countries'}
                </span>
            </div>

            <div className="globe-country-search">
                <div className="relative">
                    {loading ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                    ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    )}
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={loading ? 'Loading countries…' : 'Search and add a country…'}
                        disabled={loading}
                        value={search}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={handleInputKeyDown}
                        className="pl-10 pr-4 bg-secondary/50 border-transparent focus:border-border focus:bg-card transition-all text-sm"
                        autoComplete="off"
                    />
                </div>

                {/* Dropdown results */}
                {showResults && search.trim() && (
                    <div className="globe-country-results">
                        {filteredCountries.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                No countries found for "{search}"
                            </div>
                        ) : (
                            filteredCountries.map(country => {
                                const isAdding = adding === country.code;
                                const isVisited = visitedSet.has(country.code);
                                return (
                                    <button
                                        key={country.code}
                                        className={`globe-country-result-item w-full text-left${isVisited ? ' globe-result-already-added' : ''}`}
                                        onClick={() => !isVisited && handleAdd(country.code, country.name)}
                                        disabled={isAdding || isVisited}
                                        aria-disabled={isVisited}
                                    >
                                        {/* Flag */}
                                        <div className="globe-result-flag">
                                            <img
                                                src={country.flagUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                                            />
                                        </div>

                                        {/* Name + map indicator */}
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="font-medium text-sm leading-tight truncate">
                                                {country.name}
                                            </span>
                                            {!country.hasMapDot && !isVisited && (
                                                <span className="text-[10px] text-amber-500/80 leading-tight">
                                                    no map dot yet
                                                </span>
                                            )}
                                            {isVisited && (
                                                <span className="text-[10px] leading-tight globe-result-added-label">
                                                    already added
                                                </span>
                                            )}
                                        </div>

                                        {/* Code + status icon */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className="country-code">{country.code}</span>
                                            {isAdding ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                            ) : isVisited ? (
                                                <Check className="h-3.5 w-3.5 globe-result-check-icon" />
                                            ) : (
                                                <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                        {filteredCountries.length === 1 && (
                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/50">
                                Press Enter to add
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
