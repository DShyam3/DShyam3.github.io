import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { DotMatrixGlobe } from '@/components/DotMatrixGlobe';
import { GlobeAdminPanel } from '@/components/GlobeAdminPanel';
import { CountryCityPanel } from '@/components/CountryCityPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitedCountries } from '@/hooks/useVisitedCountries';
import { useVisitedCities } from '@/hooks/useVisitedCities';
import { useCityMap } from '@/hooks/useCityMap';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { CONTINENT_ORDER } from '@/data/continents';
import { useContinentMap } from '@/hooks/useContinentMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { Globe, MapPin } from 'lucide-react';
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

    const [hovered, setHovered] = useState<{ code: string; name: string; flagUrl: string } | null>(null);

    const handleCountryHover = useCallback((
        code: string | null,
        name: string | null,
        flagUrl: string | null
    ) => {
        setHovered(code && name && flagUrl ? { code, name, flagUrl } : null);
    }, []);

    const tooltipText = hovered
        ? (visitedCodes.includes(hovered.code)
            ? `${hovered.name.toUpperCase()} - VISITED`
            : hovered.name.toUpperCase())
        : 'HOVER TO EXPLORE';

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
    }, []);

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
                                            cities={cityMapLoaded ? getCitiesForCountry(selectedCountry.code) : []}
                                            visitedCities={citiesByCountry[selectedCountry.code] ?? []}
                                            isAdmin={isAdmin}
                                            onAddCity={addCity}
                                            onRemoveCity={removeCity}
                                            onBack={handleCityPanelBack}
                                        />
                                    ) : visitedCountries.length === 0 ? (
                                        <div className="travel-sidebar-empty">
                                            <span>No countries added yet</span>
                                        </div>
                                    ) : continentLoading ? (
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
                                                                                aria-label={`Remove ${country.country_name}`}
                                                                            >×</button>
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
                                                                            aria-label={`Remove ${country.country_name}`}
                                                                        >×</button>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
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
                                    onCountryHover={handleCountryHover}
                                />

                                {/* Admin panel */}
                                {isAdmin && (
                                    <div className="mt-4 animate-in fade-in duration-500">
                                        <GlobeAdminPanel
                                            visitedCodes={visitedCodes}
                                            onAddCountry={addCountry}
                                            onRemoveCountry={removeCountry}
                                        />
                                    </div>
                                )}
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
