import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixGlobe } from '@/components/dot-matrix/DotMatrixGlobe';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Briefcase, GraduationCap, FolderGit2, Download, Upload, Loader2 } from 'lucide-react';
import './Index.css';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useEffect } from 'react';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState('intro');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [cvUrl, setCvUrl] = useState<string>('');
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const { experience, loading: expLoading, addExperience, updateExperience, removeExperience } = useExperience();
  const { education, loading: eduLoading, addEducation, updateEducation, removeEducation } = useEducation();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { content: siteContent } = useSiteContent(['about_me_1', 'about_me_2']);
  const timeline = buildResumeTimeline(experience, education);

  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [eduDialogOpen, setEduDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | undefined>();
  const [editingEdu, setEditingEdu] = useState<Education | undefined>();

  useEffect(() => {
    // Get the base public URL for the CV
    const { data } = supabase.storage.from('documents').getPublicUrl('cv.pdf');
    setCvUrl(data.publicUrl);
  }, []);

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please select a PDF file.', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' });
      return;
    }

    setUploadingCv(true);
    try {
      const newUrl = await uploadDocument(file, 'cv.pdf');
      setCvUrl(newUrl);
      toast({ title: 'CV Uploaded successfully' });
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast({ title: 'Upload failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  return (
    <AppShell layout="workspace">
      <div className="about-workspace selection:bg-primary/30" data-active-card={activeCard}>
        <div className="about-card-switcher" role="group" aria-label="About sections">
          {[['intro', 'About'], ['experience', 'Experience'], ['projects', 'Projects']].map(([id, label]) => (
            <Button key={id} variant={activeCard === id ? 'secondary' : 'ghost'}
              aria-pressed={activeCard === id} aria-controls={`about-${id}`}
              onClick={() => setActiveCard(id)}>{label}</Button>
          ))}
        </div>
        <div className="about-grid-slot">
          {/* Bento Grid Layout */}
          <div className="about-grid">
            <div id="about-intro" role="region" aria-label="About me" data-palette="sage" className="about-pane ambient-card about-intro bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 xl:p-6 transition-[background-color] duration-200 hover:bg-card/50" style={{ boxShadow: 'var(--shadow-border)' }}>
              <div className="mb-6 w-full overflow-hidden">
                <DotMatrixText
                  text="ABOUT ME"
                  size="lg"
                  className="text-foreground tracking-widest pl-1"
                />
              </div>
              <div className="about-card-scroll app-scroll space-y-4 text-sm leading-relaxed text-muted-foreground" tabIndex={0} role="region" aria-label="Biography">
                <img className="about-compact-portrait" src={`${ASSETS_URL}/selfie.webp`} alt="Dhyan Shyam" width={1952} height={2252}
                  onError={(e) => { e.currentTarget.src = `${ASSETS_URL}/memoji.png`; }} />
                <p>
                  {siteContent.about_me_1 || SITE.about[0]}
                </p>
                <p>
                  {siteContent.about_me_2 || SITE.about[1]}
                </p>
              </div>
            </div>

            {/* Profile Image (Desktop Only) */}
            <div className="about-portrait portrait-card xl:col-start-1 xl:row-start-1 hidden md:flex bg-primary/5 hover:border-primary/50 border-primary/20 rounded-[2rem] p-0 flex-col items-center justify-center group overflow-hidden relative transition-[border-color] duration-500 shrink-0 w-fit mx-auto xl:w-full xl:mx-0" style={{ boxShadow: 'var(--shadow-border)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />
              <img
                src={`${ASSETS_URL}/selfie.webp`}
                alt="Me"
                width={1952}
                height={2252}
                // Spread, and lowercase. React 18 does not recognise the
                // camelCase `fetchPriority` -- that landed in 19 -- so it
                // reached the DOM as an unknown attribute and warned on
                // every render. The DOM attribute is lowercase, but
                // @types/react only declares the camelCase prop, so the
                // spelling the browser wants has to go in as a spread.
                {...{ fetchpriority: 'high' }}
                className="relative max-w-[280px] w-full h-auto object-contain xl:absolute xl:inset-0 xl:max-w-none xl:h-full xl:object-cover xl:object-center z-10 group-hover:scale-105 transition-transform duration-700 ease-out no-outline"
                onError={(e) => {
                  e.currentTarget.src = `${ASSETS_URL}/memoji.png`;
                }}
              />
            </div>

            {/* The combined experience and education timeline scrolls inside its card. */}
            <div id="about-experience" role="region" aria-label="Experience and education" data-palette="sky" className="about-pane about-experience ambient-card bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 xl:p-6 transition-[background-color] duration-200 hover:bg-card/50" style={{ boxShadow: 'var(--shadow-border)' }}>
              <div className="about-experience-heading flex flex-wrap items-center justify-between gap-2 mb-4 w-full">
                <div className="min-w-0">
                  <DotMatrixText
                    text="EXPERIENCE"
                    size="sm"
                    wrap={false}
                    className="text-foreground tracking-widest pl-1 font-semibold"
                  />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {isAdmin && (
                    <>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        ref={cvInputRef}
                        onChange={handleCvUpload}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex-shrink-0"
                        onClick={() => { setEditingExp(undefined); setExpDialogOpen(true); }}
                        aria-label="Add experience"
                        title="Add experience"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex-shrink-0"
                        onClick={() => { setEditingEdu(undefined); setEduDialogOpen(true); }}
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
              <div className="border-b border-border/50 mb-6"></div>
              <div className="about-timeline-grid about-card-scroll app-scroll" tabIndex={0} role="region" aria-label="Experience timeline">
                {expLoading || eduLoading ? (
                  <div className="about-timeline-loading space-y-6">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  timeline.map((entry) => {
                    const org = entry.kind === 'experience' ? entry.item.company : entry.item.school;
                    return (
                      <div key={`${entry.kind}-${entry.item.id}`} className="about-timeline-entry group/item border-b border-border/40">
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
                            <p className="text-sm font-medium leading-snug text-foreground">
                              {entry.kind === 'experience' ? entry.item.title : entry.item.degree}
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
                              {[entry.item.location, `${entry.item.start_date} - ${entry.item.end_date}`]
                                .filter(Boolean)
                                .join(' | ')}
                            </p>
                          </div>
                          {isAdmin && (
                            <div className="ml-auto flex shrink-0 items-center gap-2 card-actions">
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

            {/* Projects remains a separate, bounded card. */}
            <div id="about-projects" tabIndex={0} role="region" aria-label="Projects portfolio" data-palette="peach" className="about-pane about-projects app-scroll ambient-card bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 xl:p-6 flex flex-col items-center justify-center text-center transition-[background-color] duration-200 hover:bg-card/50 group" style={{ boxShadow: 'var(--shadow-border)' }}>
              <div className="bg-background/50 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500">
                <FolderGit2 className="w-8 h-8 text-primary/70" />
              </div>
              <DotMatrixText
                text="PROJECTS PORTFOLIO"
                size="md"
                className="text-foreground mb-4 font-bold"
              />
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Curating my life's work. A collection of physical and digital creations is coming soon.
              </p>
            </div>
          </div>
        </div>
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
