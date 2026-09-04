import { MapPin, Image as ImageIcon } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { uploadPhoto } from '@/lib/storage';
import type { CollectionConfig, CollectionRow } from './types';

export interface PhotoRow extends CollectionRow {
  image_url: string;
  caption: string | null;
  location: string | null;
  photographer: string | null;
  description: string | null;
  created_at: string;
}

/**
 * The card carries the three things you can see from the wall -- the photo,
 * where it was taken and who took it -- and the dialog adds the description,
 * which is the one thing worth reading rather than glancing at.
 *
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
    variant: 'media',
    // Square crop suits a mixed photo set.
    aspect: '1 / 1',
    fallbackIcon: ImageIcon,
    // The photograph is the content here, so the dialog shows it large and
    // offers it as a download rather than treating it as a cover image.
    imageIsContent: true,
    title: (photo) => photo.caption ?? 'Untitled',
    subtitle: (photo) => photo.location ?? undefined,
    excerpt: (photo) => (photo.photographer ? `by ${photo.photographer}` : undefined),
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
    {
      name: 'photographer',
      label: 'Photographer',
      type: 'text',
      placeholder: 'Leave blank if you took it',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 4,
      placeholder: 'What was happening, why it was worth taking...',
    },
  ],

  uploadFile: uploadPhoto,

  renderDetail: (photo) => (
    <>
      {photo.description && (
        <DetailSection label="About">
          <p className="whitespace-pre-wrap leading-relaxed">{photo.description}</p>
        </DetailSection>
      )}
      {photo.location && (
        <DetailSection label="Location">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {photo.location}
          </p>
        </DetailSection>
      )}
      {photo.photographer && (
        <DetailSection label="Photographer">{photo.photographer}</DetailSection>
      )}
    </>
  ),
};
