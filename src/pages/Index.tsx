import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

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

