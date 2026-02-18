import { useState, useMemo, useRef, useEffect } from 'react';
import { COUNTRIES } from './DotMatrixGlobe';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import './DotMatrixGlobe.css';

interface GlobeAdminPanelProps {
    visitedCodes: string[];
    onAddCountry: (code: string, name: string) => Promise<boolean>;
    onRemoveCountry: (code: string) => Promise<boolean>;
}

export function GlobeAdminPanel({ visitedCodes, onAddCountry, onRemoveCountry }: GlobeAdminPanelProps) {
    const [search, setSearch] = useState('');
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const visitedSet = useMemo(() => new Set(visitedCodes), [visitedCodes]);

    const filteredCountries = useMemo(() => {
        if (!search.trim()) return [];
        const q = search.toLowerCase();
        return COUNTRIES
            .filter(c =>
                !visitedSet.has(c.code) &&
                (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
            )
            .slice(0, 10);
    }, [search, visitedSet]);

    const visitedCountries = useMemo(() =>
        COUNTRIES
            .filter(c => visitedSet.has(c.code))
            .sort((a, b) => a.name.localeCompare(b.name)),
        [visitedSet]
    );

    const handleAdd = async (code: string, name: string) => {
        const ok = await onAddCountry(code, name);
        if (ok) {
            setSearch('');
            setShowResults(false);
        }
    };

    return (
        <div className="globe-admin-panel" ref={containerRef}>
            <div className="flex items-center justify-between">
                <h3>Manage Visited Countries</h3>
                <span className="globe-country-count">
                    {visitedCodes.length} {visitedCodes.length === 1 ? 'country' : 'countries'}
                </span>
            </div>

            <div className="globe-country-search">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Search countries..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => search.trim() && setShowResults(true)}
                        className="pl-10 bg-secondary/50 border-transparent focus:border-border focus:bg-card transition-all text-sm"
                    />
                </div>

                {showResults && filteredCountries.length > 0 && (
                    <div className="globe-country-results">
                        {filteredCountries.map(country => (
                            <div
                                key={country.code}
                                className="globe-country-result-item"
                                onClick={() => handleAdd(country.code, country.name)}
                            >
                                <span>{country.name}</span>
                                <span className="country-code">{country.code}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {visitedCountries.length > 0 && (
                <div className="globe-visited-list">
                    {visitedCountries.map(country => (
                        <span key={country.code} className="globe-visited-tag">
                            {country.name}
                            <button
                                onClick={() => onRemoveCountry(country.code)}
                                aria-label={`Remove ${country.name}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
