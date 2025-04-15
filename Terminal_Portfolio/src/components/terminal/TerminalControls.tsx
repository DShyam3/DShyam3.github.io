
import React from 'react';
import { TerminalControlsProps } from './types';

const TerminalControls: React.FC<TerminalControlsProps> = ({ position, style }) => {
  if (style === 'circles') {
    // macOS/Linux style circles
    return (
      <div className={`flex space-x-2 ${position === 'left' ? 'mr-4' : 'ml-4 order-2'}`}>
        <div className="w-3 h-3 rounded-full bg-mocha-red"></div>
        <div className="w-3 h-3 rounded-full bg-mocha-yellow"></div>
        <div className="w-3 h-3 rounded-full bg-mocha-green"></div>
      </div>
    );
  } else {
    // Windows style buttons
    return (
      <div className={`flex space-x-2 ${position === 'left' ? 'mr-4' : 'ml-4 order-2'}`}>
        <div className="w-3 h-3 flex items-center justify-center text-xs bg-mocha-overlay0 hover:bg-mocha-red">
          <span className="opacity-0 group-hover:opacity-100">⨯</span>
        </div>
        <div className="w-3 h-3 flex items-center justify-center text-xs bg-mocha-overlay0 hover:bg-mocha-yellow">
          <span className="opacity-0 group-hover:opacity-100">□</span>
        </div>
        <div className="w-3 h-3 flex items-center justify-center text-xs bg-mocha-overlay0 hover:bg-mocha-green">
          <span className="opacity-0 group-hover:opacity-100">-</span>
        </div>
      </div>
    );
  }
};

export default TerminalControls;
