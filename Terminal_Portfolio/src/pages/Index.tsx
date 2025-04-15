
import React, { useState, useEffect } from "react";
import Terminal from "../components/Terminal";
import { useIsMobile } from "../hooks/use-mobile";
import "../styles/terminal.css";

const Index = () => {
  // Handle initial loading state
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    // Simulate loading time to ensure fonts are loaded
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check if device is in portrait mode
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    // Run once on mount
    checkOrientation();

    // Add listener for orientation changes
    window.addEventListener('resize', checkOrientation);
    
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-mocha-base flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex space-x-2 mb-4">
            <div className="w-4 h-4 rounded-full bg-mocha-red animate-pulse"></div>
            <div className="w-4 h-4 rounded-full bg-mocha-yellow animate-pulse delay-100"></div>
            <div className="w-4 h-4 rounded-full bg-mocha-green animate-pulse delay-200"></div>
          </div>
          <p className="text-mocha-text font-jetbrains text-lg">Loading terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-mocha-base text-mocha-text font-jetbrains p-4 md:p-8">
      {isMobile && isPortrait && (
        <div className="bg-mocha-surface0 text-mocha-text rounded-md p-3 mb-4 text-center text-sm border border-mocha-surface1">
          <p>For the best experience, please rotate your device to landscape mode</p>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <Terminal />
        <div className="text-center text-mocha-overlay0 text-sm mt-4">
          © 2025 | Built with React, TypeScript and Tailwind CSS | Dhyan Shyam
        </div>
      </div>
    </div>
  );
};

export default Index;
