import { AppShell } from '@/components/layout/AppShell';
import { buildMemberships, countMembers, assertTotals } from '@/features/travel/memberships';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixGlobe } from '@/components/dot-matrix/DotMatrixGlobe';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitedCountries } from '@/features/travel/useVisitedCountries';
import { useVisitedCities } from '@/features/travel/useVisitedCities';
import { useCityMap } from '@/features/travel/useCityMap';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CONTINENT_ORDER } from '@/features/travel/continents';
import { useContinentMap } from '@/features/travel/useContinentMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { Globe, MapPin, Search, X, Loader2, ChevronDown } from 'lucide-react';
import { CountryCityPanel, type City } from '@/features/travel/CountryCityPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useTravelJournal } from './useTravelJournal';
import { TravelJournalPanel } from './TravelJournalPanel';
import { TravelJournalWorkspace } from './TravelJournalWorkspace';
import { TravelImportDialog } from './TravelImportDialog';
import { TravelBackupDialog } from './TravelBackupDialog';
import { TravelItineraryDetail } from './TravelItineraryDetail';
import { countryFlightRows, countryFlightSummary, useAirportCountries } from './journal-flights';
import { cityIdentity, cityKeyPoint, type CityIdentity, type TravelItinerary } from './journal-types';
import '@/pages/Index.css';

/** The slice of restcountries.com's shape that `public/countries.json` is read for. */
interface RestCountry {
    cca2: string;
    name: { common: string };
}

type ViewMode = 'countries' | 'cities';

const TravelContent = () => {
    const isMobile = useIsMobile();
    const { isAdmin } = useAuth();
    const { target, selectTarget, resetTarget, setDockedDetail } = useWorkspaceInspector();
    const journal = useTravelJournal();
    const [section, setSection] = useState<'places' | 'trips'>('places');
    const [selectedCity, setSelectedCity] = useState<CityIdentity | null>(null);
    // The inspector shows one journal record at a time: a city or an itinerary item.
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const selectedItem = selectedItemId ? journal.data.itinerary.find(item => item.id === selectedItemId) : undefined;
    // Bumped on every pick, so choosing the same country or city again turns back to it after a drag.
    const [focusTrigger, setFocusTrigger] = useState(0);
    const selectCity = useCallback((city: CityIdentity) => { setSelectedItemId(null); setSelectedCity(city); setFocusTrigger(prev => prev + 1); }, []);
    const selectItem = useCallback((item: TravelItinerary) => { setSelectedCity(null); setSelectedItemId(item.id); }, []);
    const [importOpen, setImportOpen] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const [countryError, setCountryError] = useState('');
    const { visitedCountries, addCountry, removeCountry } = useVisitedCountries();
    const { askDelete, deleteDialog } = useDeleteConfirm();
    // Removing a country takes its cities with it, so it asks first.
    const confirmRemoveCountry = useCallback(
        (code: string, name: string) =>
            askDelete({
                name,
                title: `Remove ${name}`,
                confirmLabel: 'Remove',
                description: `Remove ${name} from your visited countries? Any cities saved under it go too.`,
                onConfirm: async () => { await removeCountry(code); },
            }),
        [askDelete, removeCountry],
    );
    const visitedCodes = visitedCountries.map(c => c.country_code);
    const { byCode: continentByCode, totals: continentTotals, sovereignCodes, loading: continentLoading } = useContinentMap();

    // City tracking
    const { visitedCities, citiesByCountry, visitedDotKeys, addCity, removeCity } = useVisitedCities();
    const { loaded: cityMapLoaded, loading: cityMapLoading, loadCityMap, getCitiesForCountry } = useCityMap();
    // The globe turns to the city whose journal is open and marks its dot. A
    // journal-only city has no stored dot, so its key's coordinates stand in.
    const focusedCity = useMemo(() => {
        if (!selectedCity) return null;
        const visited = visitedCities.find(city => cityIdentity(city).city_key === selectedCity.city_key);
        if (visited) return { lat: visited.lat, lon: visited.lon, countryCode: visited.country_code, dotKey: `${visited.dot_col},${visited.dot_row}` };
        const point = cityKeyPoint(selectedCity.city_key);
        return point && { ...point, countryCode: selectedCity.country_code };
    }, [selectedCity, visitedCities]);

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
        if (allCountries.length === 0) {
            const fetchAll = async () => {
                try {
                    const res = await fetch('/countries.json');
                    if (!res.ok) return;
                    const data: RestCountry[] = await res.json();
                    setAllCountries(data.map((c) => ({
                        code: c.cca2,
                        name: c.name.common
                    })).sort((a, b) => a.name.localeCompare(b.name)));
                } catch (e) {
                    console.error('[Travel] Failed to fetch countries list:', e);
                }
            };
            fetchAll();
        }
    }, [allCountries.length]);

    const filteredSearchCountries = useMemo(() => {
        if (!countrySearch.trim()) return [];
        const searchLower = countrySearch.trim().toLowerCase();
        return allCountries.filter(c => 
            c.name.toLowerCase().includes(searchLower) || c.code.toLowerCase().includes(searchLower)
        ).sort((a, b) => Number(b.name.toLowerCase() === searchLower || b.code.toLowerCase() === searchLower) - Number(a.name.toLowerCase() === searchLower || a.code.toLowerCase() === searchLower) || a.name.localeCompare(b.name));
    }, [countrySearch, allCountries]);


    // Cyprus, Luxembourg and other small places have no dots on the map grid,
    // so the globe turns to the largest city instead, once the city map is in.
    const focusedCountryPoint = useMemo(() => {
        if (!selectedCountry) return null;
        const cities = getCitiesForCountry(selectedCountry.code);
        const largest = cities.reduce<(typeof cities)[number] | null>((best, city) => !best || city.pop > best.pop ? city : best, null);
        return largest && { lat: largest.lat, lon: largest.lon };
    }, [selectedCountry, getCitiesForCountry]);

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

    // The airport table is wanted only where a flight's airports or a country's flights are shown.
    const airports = useAirportCountries(Boolean(selectedCountry || selectedItem?.kind === 'flight') && journal.data.itinerary.some(item => item.kind === 'flight'));

    // What the inspector holds, read by the effect below without re-running it on every selection.
    const inspectorTargetId = useRef<string | null>(null);
    useEffect(() => { inspectorTargetId.current = target?.id ?? null; }, [target]);
    // The country this page last put in the inspector. A data refresh updates it in place,
    // but never reopens a column the visitor has closed.
    const shownCountry = useRef<string | null>(null);

    // Sync selected country into the 3rd-column WorkspaceInspector. Places only:
    // the country belongs to the map, and Trips has its own selections.
    useEffect(() => {
        if (selectedCity || selectedItem) { shownCountry.current = null; return; }
        if (section !== 'places' || !selectedCountry) {
            shownCountry.current = null;
            resetTarget();
            return;
        }
        const id = `travel-country-${selectedCountry.code}`;
        if (shownCountry.current === selectedCountry.code && inspectorTargetId.current !== id) return;
        shownCountry.current = selectedCountry.code;
        const citiesForCountry = visitedCities.filter(
            (c) => c.country_code === selectedCountry.code,
        );
        const continent = continentByCode[selectedCountry.code];
        const unMember = sovereignCodes.has(selectedCountry.code);
        // Read from airport codes, so it waits on the airport table and covers flights only.
        const flightRows = airports ? countryFlightRows(countryFlightSummary(journal.data.itinerary, selectedCountry.code, airports)) : [];

        selectTarget({
            id,
            eyebrow: 'Selected Country',
            title: selectedCountry.name,
            summary:
                citiesForCountry.length > 0
                    ? `Logged cities: ${citiesForCountry.map((c) => c.city_name).join(', ')}`
                    : 'No individual cities logged yet for this country.',
            rows: [
                { label: 'ISO Code', value: selectedCountry.code, tone: 'accent' },
                ...(continent ? [{ label: 'Continent', value: continent }] : []),
                {
                    label: 'Status',
                    value: unMember ? 'UN Member State' : 'Territory / Dependency',
                    tone: 'sky',
                },
                {
                    label: 'Cities logged',
                    value: `${citiesForCountry.length} cities`,
                    tone: 'amber',
                },
                ...flightRows,
            ],
        });
    }, [
        section,
        selectedCountry,
        selectedCity,
        selectedItem,
        airports,
        journal.data.itinerary,
        visitedCities,
        visitedCountries,
        continentByCode,
        sovereignCodes,
        selectTarget,
        resetTarget,
    ]);

    // Split: sovereign UN states vs territories/dependencies
    const sovereignVisited = visitedCountries.filter(c => sovereignCodes.size === 0 || sovereignCodes.has(c.country_code));
    const territoryVisited = visitedCountries.filter(c => sovereignCodes.size > 0 && !sovereignCodes.has(c.country_code));

    // Sovereign count drives all the stats
    const totalCountries = Object.values(continentTotals).reduce((a, b) => a + b, 0) || 195;
    // The headline counts everything visitable -- every country and territory
    // in the dataset -- with UN membership shown per row instead.
    const totalPlaces = Object.keys(continentByCode).length || 250;

    // Counts against the bodies that publish a membership list. See
    // memberships.ts -- FIFA and the IOC do not count countries the way ISO
    // does, and the differences are documented there rather than guessed at.
    const [showStats, setShowStats] = useState(false);
    const memberships = useMemo(() => buildMemberships(sovereignCodes), [sovereignCodes]);
    const membershipStats = useMemo(
        () =>
            memberships.map((body) => ({
                body,
                visited: countMembers(body, visitedCodes, citiesByCountry),
            })),
        [memberships, visitedCodes, citiesByCountry],
    );

    // A wrong list would produce a confident but false percentage, so say so.
    useEffect(() => {
        if (sovereignCodes.size === 0) return;
        const problems = assertTotals(memberships);
        if (problems.length) console.error('[Travel] membership totals:', problems);
    }, [memberships, sovereignCodes.size]);
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
        if (!hovered) return selectedCountry ? `${selectedCountry.name.toUpperCase()} · SELECTED` : isMobile ? 'TAP TO EXPLORE' : 'HOVER TO EXPLORE';
        if (viewMode === 'cities' && hoveredCities.length > 0) {
            return hoveredCities.map(c => c.city_name).join(', ').toUpperCase();
        }
        return visitedCodes.includes(hovered.code)
            ? `${hovered.name.toUpperCase()} - VISITED`
            : hovered.name.toUpperCase();
    }, [hovered, viewMode, hoveredCities, visitedCodes, isMobile, selectedCountry]);

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

    /**
     * Adding a city implies having been to the country -- you cannot have
     * visited Lisbon without visiting Portugal -- so the country is recorded
     * too if it is not already.
     */
    const handleAddCity = useCallback(
        async (city: City): Promise<void> => {
            if (!selectedCountry) return;
            if (!visitedCodes.includes(selectedCountry.code)) {
                await addCountry(selectedCountry.code, selectedCountry.name);
            }
            await addCity(
                selectedCountry.code,
                city.city_name,
                city.lat,
                city.lon,
                city.dot_col,
                city.dot_row,
            );
        },
        [selectedCountry, visitedCodes, addCountry, addCity],
    );

    /**
     * Adding a country almost always means there is a city to add with it, so
     * this drops straight into that country's city list rather than leaving
     * the row sitting there with no detail.
     */
    const handleAddCountry = useCallback(async (country: { code: string; name: string }) => {
        setCountryError('');
        if (!visitedCodes.includes(country.code) && !await addCountry(country.code, country.name)) {
            setCountryError('Could not mark this country visited. Please try again.');
        }
    }, [addCountry, visitedCodes]);

    // Handle clicking a country row to drill into cities
    const handleCountryClick = useCallback((code: string, name: string) => {
        const flagUrl = `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
        setSelectedCity(null);
        setSelectedItemId(null);
        setDockedDetail(null);
        setCountrySearch('');
        setShowCountryResults(false);
        setSelectedCountry({ code, name, flagUrl });
        setFocusTrigger(prev => prev + 1);
        // Choosing a country, even the same one again, always opens its details.
        shownCountry.current = null;
    }, [setDockedDetail]);

    const onGlobeCountryClick = useCallback((code: string, name: string) => {
        handleCountryClick(code, name);
    }, [handleCountryClick]);

    const handleCityPanelBack = useCallback(() => {
        const code = selectedCountry?.code;
        setSelectedCity(null);
        setSelectedItemId(null);
        setDockedDetail(null);
        setSelectedCountry(null);
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-country="${code}"]`)?.focus());
    }, [selectedCountry, setDockedDetail]);

    const journalCities = useMemo(() => [...new Map([
        ...visitedCities.map(cityIdentity), ...journal.data.visits, ...journal.data.memories,
    ].map(city => [city.city_key, { city_key: city.city_key, city_name: city.city_name, country_code: city.country_code }])).values()], [visitedCities, journal.data.visits, journal.data.memories]);

    useEffect(() => {
        if (!selectedCity) return;
        setDockedDetail({
            id: `travel-city-${selectedCity.city_key}`,
            eyebrow: 'City journal', title: selectedCity.city_name,
            onClose: () => setSelectedCity(null),
            node: <TravelJournalPanel key={selectedCity.city_key} city={selectedCity} journal={journal} isAdmin={isAdmin} legacyVisited={visitedCities.some(c => cityIdentity(c).city_key === selectedCity.city_key)} />,
        });
    }, [selectedCity, journal, isAdmin, visitedCities, setDockedDetail]);
    useEffect(() => {
        if (!selectedItemId) return;
        // Removed elsewhere, e.g. in another tab: nothing is left to show, and a
        // restore that brings the same id back must not reopen it unasked.
        if (!selectedItem) { if (!journal.loading) { setSelectedItemId(null); setDockedDetail(null); } return; }
        setDockedDetail({
            id: `travel-item-${selectedItem.id}`,
            eyebrow: ({ flight: 'Flight', train: 'Train', stay: 'Stay', activity: 'Activity' } as const)[selectedItem.kind], title: selectedItem.title,
            onClose: () => setSelectedItemId(null),
            node: <TravelItineraryDetail key={selectedItem.id} item={selectedItem} journal={journal} isAdmin={isAdmin} airports={airports} onDeleted={() => {
                setSelectedItemId(null);
                setDockedDetail(null);
                // The row and its detail are gone, so focus would fall to the page body.
                requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-travel-heading]')?.focus());
            }} />,
        });
    }, [selectedItemId, selectedItem, journal, isAdmin, airports, setDockedDetail]);
    useEffect(() => () => setDockedDetail(null), [setDockedDetail]);

    // Total visited cities count
    const totalCitiesVisited = visitedCities.length;

    return (
        <AppShell title="Travel" subtitle="Where I've been" layout={section === 'places' ? 'workspace' : 'content'}>
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 flex flex-col px-4 md:px-0 py-4">

                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                        <div className="flex gap-1" aria-label="Travel view">
                            <Button variant={section === 'places' ? 'secondary' : 'ghost'} aria-pressed={section === 'places'} onClick={() => setSection('places')}>Places</Button>
                            <Button variant={section === 'trips' ? 'secondary' : 'ghost'} aria-pressed={section === 'trips'} onClick={() => setSection('trips')}>Trips & memories</Button>
                        </div>
                        {isAdmin && <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={journal.loading || !!journal.error} onClick={() => setImportOpen(true)}>Import itinerary</Button>
                            <Button size="sm" variant="ghost" disabled={journal.loading || !!journal.error} onClick={() => setBackupOpen(true)}>Backup & restore</Button>
                        </div>}
                    </div>
                    {section === 'trips' ? <TravelJournalWorkspace journal={journal} isAdmin={isAdmin} cities={journalCities} onSelectCity={selectCity} selectedItemId={selectedItem ? selectedItem.id : null} onSelectItem={selectItem} /> : <>
                    {/* WHERE I'VE BEEN */}
                    <div className="w-full flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
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
                                        text={`${visitedCountries.length}/${totalPlaces}  ${Math.round((visitedCountries.length / totalPlaces) * 100)}%`}
                                        size={isMobile ? "xs" : "sm"}
                                        wrap={false}
                                        className="text-muted-foreground whitespace-nowrap"
                                    />
                                    <button
                                        onClick={() => setShowStats((v) => !v)}
                                        className="ml-1 text-muted-foreground/70 hover:text-foreground transition-colors"
                                        aria-expanded={showStats}
                                        aria-label="Membership breakdown"
                                    >
                                        <ChevronDown
                                            className={`h-3.5 w-3.5 transition-transform ${showStats ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>

                                {showStats && (
                                    <div className="rounded-lg border border-border bg-card/60 px-3 py-2 space-y-1.5">
                                        {/* Say where the headline denominator comes from, since
                                            250 is not a number anyone recognises on sight. */}
                                        <div className="flex items-baseline justify-between gap-3 pb-1.5 border-b border-border/50">
                                            <span
                                                className="text-xs text-muted-foreground"
                                                title="Every country and territory with an ISO 3166-1 alpha-2 code, including dependencies like Gibraltar and Hong Kong."
                                            >
                                                ISO 3166-1
                                            </span>
                                            <span className="text-xs tabular-nums">
                                                {visitedCountries.length}/{totalPlaces}
                                                <span className="text-muted-foreground/60 ml-1.5">
                                                    {Math.round((visitedCountries.length / totalPlaces) * 100)}%
                                                </span>
                                            </span>
                                        </div>
                                        {membershipStats.map(({ body, visited }) => (
                                            <div key={body.key} className="flex items-baseline justify-between gap-3">
                                                <span className="text-xs text-muted-foreground" title={body.note}>
                                                    {body.label}
                                                </span>
                                                <span className="text-xs tabular-nums">
                                                    {visited}/{body.total}
                                                    <span className="text-muted-foreground/60 ml-1.5">
                                                        {Math.round((visited / body.total) * 100)}%
                                                    </span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

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
                                            cities={cityMapLoaded ? getCitiesForCountry(selectedCountry.code).map((c) => ({
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
                                            onAddCity={(city) => handleAddCity(city)}
                                            onRemoveCity={async (id: string) => { await removeCity(Number(id)); }}
                                            onBack={handleCityPanelBack}
                                            onSelectCity={(city) => selectCity(cityIdentity(city))}
                                            journalCities={journalCities.filter(city => city.country_code === selectedCountry.code)}
                                            onSelectJournalCity={selectCity}
                                            countryVisited={visitedCodes.includes(selectedCountry.code)}
                                            onMarkCountryVisited={() => { void handleAddCountry(selectedCountry); }}
                                            countryError={countryError}
                                        />
                                    ) : (
                                        <>
                                            {!selectedCountry && (
                                                <div className="p-3 border-b border-border/30 relative bg-muted/10">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            type="text"
                                                            placeholder="SEARCH COUNTRIES..."
                                                            aria-label="Search countries"
                                                            className="pl-8 h-8 text-xs uppercase bg-background"
                                                            value={countrySearch}
                                                            onChange={(e) => {
                                                                setCountrySearch(e.target.value);
                                                                setShowCountryResults(true);
                                                            }}
                                                            onFocus={() => setShowCountryResults(true)}
                                                        />
                                                    </div>

                                                    {showCountryResults && countrySearch.trim() && filteredSearchCountries.length === 0 && <p role="status" className="p-2 text-xs text-muted-foreground">No matching countries. Your visited map is unchanged.</p>}
                                                    {showCountryResults && filteredSearchCountries.length > 0 && (
                                                        <div className="absolute top-full left-3 right-3 bg-popover border rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                                                            {filteredSearchCountries.map((country) => (
                                                                <button
                                                                    key={country.code}
                                                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2 ${visitedCodes.includes(country.code) ? 'bg-muted/50 text-muted-foreground' : ''}`}
                                                                    onClick={() => handleCountryClick(country.code, country.name)}
                                                                >
                                                                    <span className="flex items-center gap-2 uppercase">
                                                                        <img 
                                                                            src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} 
                                                                            className="w-4 h-2.5 object-cover rounded-[1px]" 
                                                                            alt=""
                                                                        />
                                                                        {country.name}
                                                                        {/* The list is every country and territory -- the ones
                                                                            that count toward the x/195 stat are marked. */}
                                                                        {sovereignCodes.has(country.code) ? (
                                                                            <span className="text-xs px-1 py-px rounded bg-secondary text-muted-foreground normal-case">
                                                                                UN
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground/50 normal-case">
                                                                                territory
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className="shrink-0">{visitedCodes.includes(country.code) ? '✓ Visited' : 'Not visited'}</span>
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
                                                                const isHighlighted = (selectedCountry?.code || hovered?.code) === country.country_code;
                                                                const cityCount = citiesByCountry[country.country_code]?.length ?? 0;
                                                                return (
                                                                    <li
                                                                        key={country.country_code}
                                                                        className={`travel-country-row${isHighlighted ? ' travel-country-row--active' : ''}`}
                                                                        data-country={country.country_code}
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        aria-label={`Explore ${country.country_name}`}
                                                                        onKeyDown={(event) => {
                                                                            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleCountryClick(country.country_code, country.country_name); }
                                                                        }}
                                                                        onClick={() => handleCountryClick(country.country_code, country.country_name)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        <div className="travel-flag">
                                                                            <img src={flag} alt={`${country.country_name} flag`} className="travel-flag-img"
                                                                                onError={(e) => { (e.target as HTMLImageElement).src = `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`; }}
                                                                            />
                                                                        </div>
                                                                        <span className="travel-country-name">{country.country_name}</span>
                                                                        {/* Fixed-width columns, always rendered, so the UN marker
                                                                            and the city count line up whether or not either is set. */}
                                                                        <span className="travel-un-col">
                                                                            {sovereignCodes.has(country.country_code) && (
                                                                                <span className="travel-un-badge" title="UN member or observer state">UN</span>
                                                                            )}
                                                                        </span>
                                                                        <span className="travel-city-col">
                                                                            {cityCount > 0 && (
                                                                                <>
                                                                                    <MapPin className="w-2.5 h-2.5" />
                                                                                    {cityCount}
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                        {isAdmin && (
                                                                            <button
                                                                                className="travel-remove-btn"
                                                                                onClick={(e) => { e.stopPropagation(); confirmRemoveCountry(country.country_code, country.country_name); }}
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
                                                            const isHighlighted = (selectedCountry?.code || hovered?.code) === country.country_code;
                                                            const cityCount = citiesByCountry[country.country_code]?.length ?? 0;
                                                            return (
                                                                <li
                                                                    key={country.country_code}
                                                                    className={`travel-country-row${isHighlighted ? ' travel-country-row--active' : ''}`}
                                                                    data-country={country.country_code}
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        aria-label={`Explore ${country.country_name}`}
                                                                        onKeyDown={(event) => {
                                                                            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleCountryClick(country.country_code, country.country_name); }
                                                                        }}
                                                                        onClick={() => handleCountryClick(country.country_code, country.country_name)}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <div className="travel-flag">
                                                                        <img src={flag} alt={`${country.country_name} flag`} className="travel-flag-img"
                                                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://flagcdn.com/w80/${country.country_code.toLowerCase()}.png`; }}
                                                                        />
                                                                    </div>
                                                                    <span className="travel-country-name">{country.country_name}</span>
                                                                    <span className="travel-un-col" />
                                                                    <span className="travel-city-col">
                                                                        {cityCount > 0 && (
                                                                            <>
                                                                                <MapPin className="w-2.5 h-2.5" />
                                                                                {cityCount}
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    {isAdmin && (
                                                                        <button
                                                                            className="travel-remove-btn"
                                                                            onClick={(e) => { e.stopPropagation(); confirmRemoveCountry(country.country_code, country.country_name); }}
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
                                    focusedCity={focusedCity}
                                    focusedCountryPoint={focusedCountryPoint}
                                    onCountryHover={handleCountryHover}
                                    onCountryClick={onGlobeCountryClick}
                                />

                            </div>

                        </div>
                    </div>
                    </>}
                </div>
            </div>
            <TravelImportDialog open={importOpen} onOpenChange={setImportOpen} existing={journal.data.itinerary} trips={journal.data.trips} onImport={journal.importItinerary} />
            <TravelBackupDialog open={backupOpen} onOpenChange={setBackupOpen} journal={journal} />
            {deleteDialog}
        </AppShell>
    );
};

export default function Travel() {
    const { session, isAdmin } = useAuth();
    return <TravelContent key={`${session?.user.id ?? 'public'}-${isAdmin}`} />;
}
