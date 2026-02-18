import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { DotMatrixGlobe } from '@/components/DotMatrixGlobe';
import { GlobeAdminPanel } from '@/components/GlobeAdminPanel';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitedCountries } from '@/hooks/useVisitedCountries';
import { useState, useEffect } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { visitedCountries, addCountry, removeCountry } = useVisitedCountries();
  const visitedCodes = visitedCountries.map(c => c.country_code);

  // Responsive globe size
  const [globeSize, setGlobeSize] = useState(360);
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      if (w < 480) setGlobeSize(260);
      else if (w < 768) setGlobeSize(320);
      else setGlobeSize(400);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="wide-container flex-1 flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-0 py-12 md:py-24 space-y-12">

          <div className="flex flex-col items-center space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-2">
              <DotMatrixText text="ABOUT ME" size="lg" className="text-foreground" />
            </div>

            <div className="max-w-2xl space-y-6 text-muted-foreground text-lg md:text-xl leading-relaxed">
              <p>
                Welcome to my digital garden. I am Dhyan, a Robotic Engineer with a passion for building
                things that exist in both the physical and digital worlds.
              </p>
              <p>
                This space is a curated collection of my beliefs, inspirations, and the tools I use
                to navigate the complexities of life and engineering.
              </p>
            </div>
          </div>

          {/* Globe Section */}
          <div className="flex flex-col items-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            <DotMatrixText text="WHERE I'VE BEEN" size="sm" className="text-muted-foreground" />
            <DotMatrixGlobe
              visitedCountryCodes={visitedCodes}
              size={globeSize}
            />
            {visitedCodes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {visitedCodes.length} {visitedCodes.length === 1 ? 'country' : 'countries'} visited
              </p>
            )}

            {/* Admin panel for managing visited countries */}
            {isAdmin && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex justify-center">
                <GlobeAdminPanel
                  visitedCodes={visitedCodes}
                  onAddCountry={addCountry}
                  onRemoveCountry={removeCountry}
                />
              </div>
            )}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            <Button
              size="lg"
              className="text-lg px-8 py-6 h-auto group bg-primary hover:bg-primary/90 transition-all duration-300"
              onClick={() => navigate('/inventory')}
            >
              Explore Inventory
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Index;
