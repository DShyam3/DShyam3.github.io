import { FolderGit2 } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { uploadPhoto } from '@/lib/storage';
import type { CollectionConfig, CollectionRow } from './types';

export interface ProjectRow extends CollectionRow {
  title: string;
  status: string;
  summary: string | null;
  url: string | null;
  image: string | null;
  skills: string | null;
  created_at: string;
}

/** Single source of truth for the statuses: filter, form select and card badge. */
const STATUSES = [
  { key: 'done', label: 'Done' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'planned', label: 'Planned' },
];

const labelFor = (key: string) => STATUSES.find((s) => s.key === key)?.label ?? key;

/**
 * Skills are typed as one comma-separated line, because the generated form
 * has no list field. Blank entries and stray spaces are dropped.
 */
const skillList = (skills: string | null): string[] =>
  (skills ?? '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

/** Things built, being built, and planned. */
export const projectsCollection: CollectionConfig<ProjectRow> = {
  table: 'projects',
  path: '/projects',
  title: 'Projects',
  subtitle: 'Built, building and planned',
  noun: { singular: 'Project', plural: 'Projects' },

  searchFields: ['title', 'summary', 'skills'],

  facets: [{ key: 'status', field: 'status', options: STATUSES }],

  card: {
    variant: 'media',
    // Screenshots and photographs of the thing, wider than tall.
    aspect: '16 / 9',
    fallbackIcon: FolderGit2,
    title: (project) => project.title,
    subtitle: (project) => skillList(project.skills).join(' · ') || undefined,
    image: (project) => project.image ?? undefined,
    // The detail dialog's title links out; the card itself opens the detail.
    href: (project) => project.url ?? undefined,
    excerpt: (project) => project.summary ?? undefined,
    badge: (project) => labelFor(project.status),
  },

  uploadFile: uploadPhoto,

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'status', label: 'Status', type: 'select', defaultValue: 'in-progress' },
    {
      name: 'summary',
      label: 'Summary',
      type: 'textarea',
      rows: 4,
      placeholder: 'What it is and what it does',
    },
    { name: 'url', label: 'Link (optional)', type: 'url', placeholder: 'https://' },
    {
      name: 'skills',
      label: 'Skills',
      type: 'text',
      placeholder: 'TypeScript, React, Postgres',
    },
    { name: 'image', label: 'Image', type: 'image' },
  ],

  // Skills are already under the title, as the card's subtitle.
  renderDetail: (project) =>
    project.summary ? (
      <DetailSection label="About">
        <p className="whitespace-pre-wrap">{project.summary}</p>
      </DetailSection>
    ) : null,
};
