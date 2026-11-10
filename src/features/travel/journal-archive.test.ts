import { describe, expect, it } from 'vitest';
import { buildTravelArchive, parseTravelArchive, prepareArchiveRestore } from './journal-archive';
import { EMPTY_JOURNAL, type TravelMemory } from './journal-types';

const owner = '10000000-0000-4000-8000-000000000001';
const path = `${owner}/50000000-0000-4000-8000-000000000001.jpg`;
const photo: TravelMemory = { id: '40000000-0000-4000-8000-000000000001', owner_id: owner, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  country_code: 'PT', city_key: 'PT:38,-9', city_name: 'Lisbon', kind: 'photo', title: 'View', body: '', category: '', link_url: null,
  trip_id: null, visit_id: null, photo_path: path, is_cover: true, is_public: false, sort_order: 0 };
describe('portable travel archive', () => {
  it('round trips metadata and image bytes, remapping only the storage identity', async () => {
    const bytes = new Uint8Array([255, 216, 255, 217]);
    const text = await buildTravelArchive({ ...EMPTY_JOURNAL, memories: [photo] }, async () => bytes);
    const archive = parseTravelArchive(text);
    const newPath = `${owner}/50000000-0000-4000-8000-000000000002.jpg`;
    const restored = await prepareArchiveRestore(archive, owner, async input => { expect(input).toEqual(bytes); return newPath; });
    expect(restored.memories[0]).toEqual({ ...photo, photo_path: newPath });
  });
  it('refuses missing media and metadata-only files', async () => {
    const archive = JSON.parse(await buildTravelArchive({ ...EMPTY_JOURNAL, memories: [photo] }, async () => new Uint8Array([255, 216, 255, 217])));
    archive.photos = {};
    expect(() => parseTravelArchive(JSON.stringify(archive))).toThrow('manifest');
    expect(() => parseTravelArchive(JSON.stringify({ version: 1, ...EMPTY_JOURNAL }))).toThrow('complete');
  });
  it('does not produce a partial export when a photo cannot be downloaded', async () => {
    await expect(buildTravelArchive({ ...EMPTY_JOURNAL, memories: [photo] }, async () => { throw new Error('unavailable'); })).rejects.toThrow('unavailable');
  });
});
