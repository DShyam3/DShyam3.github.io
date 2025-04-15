
import React from 'react';
import TerminalControls from './TerminalControls';
import { TerminalControlsProps } from './types';

type TerminalHeaderProps = {
  title: string;
  controls: TerminalControlsProps;
};

const TerminalHeader: React.FC<TerminalHeaderProps> = ({ title, controls }) => {
  return (
    <div className="bg-mocha-mantle px-4 py-2 flex items-center border-b border-mocha-surface0">
      {controls.position === 'left' && <TerminalControls position={controls.position} style={controls.style} />}
      <p className="text-center w-full font-medium text-mocha-text">{title}</p>
      {controls.position === 'right' && <TerminalControls position={controls.position} style={controls.style} />}
    </div>
  );
};

export default TerminalHeader;
