// Display order for continents (matches REST Countries API `region` values)
export const CONTINENT_ORDER = [
    'Europe',
    'Asia',
    'Africa',
    'Americas',
    'Oceania',
    'Antarctic',
];

// Friendly label overrides (API uses "Americas" for both North + South)
export const CONTINENT_LABEL: Record<string, string> = {
    Americas: 'Americas',
    Antarctic: 'Antarctic',
};
