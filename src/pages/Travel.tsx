import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixGlobe } from '@/components/dot-matrix/DotMatrixGlobe';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitedCountries } from '@/hooks/useVisitedCountries';
import { useVisitedCities } from '@/hooks/useVisitedCities';
import { useCityMap } from '@/hooks/useCityMap';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { CONTINENT_ORDER } from '@/data/continents';
import { useContinentMap } from '@/hooks/useContinentMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { Globe, MapPin, Search, Plus, X, Loader2 } from 'lucide-react';
import { CountryCityPanel } from '@/components/travel/CountryCityPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import './Index.css';

type ViewMode = 'countries' | 'cities';

const Travel = () => {
    const isMobile = useIsMobile();
    const { isAdmin } = useAuth();
    const { visitedCountries, addCountry, removeCountry } = useVisitedCountries();
    const visitedCodes = visitedCountries.map(c => c.country_code);
    const { byCode: continentByCode, totals: continentTotals, sovereignCodes, loading: continentLoading } = useContinentMap();

    // City tracking
    const { visitedCities, citiesByCountry, visitedDotKeys, addCity, removeCity } = useVisitedCities();
    const { loaded: cityMapLoaded, loading: cityMapLoading, loadCityMap, getCitiesForCountry } = useCityMap();

    // View mode toggle
    const [viewMode, setViewMode] = useState<ViewMode>('countries');

    // Drill-down state: which country is expanded to show cities
    const [selectedCountry, setSelectedCountry] = useState<{
        code: string;
        name: string;
        flagUrl: string;
    } | null>(null);

    // Admin Country Search
    const [countrySearch, setCountrySearch] = useState('');
    const [allCountries, setAllCountries] = useState<{ code: string, name: string }[]>([]);
    const [showCountryResults, setShowCountryResults] = useState(false);

    useEffect(() => {
        if (isAdmin && allCountries.length === 0) {
            const fetchAll = async () => {
                try {
                    const res = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name');
                    if (!res.ok) return;
                    const data = await res.json();
                    setAllCountries(data.map((c: any) => ({
                        code: c.cca2,
                        name: c.name.common
                    })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
                } catch (e) {
                    console.error('[Travel] Failed to fetch countries list:', e);
                }
            };
            fetchAll();
        }
    }, [isAdmin, allCountries.length]);

    const filteredSearchCountries = useMemo(() => {
        if (!countrySearch.trim()) return [];
        const searchLower = countrySearch.toLowerCase();
        return allCountries.filter(c => 
            (c.name.toLowerCase().includes(searchLower) || c.code.toLowerCase().includes(searchLower)) &&
            !visitedCodes.includes(c.code)
        ).slice(0, 10);
    }, [countrySearch, allCountries, visitedCodes]);

    const [focusTrigger, setFocusTrigger] = useState(0);

    // Pre-load city map data when switching to cities mode
    useEffect(() => {
        if (viewMode === 'cities' && !cityMapLoaded) {
            loadCityMap();
        }
    }, [viewMode, cityMapLoaded, loadCityMap]);

    // Also load city map when a country is selected for drill-down
    useEffect(() => {
        if (selectedCountry && !cityMapLoaded) {
            loadCityMap();
        }
    }, [selectedCountry, cityMapLoaded, loadCityMap]);

    // Split: sovereign UN states vs territories/dependencies
    const sovereignVisited = visitedCountries.filter(c => sovereignCodes.size === 0 || sovereignCodes.has(c.country_code));
    const territoryVisited = visitedCountries.filter(c => sovereignCodes.size > 0 && !sovereignCodes.has(c.country_code));

    // Sovereign count drives all the stats
    const totalCountries = Object.values(continentTotals).reduce((a, b) => a + b, 0) || 195;
    const sovereignCount = sovereignVisited.length;

    const [hovered, setHovered] = useState<{ code: string; name: string; flagUrl: string; dotKey?: string | null } | null>(null);

    const handleCountryHover = useCallback((
        code: string | null,
        name: string | null,
        flagUrl: string | null,
        dotKey?: string | null
    ) => {
        setHovered(code && name && flagUrl ? { code, name, flagUrl, dotKey } : null);
    }, []);

    const hoveredCities = useMemo(() => {
        if (!hovered?.dotKey || viewMode !== 'cities') return [];
        return visitedCities.filter(c => `${c.dot_col},${c.dot_row}` === hovered.dotKey);
    }, [hovered?.dotKey, visitedCities, viewMode]);

    const tooltipText = useMemo(() => {
        if (!hovered) return 'HOVER TO EXPLORE';
        if (viewMode === 'cities' && hoveredCities.length > 0) {
            return hoveredCities.map(c => c.city_name).join(', ').toUpperCase();
        }
        return visitedCodes.includes(hovered.code)
            ? `${hovered.name.toUpperCase()} - VISITED`
            : hovered.name.toUpperCase();
    }, [hovered, viewMode, hoveredCities, visitedCodes]);

    // Group SOVEREIGN visited countries by continent
    const byContinent = useMemo(() => {
        const groups: Record<string, typeof visitedCountries> = {};
        for (const country of sovereignVisited) {
            const continent = continentByCode[country.country_code] ?? 'Other';
            if (!groups[continent]) groups[continent] = [];
            groups[continent].push(country);
        }
        for (const c of Object.keys(groups)) {
            groups[c].sort((a, b) => a.country_name.localeCompare(b.country_name));
        }
        return groups;
    }, [sovereignVisited, continentByCode]);

    const continentsWithData = CONTINENT_ORDER.filter(c => byContinent[c]?.length > 0);
    const extraContinents = Object.keys(byContinent).filter(
        c => !CONTINENT_ORDER.includes(c) && byContinent[c]?.length > 0
    );
    const allContinentsToShow = [...continentsWithData, ...extraContinents];

    // Territories sorted alphabetically
    const territoriesSorted = [...territoryVisited].sort((a, b) =>
        a.country_name.localeCompare(b.country_name)
    );

    // Handle clicking a country row to drill into cities
    const handleCountryClick = useCallback((code: string, name: string) => {
        const flagUrl = `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
        setSelectedCountry({ code, name, flagUrl });
        setFocusTrigger(prev => prev + 1);
    }, []);

    const onGlobeCountryClick = useCallback((code: string, name: string) => {
        handleCountryClick(code, name);
    }, [handleCountryClick]);

    const handleCityPanelBack = useCallback(() => {
        setSelectedCountry(null);
    }, []);

    // Total visited cities count
    const totalCitiesVisited = visitedCities.length;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="wide-container flex-1 flex flex-col">
                <Header title="Travel" subtitle="Where I've been" />

                <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-0 py-12 md:py-24 space-y-16">

                    {/* WHERE I'VE BEEN */}
                    <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        <div className="travel-layout">

                            {/* LEFT — title above, country list in card below */}
                            <div className="travel-sidebar-col">
                                {/* Title + counter + percentage — sovereign states only */}
                                <div className="travel-sidebar-labels">
                                    <DotMatrixText
                                        text="WHERE I'VE BEEN  "
                                        size={isMobile ? "xs" : "sm"}
                                        wrap={false}
                                        className="text-muted-foreground whitespace-nowrap"
                                    />
                                    <DotMatrixText
                                        text={`${sovereignCount}/${totalCountries}  ${Math.round((sovereignCount / totalCountries) * 100)}%`}
                                        size={isMobile ? "xs" : "sm"}
                                        wrap={false}
                                        className="text-muted-foreground whitespace-nowrap"
                                    />
                                </div>

                                {/* View mode toggle — Countries / Cities */}
                                <div className="travel-view-toggle">
                                    <button
                                        className={`travel-view-toggle-btn${viewMode === 'countries' ? ' travel-view-toggle-btn--active' : ''}`}
                                        onClick={() => { setViewMode('countries'); setSelectedCountry(null); }}
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        Countries
                                    </button>
                                    <button
                                        className={`travel-view-toggle-btn${viewMode === 'cities' ? ' travel-view-toggle-btn--active' : ''}`}
                                        onClick={() => setViewMode('cities')}
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                        Cities{totalCitiesVisited > 0 ? ` (${totalCitiesVisited})` : ''}
                                    </button>
                                </div>

                                {/* Country list card — sectioned by continent  OR  City drill-down panel */}
                                <aside className="travel-sidebar">
                                    {selectedCountry ? (
                                        /* City drill-down for selected country */
                                        <CountryCityPanel
                                            countryCode={selectedCountry.code}
                                            countryName={selectedCountry.name}
                                            flagUrl={selectedCountry.flagUrl}
                                            cities={cityMapLoaded ? getCitiesForCountry(selectedCountry.code).map((c: any) => ({
                                                id: `${c.lat},${c.lon}`,
                                                city_name: c.name,
                                                country_code: selectedCountry.code,
                                                dot_col: c.dot[0],
                                                dot_row: c.dot[1],
                                                lat: c.lat,
                                                lon: c.lon
                                            })) : []}
                                            visitedCities={citiesByCountry[selectedCountry.code] ?? []}
                                            isAdmin={isAdmin}
                                            onAddCity={(city: any) => addCity(
                                                selectedCountry.code,
                                                city.city_name,
                                                city.lat,
                                                city.lon,
                                                city.dot_col,
                                                city.dot_row
                                            )}
                                             onRemoveCity={(id: string) => removeCity(Number(id))}
                                            onBack={handleCityPanelBack}
                                        />
                                    ) : (
                                        <>
                                            {isAdmin && !selectedCountry && (
                                                <div className="p-3 border-b border-border/30 relative bg-muted/10">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            type="text"
                                                            placeholder="ADD COUNTRY..."
                                                            className="pl-8 h-8 text-[11px] uppercase bg-background"
                                                            value={countrySearch}
                                                            onChange={(e) => {
                                                                setCountrySearch(e.target.value);
                                                                setShowCountryResults(true);
                                                            }}
                                                            onFocus={() => setShowCountryResults(true)}
                                                        />
                                                    </div>

                                                    {showCountryResults && filteredSearchCountries.length > 0 && (
                                                        <div className="absolute top-full left-3 right-3 bg-popover border rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                                                            {filteredSearchCountries.map((country) => (
                                                                <button
                                                                    key={country.code}
                                                                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-accent flex items-center justify-between group"
                                                                    onClick={() => {
                                                                        addCountry(country.code, country.name);
                                                                        setCountrySearch('');
                                                                        setShowCountryResults(false);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2 uppercase">
                                                                        <img 
                                                                            src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} 
                                                                            className="w-4 h-2.5 object-cover rounded-[1px]" 
                                                                            alt=""
                                                                        />
                                                                        {country.name}
                                                                    </span>
                                                                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {continentLoading ? (
                                                <div className="travel-sidebar-empty">
                                                    <span>Loading…</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {allContinentsToShow.map(continent => {
                                                const countries = byContinent[continent];
                                                const total = continentTotals[continent] ?? '?';
                                                const pct = typeof total === 'number'
                                                    ? Math.round((countries.length / total) * 100)
                                                    : 0;
                                                return (
                                                    <div key={continent} className="travel-continent-section">
                                                        <div className="travel-continent-header">
                                                            <span className="travel-continent-name"><DotMatrixText text={continent.toUpperCase()} size="xs" /></span>
                                                            <span className="travel-continent-stats">
                                                                {countries.length}/{total} · {pct}%
                                                            </span>
                                                        </div>
                                                        <ul className="travel-country-list">
                                                            {countries.map((country) => {
                                                                const flag = country.flag_url || `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`;
                                                                const isHighlighted = hovered?.code === country.country_code;
                                                                const cityCount = citiesByCountry[country.country_code]?.length ?? 0;
                                                                return (
                                                                    <li
                                                                        key={country.country_code}
                                                                        className={`travel-country-row${isHighlighted ? ' travel-country-row--active' : ''}`}
                                                                        onClick={() => handleCountryClick(country.country_code, country.country_name)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        <div className="travel-flag">
                                                                            <img src={flag} alt={`${country.country_name} flag`} className="travel-flag-img"
                                                                                onError={(e) => { (e.target as HTMLImageElement).src = `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`; }}
                                                                            />
                                                                        </div>
                                                                        <span className="travel-country-name">{country.country_name}</span>
                                                                        {cityCount > 0 && (
                                                                            <span style={{
                                                                                fontSize: '0.65rem',
                                                                                color: 'hsl(var(--muted-foreground))',
                                                                                fontFamily: 'var(--font-sans)',
                                                                                flexShrink: 0,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '3px',
                                                                            }}>
                                                                                <MapPin className="w-2.5 h-2.5" />
                                                                                {cityCount}
                                                                            </span>
                                                                        )}
                                                                        {isAdmin && (
                                                                            <button
                                                                                className="travel-remove-btn"
                                                                                onClick={(e) => { e.stopPropagation(); removeCountry(country.country_code); }}
                                                                                title={`Remove ${country.country_name}`}
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                );
                                            })}

                                            {/* Territories section — shown but never counted in stats */}
                                            {territoriesSorted.length > 0 && (
                                                <div className="travel-continent-section travel-territories-section">
                                                    <div className="travel-continent-header">
                                                        <span className="travel-continent-name travel-territories-label"><DotMatrixText text="TERRITORIES AND DEPENDENCIES" size="xs" /></span>
                                                        <span className="travel-continent-stats">{territoriesSorted.length} visited</span>
                                                    </div>
                                                    <ul className="travel-country-list">
                                                        {territoriesSorted.map((country) => {
                                                            const flag = country.flag_url || `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`;
                                                            const isHighlighted = hovered?.code === country.country_code;
                                                            const cityCount = citiesByCountry[country.country_code]?.length ?? 0;
                                                            return (
                                                                <li
                                                                    key={country.country_code}
                                                                    className={`travel-country-row${isHighlighted ? ' travel-country-row--active' : ''}`}
                                                                    onClick={() => handleCountryClick(country.country_code, country.country_name)}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <div className="travel-flag">
                                                                        <img src={flag} alt={`${country.country_name} flag`} className="travel-flag-img"
                                                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`; }}
                                                                        />
                                                                    </div>
                                                                    <span className="travel-country-name">{country.country_name}</span>
                                                                    {cityCount > 0 && (
                                                                        <span style={{
                                                                            fontSize: '0.65rem',
                                                                            color: 'hsl(var(--muted-foreground))',
                                                                            fontFamily: 'var(--font-sans)',
                                                                            flexShrink: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                        }}>
                                                                            <MapPin className="w-2.5 h-2.5" />
                                                                            {cityCount}
                                                                        </span>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <button
                                                                            className="travel-remove-btn"
                                                                            onClick={(e) => { e.stopPropagation(); removeCountry(country.country_code); }}
                                                                            title={`Remove ${country.country_name}`}
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </li>
                                                            );
                                                       })}
                                                    </ul>
                                                </div>
                                            )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </aside>
                            </div>

                            {/* RIGHT — centred tooltip above map */}
                            <div className="travel-map-col">

                                {/* Dot-matrix tooltip */}
                                <div className="travel-dot-tooltip">
                                    <DotMatrixText
                                        text={tooltipText}
                                        size="sm"
                                        className={hovered
                                            ? (visitedCodes.includes(hovered.code) ? 'text-amber-500' : 'text-muted-foreground')
                                            : 'text-muted-foreground'
                                        }
                                    />
                                    {hovered && (
                                        <img
                                            src={hovered.flagUrl}
                                            alt={hovered.name}
                                            className="travel-tooltip-flag"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    )}
                                </div>

                                {/* Map */}
                                <DotMatrixGlobe
                                    visitedCountryCodes={visitedCodes}
                                    visitedCityDots={viewMode === 'cities' ? visitedDotKeys : undefined}
                                    viewMode={viewMode}
                                    focusedCountryCode={selectedCountry?.code}
                                    focusTrigger={focusTrigger}
                                    onCountryHover={handleCountryHover}
                                    onCountryClick={onGlobeCountryClick}
                                />

                            </div>

                        </div>
                    </div>

                </main>

                <Footer />
            </div>
        </div>
    );
};

export default Travel;
