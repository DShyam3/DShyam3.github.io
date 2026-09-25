/**
 * The site owner's identity, in one place so a fork edits one file.
 *
 * Everything here used to be literals scattered across the header, footer,
 * opening sequence, home page, privacy dialog, `index.html` and the build
 * config. `site.json` holds the values; this module just types them.
 */
import siteData from './site.json';
import type { SocialIconName } from '@/components/icons/SocialIcons';

export interface SiteSocial {
  label: string;
  href: string;
  icon: SocialIconName;
}

export interface SiteConfig {
  name: string;
  siteTitle: string;
  tagline: string;
  role: string;
  description: string;
  location: string;
  url: string;
  twitterHandle: string;
  cvFileName: string;
  about: string[];
  socials: SiteSocial[];
  analytics: {
    umamiScriptUrl: string;
    umamiWebsiteId: string;
    umamiDashboardUrl: string;
  };
}

export const SITE = siteData as SiteConfig;
