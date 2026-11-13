import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Briefcase, Clapperboard, Compass, Cpu, FolderGit2, Tv, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSiteContent } from '@/hooks/useSiteContent';
import { useExperience } from '@/hooks/useResume';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlagStrip } from '@/components/shared/FlagStrip';
import { collectionQuery } from '@/collections/useCollection';
import { booksCollection, type BookRow } from '@/collections/books';
import { projectsCollection, type ProjectRow } from '@/collections/projects';
import { inventoryCollection } from '@/collections/inventory';
import { useVisitedCountries } from '@/features/travel/useVisitedCountries';
import { useVisitedCities } from '@/features/travel/useVisitedCities';
import { useContinentMap } from '@/features/travel/useContinentMap';
import {
  FAVOURITE_PICK_KEYS,
  currentRole,
  dayNumber,
  featuredFavourite,
  travelFacts,
  type FavouriteTitle,
} from './fact-cards';

/**
 * Titles only, for the two favourite cards. The Watchlist library read carries
 * every episode of every show; the cards need a title and a poster.
 */
const favouriteTitlesQuery = queryOptions({
  queryKey: ['favourites', 'titles'],
  queryFn: async () => {
    const { data, error } = await selectAllPages((from, to) => supabase
      .from('favourites')
      .select('id, title, poster, media_type, tmdb_id', { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id));
    if (error) throw error;
    return data as FavouriteTitle[];
  },
});

const PICK_KEYS = Object.values(FAVOURITE_PICK_KEYS);

/** A noun's two forms: "series" is its own plural, so an appended "s" will not do. */
interface Noun { one: string; many: string }
const ROTATE = 'rotate';
const LOADING = 'Loading…';

interface Fact {
  id: string;
  kicker: string;
  icon: LucideIcon;
  /**
   * A gradient tint, for at most two cards: DESIGN_SYSTEM allows two gradient
   * panels a view, and six read as a screensaver. The rest are plain panels.
   */
  palette?: string;
  value: ReactNode;
  label: ReactNode;
  more: string;
  media?: ReactNode;
  /** Media under the text rather than beside it, for a strip rather than a poster. */
  stacked?: boolean;
  onOpen: () => void;
  admin?: ReactNode;
}

interface FactCardsProps {
  /** Opens the Experience tab, which lives on this page rather than at a route. */
  onOpenExperience: () => void;
}

/**
 * Small, specific facts about the owner, each one a door into the section it
 * comes from: the travel count opens the map, a favourite film opens the
 * favourites, the book being read opens the shelf on that book.
 *
 * A card with nothing to say once its rows are in is left out, rather than
 * shown empty.
 */
export function FactCards({ onOpenExperience }: FactCardsProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { visitedCountries, loading: countriesLoading } = useVisitedCountries();
  const { visitedCities, loading: citiesLoading } = useVisitedCities();
  const { byCode: continentByCode, sovereignCodes, error: countryListFailed } = useContinentMap();
  const { experience, loading: experienceLoading } = useExperience();
  const { content: picks } = useSiteContent(PICK_KEYS);
  const favourites = useQuery(favouriteTitlesQuery);
  const books = useQuery(collectionQuery(booksCollection));
  const projects = useQuery(collectionQuery(projectsCollection));
  const inventory = useQuery(collectionQuery(inventoryCollection));

  const travel = useMemo(
    () => travelFacts(visitedCountries.map((c) => c.country_code), sovereignCodes, continentByCode),
    [visitedCountries, sovereignCodes, continentByCode],
  );
  // The newest first: the strip reads as where the owner has been lately.
  const recentFlags = useMemo(
    () => [...visitedCountries].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [visitedCountries],
  );

  const today = dayNumber(new Date());
  const films = useMemo(() => (favourites.data ?? []).filter((f) => f.media_type === 'movie'), [favourites.data]);
  const series = useMemo(() => (favourites.data ?? []).filter((f) => f.media_type === 'tv'), [favourites.data]);
  const film = featuredFavourite(films, picks[FAVOURITE_PICK_KEYS.movie], today);
  const show = featuredFavourite(series, picks[FAVOURITE_PICK_KEYS.tv], today);

  const role = currentRole(experience);
  const book = useMemo(() => {
    const rows = (books.data ?? []) as BookRow[];
    const newest = (category: string) => rows
      .filter((row) => row.category === category)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const reading = newest('reading');
    if (reading) return { row: reading, kicker: 'Reading now' };
    const finished = newest('completed');
    return finished ? { row: finished, kicker: 'Last finished' } : null;
  }, [books.data]);
  const project = useMemo(() => {
    const rows = [...((projects.data ?? []) as ProjectRow[])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const building = rows.find((row) => row.status === 'in-progress');
    if (building) return { row: building, kicker: 'Building now' };
    const done = rows.find((row) => row.status === 'done');
    return done ? { row: done, kicker: 'Latest project' } : null;
  }, [projects.data]);

  // Only an admin sees the picker, and the database refuses the write to anyone else.
  const savePick = useMutation({
    mutationFn: async ({ key, tmdbId }: { key: string; tmdbId: string }) => {
      const { error } = tmdbId === ROTATE
        ? await supabase.from('site_content').delete().eq('key', key)
        : await supabase.from('site_content').upsert(
          { key, section: 'about', content: tmdbId, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site_content'] }),
    onError: (error) => {
      console.error('[FactCards] could not save the favourite:', error);
      toast({ title: 'Could not save your favourite', description: 'Nothing was changed. Please try again.', variant: 'destructive' });
    },
  });

  const picker = (kind: 'movie' | 'tv', items: FavouriteTitle[], noun: Noun) => {
    const key = FAVOURITE_PICK_KEYS[kind];
    const current = items.some((item) => String(item.tmdb_id) === picks[key]?.trim()) ? picks[key].trim() : ROTATE;
    return (
      <Select value={current} onValueChange={(tmdbId) => savePick.mutate({ key, tmdbId })} disabled={savePick.isPending}>
        <SelectTrigger className="h-9 text-xs" aria-label={`Choose your favourite ${noun.one}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ROTATE}>A different one each day</SelectItem>
          {items.filter((item) => item.tmdb_id !== null).map((item) => (
            <SelectItem key={item.id} value={String(item.tmdb_id)}>{item.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const favouriteFact = (
    kind: 'movie' | 'tv',
    pick: ReturnType<typeof featuredFavourite>,
    items: FavouriteTitle[],
    noun: Noun,
    icon: LucideIcon,
    palette: string,
  ): Fact | null => {
    if (!pick) {
      return favourites.isLoading
        ? { id: kind, kicker: `Favourite ${noun.one}`, icon, palette, value: LOADING, label: '', more: 'See my favourites', onOpen: () => navigate('/watchlist/library?category=favourites') }
        : null;
    }
    return {
      id: kind,
      kicker: pick.chosen ? `Favourite ${noun.one}` : `A favourite ${noun.one}`,
      icon,
      palette,
      value: pick.item.title,
      label: pick.chosen
        ? `Top of ${items.length} favourite ${items.length === 1 ? noun.one : noun.many}`
        : `Today's pick from ${items.length} ${items.length === 1 ? 'favourite' : 'favourites'}`,
      more: 'See my favourites',
      media: pick.item.poster ? <img className="fact-card-poster" src={pick.item.poster} alt="" loading="lazy" decoding="async" /> : undefined,
      onOpen: () => navigate('/watchlist/library?category=favourites'),
      admin: isAdmin ? picker(kind, items, noun) : undefined,
    };
  };

  const facts: (Fact | null)[] = [
    // Without the country list there is no UN count to give, and "Loading…"
    // would sit there for good.
    countryListFailed ? null : {
      id: 'travel',
      kicker: 'Travelled to',
      icon: Compass,
      palette: 'sky',
      value: travel && !countriesLoading
        ? <span className="fact-card-figure">{travel.countries}<span className="fact-card-figure-total">/{travel.total}</span></span>
        : LOADING,
      label: travel && !countriesLoading && !citiesLoading
        ? [
          `countries · ${visitedCities.length} ${visitedCities.length === 1 ? 'city' : 'cities'}`,
          `${travel.continents} ${travel.continents === 1 ? 'continent' : 'continents'}`,
          ...(travel.territories > 0 ? [`+${travel.territories} ${travel.territories === 1 ? 'territory' : 'territories'}`] : []),
        ].join(' · ')
        : 'countries',
      more: 'Open the map',
      media: recentFlags.length > 0 ? <FlagStrip codes={recentFlags.map((country) => country.country_code)} /> : undefined,
      stacked: true,
      onOpen: () => navigate('/travel'),
    },
    favouriteFact('movie', film, films, { one: 'film', many: 'films' }, Clapperboard, 'peach'),
    favouriteFact('tv', show, series, { one: 'series', many: 'series' }, Tv, undefined),
    book
      ? {
        id: 'book',
        kicker: book.kicker,
        icon: BookOpen,
        value: book.row.title,
        label: book.row.author ? `by ${book.row.author}` : '',
        more: 'See the bookshelf',
        media: book.row.cover_url ? <img className="fact-card-poster" src={book.row.cover_url} alt="" loading="lazy" decoding="async" /> : undefined,
        onOpen: () => navigate('/books', { state: { revealId: book.row.id } }),
      }
      : books.isLoading
        ? { id: 'book', kicker: 'Reading now', icon: BookOpen, value: LOADING, label: '', more: 'See the bookshelf', onOpen: () => navigate('/books') }
        : null,
    role
      ? {
        id: 'work',
        kicker: 'Working as',
        icon: Briefcase,
        value: role.title,
        label: [role.company && `at ${role.company}`, role.start_date && `since ${role.start_date}`].filter(Boolean).join(' · '),
        more: 'Experience & CV',
        onOpen: onOpenExperience,
      }
      : experienceLoading
        ? { id: 'work', kicker: 'Working as', icon: Briefcase, value: LOADING, label: '', more: 'Experience & CV', onOpen: onOpenExperience }
        : null,
    project
      ? {
        id: 'project',
        kicker: project.kicker,
        icon: FolderGit2,
        value: project.row.title,
        label: project.row.summary ?? '',
        more: 'See my projects',
        media: project.row.image ? <img className="fact-card-poster fact-card-poster--wide" src={project.row.image} alt="" loading="lazy" decoding="async" /> : undefined,
        onOpen: () => navigate('/projects', { state: { revealId: project.row.id } }),
      }
      : null,
    inventory.data && inventory.data.length > 0
      ? {
        id: 'gear',
        kicker: 'Carrying',
        icon: Cpu,
        value: `${inventory.data.length} ${inventory.data.length === 1 ? 'thing' : 'things'}`,
        label: 'Everyday carry, desk and camera gear',
        more: 'See the inventory',
        onOpen: () => navigate('/inventory'),
      }
      : null,
  ];

  return (
    <div className="fact-grid" role="list">
      {facts.filter((fact): fact is Fact => fact !== null).map((fact) => {
        const Icon = fact.icon;
        return (
          <div key={fact.id} role="listitem" className={`fact-card hud-corners ${fact.palette ? 'ambient-card' : 'surface-card'}`} data-palette={fact.palette}>
            <button type="button" className="fact-card-open" onClick={fact.onOpen}>
              <span className="fact-card-top">
                <span className="readout-label">{fact.kicker}</span>
                <Icon className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
              </span>
              <span className={`fact-card-body${fact.stacked ? ' fact-card-body--stacked' : ''}`}>
                {fact.media && <span className="fact-card-media">{fact.media}</span>}
                <span className="fact-card-text">
                  <span className="fact-card-value">{fact.value}</span>
                  {fact.label && <span className="fact-card-label">{fact.label}</span>}
                </span>
              </span>
              <span className="fact-card-more">
                {fact.more}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
            {fact.admin && <div className="fact-card-admin">{fact.admin}</div>}
          </div>
        );
      })}
    </div>
  );
}
