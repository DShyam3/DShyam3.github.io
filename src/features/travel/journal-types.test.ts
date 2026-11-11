import { describe, expect, it } from 'vitest';
import { cityIdentity, cityKeyPoint } from './journal-types';

describe('cityKeyPoint', () => {
  it('reads back the coordinates a city key was built from, to the key\'s precision', () => {
    const { city_key } = cityIdentity({ country_code: 'AA', city_name: 'Somewhere', lat: 12.345678, lon: -45.6 });
    expect(cityKeyPoint(city_key)).toEqual({ lat: 12.3457, lon: -45.6 });
  });

  it('refuses keys that are not in that shape or name no point on Earth', () => {
    expect(cityKeyPoint('')).toBeNull();
    expect(cityKeyPoint('AA:north,south')).toBeNull();
    expect(cityKeyPoint('AA:10')).toBeNull();
    expect(cityKeyPoint('10.0000,20.0000')).toBeNull();
    expect(cityKeyPoint('AA:91.0000,0.0000')).toBeNull();
    expect(cityKeyPoint('AA:0.0000,180.5000')).toBeNull();
  });
});
