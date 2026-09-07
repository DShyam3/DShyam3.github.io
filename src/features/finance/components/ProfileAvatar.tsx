import { ASSETS_URL } from '@/lib/constants';

/** How large the face renders. The switcher trigger sits alone in the toolbar
 *  and can afford `md`; faces inside a dropdown list stay `sm` so the rows keep
 *  their line height. */
const SIZES = {
  sm: { img: 'h-4 w-4', emoji: 'w-4 text-sm' },
  md: { img: 'h-6 w-6', emoji: 'w-6 text-lg' },
} as const;

/**
 * The face beside a profile's name in the switcher.
 *
 * The operator's own profile gets the site's memoji, the same image the header
 * uses, rather than a generic emoji — it is quicker to recognise than a word,
 * which is the whole job of a switcher you glance at. Everyone else keeps
 * whatever emoji their profile carries.
 */
export function ProfileAvatar({
  profile,
  size = 'sm',
}: {
  profile: { isSelf: boolean; emoji: string | null; name: string };
  size?: keyof typeof SIZES;
}) {
  if (profile.isSelf) {
    return (
      <img
        src={`${ASSETS_URL}/memoji.png`}
        alt=""
        aria-hidden
        className={`${SIZES[size].img} shrink-0 rounded-full bg-secondary object-cover`}
        loading="lazy"
      />
    );
  }
  return (
    <span aria-hidden className={`${SIZES[size].emoji} shrink-0 text-center leading-none`}>
      {profile.emoji ?? '•'}
    </span>
  );
}
