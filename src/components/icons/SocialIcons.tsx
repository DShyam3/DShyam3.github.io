import { useId } from 'react';
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Brand marks drawn inline rather than loaded as remote assets, so they keep
 * their official colours, cost no network round-trip, and need no dark-mode
 * invert filter. LinkedIn and Gmail carry their brand colours; the GitHub mark
 * is monochrome by design, so it follows `currentColor` (black on light,
 * white on dark).
 */

export const LinkedInIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false" fill="#0A66C2" {...props}>
    <title>LinkedIn</title>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const GitHubIcon = ({ className = '', ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
    focusable="false"
    fill="currentColor"
    className={`text-[#181717] dark:text-white ${className}`}
    {...props}
  >
    <title>GitHub</title>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

export const GmailIcon = (props: IconProps) => {
  // Gradient ids have to be unique per instance, or a second Gmail icon on the
  // page would reference the first one's defs.
  const uid = useId();
  const green = `${uid}-green`;
  const warm = `${uid}-warm`;

  return (
    <svg viewBox="0 0 256 204" role="img" aria-hidden="true" focusable="false" {...props}>
      <title>Gmail</title>
      <defs>
        <linearGradient id={green} x1="165" x2="165" y1="44" y2="166" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60d673" />
          <stop offset="0.17" stopColor="#42c868" />
          <stop offset="0.39" stopColor="#0ebc5f" />
          <stop offset="0.62" stopColor="#00a9bb" />
          <stop offset="0.86" stopColor="#3c90ff" />
          <stop offset="1" stopColor="#3186ff" />
        </linearGradient>
        <linearGradient id={warm} x1="8" x2="184" y1="46.13" y2="46.13" gradientUnits="userSpaceOnUse">
          <stop offset="0.08" stopColor="#ff63a0" />
          <stop offset="0.3" stopColor="#fc413d" />
          <stop offset="0.5" stopColor="#fc413d" />
          <stop offset="0.65" stopColor="#fc413d" />
          <stop offset="0.72" stopColor="#fc5c30" />
          <stop offset="0.86" stopColor="#feb10c" />
          <stop offset="0.91" stopColor="#fec700" />
          <stop offset="0.96" stopColor="#ffdb0f" />
        </linearGradient>
      </defs>
      <g transform="matrix(1.454542, 0, 0, 1.454542, -11.636063, -37.817696)">
        <path fill={`url(#${green})`} d="M146 44h38v110c0 6.627-5.373 12-12 12h-20a6 6 0 0 1-6-6z" />
        <path fill="#fc413d" d="M46 44H8v110c0 6.627 5.373 12 12 12h20a6 6 0 0 0 6-6z" />
        <path
          fill={`url(#${warm})`}
          d="M39.226 30.456c-8.033-6.752-20.018-5.714-26.77 2.319-6.752 8.032-5.714 20.017 2.319 26.77l76.078 63.949a8 8 0 0 0 10.295 0l76.078-63.95c8.032-6.752 9.07-18.737 2.318-26.77-6.752-8.032-18.737-9.07-26.769-2.318L96 78.18z"
        />
      </g>
    </svg>
  );
};

export const socialIcons = {
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  mail: GmailIcon,
} as const;

export type SocialIconName = keyof typeof socialIcons;
