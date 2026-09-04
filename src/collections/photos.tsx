import { MapPin, Image as ImageIcon } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { uploadPhoto } from '@/lib/storage';
import type { CollectionConfig, CollectionRow } from './types';

export interface PhotoRow extends CollectionRow {
  image_url: string;
  caption: string | null;
  location: string | null;
  created_at: string;
}

/**
 * The only collection whose add flow uploads a file rather than taking a URL,
 * hence the `file` field type and `uploadFile`. The image goes to the `photos`
 * storage bucket and the returned public URL is what lands in the column.
 *
 * No facets and no search: the table has no category column. FilterBar renders
 * nothing rather than an empty bordered strip.
 */
export const photosCollection: CollectionConfig<PhotoRow> = {
  table: 'photos',
  path: '/photos',
  title: 'Photos',
  subtitle: "Moments I've captured",
  noun: { singular: 'Photo', plural: 'Photos' },

  facets: [],

  card: {
    variant: 'square',
    fallbackIcon: ImageIcon,
    title: (photo) => photo.caption ?? 'Untitled',
    subtitle: (photo) => photo.location ?? undefined,
    image: (photo) => photo.image_url,
  },

  fields: [
    {
      name: 'image_url',
      label: 'Image',
      type: 'file',
      required: true,
      accept: 'image/jpeg,image/png,image/webp,image/gif,image/heic',
      maxBytes: 50 * 1024 * 1024,
      placeholder: 'JPEG, PNG, WebP, GIF or HEIC up to 50MB',
    },
    {
      name: 'caption',
      label: 'Caption',
      type: 'text',
      placeholder: 'Describe this moment...',
    },
    {
      name: 'location',
      label: 'Location',
      type: 'text',
      placeholder: 'Where was this taken?',
    },
  ],

  uploadFile: uploadPhoto,

  renderDetail: (photo) =>
    photo.location ? (
      <DetailSection label="Location">
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {photo.location}
        </p>
      </DetailSection>
    ) : null,
};
