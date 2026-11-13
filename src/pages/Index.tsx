import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  FolderGit2,
  Download,
  Upload,
  Loader2,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import './Index.css';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadDocument } from '@/lib/storage';
import { openAndDownload } from '@/lib/download';
import { ActionButton } from '@/components/shared/ActionButton';
import { supabase } from '@/integrations/supabase/client';
import { ASSETS_URL } from '@/lib/constants';
import { useSiteContent } from '@/hooks/useSiteContent';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { SITE } from '@/config/site';
import { useExperience, useEducation, Experience, Education } from '@/hooks/useResume';
import { buildResumeTimeline } from '@/lib/resume-timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { ExperienceDialog, EducationDialog } from '@/components/admin/ResumeDialogs';
import { useVisitedCountries } from '@/features/travel/useVisitedCountries';
import { useVisitedCities } from '@/features/travel/useVisitedCities';
import { useCollection } from '@/collections/useCollection';
import { inventoryCollection } from '@/collections/inventory';
import { collections } from '@/collections/registry';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { FactCards } from '@/components/home/FactCards';
import {
  SemanticConstellation,
  buildSemanticClusters,
  type SemanticClusterNode,
} from '@/components/home/SemanticConstellation';

type HomeMode = 'overview' | 'experience' | 'biography';

const Index = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<HomeMode>('overview');

  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const {
    target,
    selectTarget,
  } = useWorkspaceInspector();
  // The highlighted cluster or row is whichever record the inspector holds, so
  // closing the inspector clears the highlight too.
  const selectedClusterId = target?.id ?? '';

  const [cvUrl, setCvUrl] = useState<string>('');
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const {
    experience,
    loading: expLoading,
    addExperience,
    updateExperience,
    removeExperience,
  } = useExperience();
  const {
    education,
    loading: eduLoading,
    addEducation,
    updateEducation,
    removeEducation,
  } = useEducation();
  const { visitedCountries, loading: countriesLoading } = useVisitedCountries();
  const { visitedCities, loading: citiesLoading } = useVisitedCities();
  const { all: inventoryItems, loading: inventoryLoading } = useCollection(inventoryCollection);

  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { content: siteContent } = useSiteContent(['about_me_1', 'about_me_2']);
  const timeline = buildResumeTimeline(experience, education);

  const countriesText = countriesLoading
    ? 'Loading…'
    : `${visitedCountries.length} ${visitedCountries.length === 1 ? 'country' : 'countries'}`;
  const citiesText = citiesLoading
    ? 'Loading…'
    : `${visitedCities.length} ${visitedCities.length === 1 ? 'city' : 'cities'}`;
  const inventoryText = inventoryLoading
    ? 'Loading…'
    : `${inventoryItems.length} ${inventoryItems.length === 1 ? 'item' : 'items'}`;
  // Only the collections this visitor can open.
  const openCollections = collections.filter((c) => !c.adminOnly || isAdmin).length;
  const collectionsText = `${openCollections} collections`;
  const milestonesLoading = expLoading || eduLoading;
  const milestonesText = milestonesLoading
    ? 'Loading…'
    : `${timeline.length} ${timeline.length === 1 ? 'milestone' : 'milestones'}`;

  // Treasury is admin-only, so signed-out visitors never see a Finance cluster,
  // matching the nav and command dock. It is the last cluster, so the indexed
  // lookups below are unaffected.
  const clusters = useMemo(
    () =>
      buildSemanticClusters({
        countriesText,
        citiesText,
        inventoryText,
        collectionsText,
        milestonesText,
      }).filter((cluster) => isAdmin || cluster.id !== 'cluster-treasury'),
    [countriesText, citiesText, inventoryText, collectionsText, milestonesText, isAdmin],
  );

  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [eduDialogOpen, setEduDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | undefined>();
  const [editingEdu, setEditingEdu] = useState<Education | undefined>();

  useEffect(() => {
    const { data } = supabase.storage.from('documents').getPublicUrl('cv.pdf');
    setCvUrl(data.publicUrl);
  }, []);

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file',
        description: 'Please select a PDF file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCv(true);
    try {
      const newUrl = await uploadDocument(file, 'cv.pdf');
      setCvUrl(newUrl);
      toast({ title: 'CV Uploaded successfully' });
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast({
        title: 'Upload failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const handleSelectCluster = (cluster: SemanticClusterNode) => {
    selectTarget(cluster.inspector);
  };

  const inspectExperienceTarget = () => {
    const expCluster =
      clusters.find((c) => c.id === 'cluster-experience') ?? clusters[0];
    selectTarget(expCluster.inspector);
  };

  return (
    <AppShell layout="workspace">
      <div
        className="about-workspace home-workspace selection:bg-primary/30"
        data-active-mode={activeMode}
      >
        {/* Mode Switcher Bar */}
        <div className="home-mode-bar" role="tablist" aria-label="Home workspace views">
          <div className="home-mode-tabs">
            {(
              [
                ['overview', '01 · Overview'],
                [
                  'experience',
                  `02 · Experience & CV (${milestonesLoading ? '…' : timeline.length})`,
                ],
                ['biography', '03 · Biography & Projects'],
              ] as const
            ).map(([modeId, label]) => {
              const active = activeMode === modeId;
              return (
                <button
                  key={modeId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`home-mode-tab ${active ? 'home-mode-tab--active' : ''}`}
                  onClick={() => {
                    setActiveMode(modeId);
                    if (modeId === 'experience') {
                      inspectExperienceTarget();
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="home-mode-actions">
            <ActionButton
              variant="outline"
              icon={Download}
              label="Download CV"
              className="rounded-full border-primary/25 hover:bg-primary hover:text-primary-foreground hover:border-transparent h-8 text-xs shrink-0"
              onClick={() => openAndDownload(cvUrl, SITE.cvFileName)}
            />
          </div>
        </div>

        {/* Hidden file input for admin CV upload */}
        {isAdmin && (
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={cvInputRef}
            onChange={handleCvUpload}
          />
        )}

        {/* 01 · OVERVIEW MODE */}
        {activeMode === 'overview' && (
          <div
            className="home-overview-scroll app-scroll"
            role="region"
            aria-label="Personal OS Overview"
          >
            {/* Top Hero Split Grid */}
            <div className="home-hero-grid">
              {/* Left Editorial Hero Card */}
              <section
                aria-label="Introduction"
                className="home-hero-card ambient-card hud-corners"
                data-palette="sage"
              >
                <div className="home-eyebrow-row">
                  <span className="home-status-dot" aria-hidden="true" />
                  <span className="home-eyebrow-text">Personal Index · London</span>
                </div>

                <div className="my-2 overflow-hidden">
                  <DotMatrixText
                    text="DHYAN SHYAM"
                    size="lg"
                    className="text-foreground tracking-widest"
                  />
                </div>

                <p className="home-hero-lead">
                  {siteContent.about_me_1 || SITE.about[0]}
                </p>

                {/* The mode bar above already has Download CV and the Experience
                    tab; below 640px it hides its CV button, so this one stands
                    in there and only there. */}
                <div className="home-hero-footer">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full text-xs gap-1.5"
                    onClick={() => openAndDownload(cvUrl, SITE.cvFileName)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download CV
                  </Button>
                </div>
              </section>

              {/* Right Interactive 3D Semantic Constellation */}
              <section aria-label="Semantic constellation">
                <SemanticConstellation
                  clusters={clusters}
                  selectedClusterId={selectedClusterId}
                  onSelectCluster={handleSelectCluster}
                />
              </section>
            </div>

            {/* Fact cards: one fact each, opening the section it comes from */}
            <section aria-label="A few facts">
              <div className="home-section-header">
                <span className="home-section-eyebrow">A FEW FACTS</span>
                <span className="home-section-sub">Tap a card to see more</span>
              </div>
              <FactCards
                onOpenExperience={() => {
                  inspectExperienceTarget();
                  setActiveMode('experience');
                }}
              />
            </section>

          </div>
        )}

        {/* 02 · EXPERIENCE & CV MODE */}
        {activeMode === 'experience' && (
          <div
            id="about-experience"
            role="region"
            aria-label="Experience and education"
            data-palette="sky"
            className="about-pane about-experience ambient-card bg-card/40 backdrop-blur-sm rounded-[1.5rem] p-6 transition-[background-color] duration-200 hover:bg-card/50 flex-1 min-h-0 flex flex-col"
            style={{ boxShadow: 'var(--shadow-border)' }}
          >
            <div className="about-experience-heading flex flex-wrap items-center justify-between gap-2 mb-4 w-full shrink-0">
              <div className="min-w-0">
                <DotMatrixText
                  text="EXPERIENCE & EDUCATION"
                  size="sm"
                  wrap={false}
                  className="text-foreground tracking-widest pl-1 font-semibold"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex-shrink-0"
                      onClick={() => {
                        setEditingExp(undefined);
                        setExpDialogOpen(true);
                      }}
                      aria-label="Add experience"
                      title="Add experience"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex-shrink-0"
                      onClick={() => {
                        setEditingEdu(undefined);
                        setEduDialogOpen(true);
                      }}
                      aria-label="Add education"
                      title="Add education"
                    >
                      <GraduationCap className="w-4 h-4" />
                    </Button>
                    <ActionButton
                      variant="outline"
                      icon={uploadingCv ? Loader2 : Upload}
                      iconClassName={uploadingCv ? 'animate-spin' : undefined}
                      label="Upload CV"
                      aria-label="Upload CV"
                      labelClassName="hidden lg:inline-flex"
                      className="rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground hover:border-transparent shrink-0"
                      onClick={() => cvInputRef.current?.click()}
                      disabled={uploadingCv}
                    />
                  </>
                )}
                <ActionButton
                  variant="outline"
                  icon={Download}
                  label="Download CV"
                  className="rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground hover:border-transparent shrink-0 max-w-full"
                  onClick={() => openAndDownload(cvUrl, SITE.cvFileName)}
                />
              </div>
            </div>
            <div className="border-b border-border/50 mb-6 shrink-0" />
            <div
              className="about-timeline-grid about-card-scroll app-scroll"
              tabIndex={0}
              role="region"
              aria-label="Experience timeline"
            >
              {expLoading || eduLoading ? (
                <div className="about-timeline-loading space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                timeline.map((entry) => {
                  const org =
                    entry.kind === 'experience' ? entry.item.company : entry.item.school;
                  const roleOrDegree =
                    entry.kind === 'experience' ? entry.item.title : entry.item.degree;
                  const entryType =
                    entry.kind === 'experience'
                      ? entry.item.employment_type || 'Role'
                      : 'Academic';
                  const handleInspectEntry = () => {
                    selectTarget({
                      id: `${entry.kind}-${entry.item.id}`,
                      eyebrow:
                        entry.kind === 'experience'
                          ? 'Experience Record'
                          : 'Education Record',
                      title: roleOrDegree,
                      summary: `${org}${entry.item.location ? ` · ${entry.item.location}` : ''}`,
                      rows: [
                        {
                          label: 'Organization',
                          value: org,
                          tone: 'accent',
                        },
                        {
                          label: 'Period',
                          value: `${entry.item.start_date} – ${entry.item.end_date}`,
                        },
                        ...(entry.item.location
                          ? [{ label: 'Location', value: entry.item.location }]
                          : []),
                        {
                          label: 'Type',
                          value: entryType,
                          tone: 'sky',
                        },
                      ],
                    });
                  };
                  return (
                    <div
                      key={`${entry.kind}-${entry.item.id}`}
                      className="about-timeline-entry group/item border-b border-border/40 cursor-pointer"
                      onClick={handleInspectEntry}
                    >
                      <div className="about-timeline-row relative flex items-start gap-4">
                        <div className="w-16 h-16 shrink-0 relative flex items-center justify-center mt-1 bg-white ring-1 ring-black/10 rounded-md p-1.5 group-hover/item:scale-105 transition-transform overflow-hidden">
                          <img
                            src={entry.item.logo_url}
                            alt={org}
                            className="w-full h-full object-contain no-outline"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling!.classList.remove('hidden');
                            }}
                          />
                          <span className="hidden font-bold text-foreground text-xs tracking-widest w-full h-full flex items-center justify-center text-center leading-tight">
                            {org.substring(0, 4).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="text-left group/btn focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspectEntry();
                            }}
                          >
                            <p className="text-sm font-medium leading-snug text-foreground group-hover/btn:text-primary transition-colors">
                              {roleOrDegree}
                              {entry.kind === 'experience' && entry.item.employment_type && (
                                <span className="text-muted-foreground">
                                  {' · '}
                                  {entry.item.employment_type}
                                </span>
                              )}
                            </p>
                            <p className="text-sm font-medium leading-snug text-foreground">
                              {org}
                            </p>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">
                              {[
                                entry.item.location,
                                `${entry.item.start_date} - ${entry.item.end_date}`,
                              ]
                                .filter(Boolean)
                                .join(' | ')}
                            </p>
                          </button>
                        </div>
                        {isAdmin && (
                          <div
                            className="ml-auto flex shrink-0 items-center gap-2 card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10"
                              aria-label={`Edit ${org}`}
                              onClick={() => {
                                if (entry.kind === 'experience') {
                                  setEditingExp(entry.item);
                                  setExpDialogOpen(true);
                                } else {
                                  setEditingEdu(entry.item);
                                  setEduDialogOpen(true);
                                }
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive"
                              aria-label={`Delete ${org}`}
                              onClick={() =>
                                askDelete(
                                  entry.kind === 'experience'
                                    ? {
                                        name: `${entry.item.title} // ${entry.item.company}`,
                                        onConfirm: () => removeExperience(entry.item.id),
                                      }
                                    : {
                                        name: entry.item.degree,
                                        onConfirm: () => removeEducation(entry.item.id),
                                      },
                                )
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 03 · BIOGRAPHY & PROJECTS MODE */}
        {activeMode === 'biography' && (
          <div className="home-bio-grid app-scroll">
            <div
              id="about-intro"
              role="region"
              aria-label="About me"
              data-palette="sage"
              className="about-pane ambient-card about-intro bg-card/40 backdrop-blur-sm rounded-[1.5rem] p-6 transition-[background-color] duration-200 hover:bg-card/50"
              style={{ boxShadow: 'var(--shadow-border)' }}
            >
              <div className="mb-4 w-full overflow-hidden">
                <DotMatrixText
                  text="ABOUT ME"
                  size="lg"
                  className="text-foreground tracking-widest pl-1"
                />
              </div>
              <div
                className="space-y-4 text-sm leading-relaxed text-muted-foreground"
                tabIndex={0}
                role="region"
                aria-label="Biography"
              >
                <img
                  className="about-compact-portrait"
                  src={`${ASSETS_URL}/selfie.webp`}
                  alt="Dhyan Shyam"
                  width={1952}
                  height={2252}
                  onError={(e) => {
                    e.currentTarget.src = `${ASSETS_URL}/memoji.png`;
                  }}
                />
                <p>{siteContent.about_me_1 || SITE.about[0]}</p>
                <p>{siteContent.about_me_2 || SITE.about[1]}</p>
              </div>
            </div>

            <button
              type="button"
              id="about-projects"
              onClick={() => navigate('/projects')}
              data-palette="peach"
              className="about-pane about-projects ambient-card bg-card/40 backdrop-blur-sm rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center transition-[background-color] duration-200 hover:bg-card/50 group"
              style={{ boxShadow: 'var(--shadow-border)' }}
            >
              <span className="block bg-background/50 p-4 rounded-full mb-5 group-hover:scale-110 transition-transform duration-500">
                <FolderGit2 className="w-8 h-8 text-primary/70" />
              </span>
              <DotMatrixText
                text="PROJECTS"
                size="md"
                className="text-foreground mb-3 font-bold"
              />
              <span className="block max-w-xs text-sm leading-relaxed text-muted-foreground">
                What I have built, what I am building, and what is planned.
              </span>
            </button>
          </div>
        )}
      </div>

      {deleteDialog}

      <ExperienceDialog
        open={expDialogOpen}
        onOpenChange={setExpDialogOpen}
        initialData={editingExp}
        onSave={async (data) => {
          if (editingExp) {
            await updateExperience(editingExp.id, data);
          } else {
            await addExperience(data);
          }
        }}
      />

      <EducationDialog
        open={eduDialogOpen}
        onOpenChange={setEduDialogOpen}
        initialData={editingEdu}
        onSave={async (data) => {
          if (editingEdu) {
            await updateEducation(editingEdu.id, data);
          } else {
            await addEducation(data);
          }
        }}
      />
    </AppShell>
  );
};

export default Index;
