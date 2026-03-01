import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { DotMatrixGlobe } from '@/components/DotMatrixGlobe';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  MapPin,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Download,
} from 'lucide-react';
import './Index.css';

const CACHE_BUST = '?v=1';

const LOGO_URLS = {
  airbus: 'https://business.esa.int/sites/business/files/AIRBUS_DS_3D_Blue_RGB.jpg',
  lodestar:
    'https://media.licdn.com/dms/image/v2/D4E0BAQFnAnRtu4BPQg/company-logo_200_200/company-logo_200_200/0/1682965495735/lodestarspace_logo?e=2147483647&v=beta&t=lWPqrJb1xFiKMpCCWMx9r9DZWzPEzvmc8r-iAAj3a58', // Update with correct path or URL
  keysight: 'https://upload.wikimedia.org/wikipedia/en/5/58/Keysight_Logo.svg',
  ucl: 'https://www.ucl.ac.uk/brand-and-experience/sites/brand_and_experience/files/styles/all_size_mobile_16_9/public/2025-11/about-brand-logo-hero.png.jpg?itok=5QCfiLR0',
  plymouth:
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBYMKYus6J7E5KDFFn9LtuZZBTk7Y2UOgZjg&s',
};

const Index = () => {
  const navigate = useNavigate();

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
                  src="selfie.png"
                  alt="Me"
                  className="max-w-[240px] w-full h-auto object-contain relative z-10 group-hover:scale-105 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    e.currentTarget.src = '/memoji.png';
                  }}
                />
              </div>

              {/* About Me */}
              <div className="bg-card/40 border border-border/40 backdrop-blur-sm rounded-[2rem] p-8 transition-all hover:bg-card/50">
                <div className="mb-6">
                  <DotMatrixText
                    text="ABOUT ME"
                    size="lg"
                    className="text-foreground tracking-widest pl-1"
                  />
                </div>
                <div className="space-y-6">
                  <DotMatrixText
                    text="Welcome to my digital garden. I am Dhyan, a Robotic Engineer with a passion for building things that exist in both the physical and digital worlds."
                    size="sm"
                    className="text-muted-foreground opacity-90"
                  />
                  <DotMatrixText
                    text="This space is a curated collection of my beliefs, inspirations, and the tools I use to navigate life and engineering."
                    size="sm"
                    className="text-muted-foreground opacity-90"
                  />
                </div>
              </div>

              {/* Experience */}
              <div className="bg-card/40 border border-border/40 backdrop-blur-sm rounded-[2rem] p-8 transition-all hover:bg-card/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2 mb-4 w-full overflow-hidden">
                  <div className="w-full sm:w-auto overflow-hidden">
                    <DotMatrixText
                      text="EXPERIENCE"
                      size="sm"
                      className="text-foreground tracking-widest pl-1 font-semibold truncate"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs rounded-full hover:bg-primary hover:text-primary-foreground border-primary/20 hover:border-transparent transition-all shrink-0 max-w-full"
                    onClick={() => window.open('/Dhyan_Shyam_CV.pdf', '_blank')}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Download CV / Resume</span>
                  </Button>
                </div>
                <div className="border-b border-border/50 mb-6"></div>
                <div className="space-y-0">
                  {/* Airbus */}
                  <div className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                    <div className="flex items-start gap-4">
                      <img
                        src={LOGO_URLS.airbus}
                        alt="Airbus"
                        className="w-16 h-16 object-contain mt-1 group-hover/item:scale-105 transition-transform shrink-0"
                      />
                      <div>
                        <DotMatrixText
                          text="ROBOTICS SOFTWARE ENGINEER // AIRBUS DEFENCE AND SPACE"
                          size="xs"
                          className="text-foreground font-medium"
                        />
                        <div className="mt-2 text-muted-foreground">
                          <DotMatrixText
                            text="- STEVENAGE, UNITED KINGDOM | 2025 - PRESENT"
                            size="xs"
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Lodestar Space */}
                  <div className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 shrink-0 relative flex items-center justify-center mt-1">
                        <img
                          src={LOGO_URLS.lodestar}
                          alt="Lodestar Space"
                          className="w-16 h-16 object-contain group-hover/item:scale-105 transition-transform"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling!.classList.remove(
                              'hidden',
                            );
                          }}
                        />
                        <span className="hidden font-black text-foreground text-[10px] tracking-widest w-full h-full flex items-center justify-center text-center leading-tight">
                          LODE
                          <br />
                          STAR
                        </span>
                      </div>
                      <div>
                        <DotMatrixText
                          text="ROBOTICS ENGINEER (MASTERS THESIS) // LODESTAR SPACE"
                          size="xs"
                          className="text-foreground font-medium"
                        />
                        <div className="mt-2 text-muted-foreground">
                          <DotMatrixText
                            text="- LONDON, UNITED KINGDOM | 2025 - 2025"
                            size="xs"
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Keysight */}
                  <div className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 shrink-0 relative flex items-center justify-center mt-1 bg-white rounded-md p-1 group-hover/item:scale-105 transition-transform">
                        <img
                          src={LOGO_URLS.keysight}
                          alt="Keysight"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <DotMatrixText
                          text="5G R&D SOFTWARE ENGINEER // KEYSIGHT TECHNOLOGIES"
                          size="xs"
                          className="text-foreground font-medium"
                        />
                        <div className="mt-2 text-muted-foreground">
                          <DotMatrixText
                            text="- FLEET, UNITED KINGDOM | 2022 - 2023"
                            size="xs"
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Education */}
              <div className="bg-card/40 border border-border/40 backdrop-blur-sm rounded-[2rem] p-8 transition-all hover:bg-card/50">
                <div className="mb-4">
                  <DotMatrixText
                    text="EDUCATION"
                    size="sm"
                    className="text-foreground tracking-widest pl-1 font-semibold"
                  />
                </div>
                <div className="border-b border-border/50 mb-6"></div>
                <div className="space-y-0">
                  {/* UCL */}
                  <div className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                    <div className="flex items-start gap-4">
                      <img
                        src={LOGO_URLS.ucl}
                        alt="UCL"
                        className="w-16 h-16 object-contain mt-1 group-hover/item:scale-105 transition-transform shrink-0"
                      />
                      <div>
                        <DotMatrixText
                          text="MSC ROBOTICS AND AI"
                          size="xs"
                          className="text-foreground font-medium"
                        />
                        <div className="mt-2 text-muted-foreground">
                          <DotMatrixText
                            text="UNIVERSITY COLLEGE LONDON | 2024 - 2025"
                            size="xs"
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Plymouth */}
                  <div className="group/item border-b border-border/40 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
                    <div className="flex items-start gap-4">
                      <img
                        src={LOGO_URLS.plymouth}
                        alt="Plymouth"
                        className="w-16 h-16 object-contain mt-1 group-hover/item:scale-105 transition-transform shrink-0"
                      />
                      <div>
                        <DotMatrixText
                          text="BSC ROBOTICS"
                          size="xs"
                          className="text-foreground font-medium"
                        />
                        <div className="mt-2 text-muted-foreground">
                          <DotMatrixText
                            text="UNIVERSITY OF PLYMOUTH | 2020 - 2024"
                            size="xs"
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Image, Projects */}
            <div className="md:col-span-6 flex flex-col gap-6">
              {/* Profile Image (Desktop Only) */}
              <div className="hidden md:flex bg-primary/5 border hover:border-primary/50 border-primary/20 rounded-[2rem] p-0 flex-col items-center justify-center group overflow-hidden relative transition-all duration-500 shrink-0 w-fit mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" />
                <img
                  src="selfie.png"
                  alt="Me"
                  className="max-w-[280px] w-full h-auto object-contain relative z-10 group-hover:scale-105 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    e.currentTarget.src = '/memoji.png';
                  }}
                />
              </div>

              {/* Projects Portfolio (Full Fill Bottom) */}
              <div className="bg-card/40 border border-border/40 backdrop-blur-sm rounded-[2rem] p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-card/50 group cursor-pointer flex-1">
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
    </div>
  );
};

export default Index;
