import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { OpeningSequence } from "@/components/OpeningSequence";
import Link from "./pages/Inventory";
import Index from "./pages/Index";
import Travel from "./pages/Travel";
import Inventory from "./pages/Inventory";
import Links from "./pages/Links";
import Books from "./pages/Books";
import Beliefs from "./pages/Beliefs";
import Watchlist from "./pages/Watchlist";
import Inspiration from "./pages/Inspiration";
import Photos from "./pages/Photos";
import Articles from "./pages/Articles";
import Recipes from "./pages/Recipes";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import { LinksProvider } from "./contexts/LinksContext";
import { BooksProvider } from "./contexts/BooksContext";
import { ArticlesProvider } from "./contexts/ArticlesContext";
import { RecipesProvider } from "./contexts/RecipesContext";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => {
  const [showOpening, setShowOpening] = useState(true);

  const handleOpeningComplete = () => {
    setShowOpening(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
            <AuthProvider>
              <WatchlistProvider>
                <LinksProvider>
                  <BooksProvider>
                    <ArticlesProvider>
                      <RecipesProvider>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/travel" element={<Travel />} />
                          <Route path="/inventory" element={<Inventory />} />
                          <Route path="/links" element={<Links />} />
                          <Route path="/books" element={<Books />} />
                          <Route path="/beliefs" element={<Beliefs />} />
                          <Route path="/watchlist" element={<Watchlist />} />
                          <Route path="/inspiration" element={<Inspiration />} />
                          <Route path="/photos" element={<Photos />} />
                          <Route path="/articles" element={<Articles />} />
                          <Route path="/recipes" element={<Recipes />} />
                          <Route path="/admin" element={<Admin />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </RecipesProvider>
                    </ArticlesProvider>
                  </BooksProvider>
                </LinksProvider>
              </WatchlistProvider>
            </AuthProvider>
          </BrowserRouter>

          {showOpening && <OpeningSequence onComplete={handleOpeningComplete} />}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

