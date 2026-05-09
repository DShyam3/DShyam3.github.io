import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixGlobe } from '@/components/dot-matrix/DotMatrixGlobe';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Briefcase, GraduationCap, FolderGit2, Download, Upload, Loader2 } from 'lucide-react';
import './Index.css';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useEffect } from 'react';
import { uploadDocument } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { ASSETS_URL } from '@/lib/constants';
import { useSiteContent } from '@/hooks/useSiteContent';


import { useExperience, useEducation, Experience, Education } from '@/hooks/useResume';
import { Skeleton } from '@/components/ui/skeleton';
import { ExperienceDialog, EducationDialog } from '@/components/admin/ResumeDialogs';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [cvUrl, setCvUrl] = useState<string>('');
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const { experience, loading: expLoading, addExperience, updateExperience, removeExperience } = useExperience();
  const { education, loading: eduLoading, addEducation, updateEducation, removeEducation } = useEducation();
  const { content: siteContent } = useSiteContent(['about_me_1', 'about_me_2']);

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
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <div className="wide-container flex-1 flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-0 py-12 md:py-20 max-w-6xl mx-auto w-full">
          {/* Bento Grid Layout */}
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            {/* LEFT COLUMN: About Me, Experience & Education */}
            <div className="md:col-span-6 flex flex-col gap-6">
              {/* Profile Image (Mobile Only) */}
              <div className="flex md:hidden bg-primary/5 border hover:border-primary/50 border-primary/20 rounded-[2rem] p-0 flex-col items-center justify-center group overflow-hidden relative shrink-0 w-fit mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />
                <img
                  src={`${ASSETS_URL}/selfie.webp`}
                  alt="Me"
                  className="max-w-[240px] w-full h-auto object-contain relative z-10 group-hover:scale-105 transition-transform duration-700 ease-out no-outline"
                  onError={(e) => {
                    e.currentTarget.src = `${ASSETS_URL}/memoji.png`;
                  }}
                />
              </div>

              {/* About Me */}
              <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 transition-[background-color] duration-200 hover:bg-card/50" style={{ boxShadow: 'var(--shadow-border)' }}>
                <div className="mb-6">
                  <DotMatrixText
                    text="ABOUT ME"
                    size="lg"
                    className="text-foreground tracking-widest pl-1"
                  />
                </div>
                <div className="space-y-6">
                  <DotMatrixText
                    text={siteContent.about_me_1 || "Welcome to my digital garden. I am Dhyan, a Robotic Engineer with a passion for building things that exist in both the physical and digital worlds."}
                    size="sm"
                    className="text-muted-foreground opacity-90"
                  />
                  <DotMatrixText
                    text={siteContent.about_me_2 || "This space is a curated collection of my beliefs, inspirations, and the tools I use to navigate life and engineering."}
                    size="sm"
                    className="text-muted-foreground opacity-90"
                  />
                </div>
              </div>

              {/* Experience */}
              <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 transition-[background-color] duration-200 hover:bg-card/50" style={{ boxShadow: 'var(--shadow-border)' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2 mb-4 w-full overflow-hidden">
                  <div className="w-full sm:w-auto overflow-hidden">
                    <DotMatrixText
                      text="EXPERIENCE"
                      size="sm"
                      className="text-foreground tracking-widest pl-1 font-semibold truncate"
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
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2 text-xs rounded-full hover:bg-primary hover:text-primary-foreground border-primary/20 hover:border-transparent transition-[color,background-color,border-color] duration-200 shrink-0"
                          onClick={() => cvInputRef.current?.click()}
                          disabled={uploadingCv}
                        >
                          {uploadingCv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate hidden sm:inline">Upload CV</span>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs rounded-full hover:bg-primary hover:text-primary-foreground border-primary/20 hover:border-transparent transition-[color,background-color,border-color] duration-200 shrink-0 max-w-full"
                      onClick={() => window.open(cvUrl, '_blank')}
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Download CV / Resume</span>
                    </Button>
                  </div>
                </div>
                <div className="border-b border-border/50 mb-6"></div>
                <div className="space-y-0">
                  {expLoading ? (
                    <div className="space-y-6">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    experience.map((item) => (
                      <div key={item.id} className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 shrink-0 relative flex items-center justify-center mt-1 bg-white/5 rounded-md p-1 group-hover/item:scale-105 transition-transform overflow-hidden">
                            <img
                              src={item.logo_url}
                              alt={item.company}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling!.classList.remove('hidden');
                              }}
                            />
                            <span className="hidden font-black text-foreground text-[10px] tracking-widest w-full h-full flex items-center justify-center text-center leading-tight">
                              {item.company.substring(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <DotMatrixText
                              text={`${item.title} // ${item.company}`}
                              size="xs"
                              className="text-foreground font-medium"
                            />
                            <div className="mt-2 text-muted-foreground">
                              <DotMatrixText
                                text={`- ${item.location} | ${item.start_date} - ${item.end_date}`}
                                size="xs"
                                className="opacity-80"
                              />
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-primary/10"
                                onClick={() => { setEditingExp(item); setExpDialogOpen(true); }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive"
                                onClick={() => removeExperience(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Education */}
              <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 transition-[background-color] duration-200 hover:bg-card/50" style={{ boxShadow: 'var(--shadow-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <DotMatrixText
                    text="EDUCATION"
                    size="sm"
                    className="text-foreground tracking-widest pl-1 font-semibold"
                  />
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                      onClick={() => { setEditingEdu(undefined); setEduDialogOpen(true); }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="border-b border-border/50 mb-6"></div>
                <div className="space-y-0">
                  {eduLoading ? (
                    <div className="space-y-6">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    education.map((item) => (
                      <div key={item.id} className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                        <div className="flex items-start gap-4">
                          <img
                            src={item.logo_url}
                            alt={item.school}
                            className="w-16 h-16 object-contain mt-1 group-hover/item:scale-105 transition-transform shrink-0"
                          />
                          <div>
                            <DotMatrixText
                              text={item.degree}
                              size="xs"
                              className="text-foreground font-medium"
                            />
                            <div className="mt-2 text-muted-foreground">
                              <DotMatrixText
                                text={`${item.school} | ${item.start_date} - ${item.end_date}`}
                                size="xs"
                                className="opacity-80"
                              />
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-primary/10"
                                onClick={() => { setEditingEdu(item); setEduDialogOpen(true); }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive"
                                onClick={() => removeEducation(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Image, Projects */}
            <div className="md:col-span-6 flex flex-col gap-6">
              {/* Profile Image (Desktop Only) */}
              <div className="hidden md:flex bg-primary/5 hover:border-primary/50 border-primary/20 rounded-[2rem] p-0 flex-col items-center justify-center group overflow-hidden relative transition-[border-color] duration-500 shrink-0 w-fit mx-auto" style={{ boxShadow: 'var(--shadow-border)' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />
                <img
                  src={`${ASSETS_URL}/selfie.webp`}
                  alt="Me"
                  className="max-w-[280px] w-full h-auto object-contain relative z-10 group-hover:scale-105 transition-transform duration-700 ease-out no-outline"
                  onError={(e) => {
                    e.currentTarget.src = `${ASSETS_URL}/memoji.png`;
                  }}
                />
              </div>

              {/* Projects Portfolio (Full Fill Bottom) */}
              <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-8 flex flex-col items-center justify-center text-center transition-[background-color] duration-200 hover:bg-card/50 group cursor-pointer flex-1" style={{ boxShadow: 'var(--shadow-border)' }}>
                <div className="bg-background/50 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500">
                  <FolderGit2 className="w-8 h-8 text-primary/70" />
                </div>
                <DotMatrixText
                  text="PROJECTS PORTFOLIO"
                  size="md"
                  className="text-foreground mb-4 font-bold"
                />
                <DotMatrixText
                  text="Curating my life's work. A collection of physical and digital creations is coming soon."
                  size="xs"
                  className="text-muted-foreground max-w-xs justify-center"
                />
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

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
    </div>
  );
};

export default Index;
