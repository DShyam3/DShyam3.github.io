import React, { useState, useMemo } from 'react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { MapPin, ArrowLeft, Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface City {
  id: string;
  city_name: string;
  country_code: string;
  dot_col: number;
  dot_row: number;
}

interface CountryCityPanelProps {
  countryCode: string;
  countryName: string;
  flagUrl: string;
  cities: City[];
  visitedCities: any[];
  isAdmin?: boolean;
  onAddCity: (city: City) => Promise<void>;
  onRemoveCity: (id: string) => Promise<void>;
  onBack: () => void;
}

export const CountryCityPanel: React.FC<CountryCityPanelProps> = ({
  countryCode,
  countryName,
  flagUrl,
  cities,
  visitedCities,
  isAdmin,
  onAddCity,
  onRemoveCity,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return cities
      .filter(c => 
        c.city_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !visitedCities.some(vc => vc.city_name === c.city_name)
      )
      .slice(0, 10);
  }, [searchQuery, cities, visitedCities]);

  return (
    <div className="city-panel h-full flex flex-col">
      <div className="city-panel-header sticky top-0 bg-card z-10 p-3 border-b flex items-center gap-3">
        <button onClick={onBack} className="city-panel-back p-1 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <img src={flagUrl} alt={countryName} className="city-panel-flag w-6 h-4 object-cover rounded-sm shadow-sm" />
        <div className="city-panel-title flex-1 min-w-0">
          <h3 className="city-panel-country-name text-sm font-semibold truncate uppercase tracking-wider">{countryName}</h3>
          <p className="city-panel-city-count text-[10px] text-muted-foreground uppercase">{visitedCities.length} CITIES VISITED</p>
        </div>
      </div>

      {isAdmin && (
        <div className="city-panel-search p-3 border-b relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="SEARCH CITY..."
              className="pl-8 h-8 text-[11px] uppercase bg-muted/30"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
            />
          </div>

          {showResults && filteredCities.length > 0 && (
            <div className="city-panel-results absolute top-full left-3 right-3 bg-popover border rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
              {filteredCities.map((city) => (
                <button
                  key={city.id}
                  className="city-panel-result-item w-full text-left px-3 py-2 text-[11px] hover:bg-accent flex items-center justify-between group"
                  onClick={() => {
                    onAddCity(city);
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                >
                  <span>{city.city_name.toUpperCase()}</span>
                  <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="city-panel-list flex-1 overflow-y-auto p-1">
        {visitedCities.length === 0 ? (
          <div className="city-panel-empty py-12 flex flex-col items-center justify-center text-muted-foreground">
            <MapPin className="w-8 h-8 opacity-20 mb-2" />
            <span className="text-[10px] uppercase italic">NO CITIES ADDED YET</span>
          </div>
        ) : (
          <ul className="city-list space-y-0.5">
            {[...visitedCities].sort((a,b) => a.city_name.localeCompare(b.city_name)).map((city) => (
              <li key={city.id} className="city-list-row group flex items-center gap-3 px-3 py-2 hover:bg-accent/30 rounded-md transition-colors">
                <MapPin className="w-3 h-3 text-amber-500/70" />
                <span className="city-list-name text-[11px] font-medium flex-1 uppercase tracking-tight">{city.city_name}</span>
                {isAdmin && (
                  <button
                    onClick={() => onRemoveCity(city.id)}
                    className="city-remove-btn opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
