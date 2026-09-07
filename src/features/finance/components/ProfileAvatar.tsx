import { ASSETS_URL } from '@/lib/constants';

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
}: {
  profile: { isSelf: boolean; emoji: string | null; name: string };
}) {
  if (profile.isSelf) {
    return (
      <img
        src={`${ASSETS_URL}/memoji.png`}
        alt=""
        aria-hidden
        className="h-4 w-4 shrink-0 rounded-full bg-secondary object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span aria-hidden className="w-4 shrink-0 text-center leading-none">
      {profile.emoji ?? '•'}
    </span>
  );
}
