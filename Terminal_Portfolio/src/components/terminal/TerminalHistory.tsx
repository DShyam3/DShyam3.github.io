
import React from 'react';
import TerminalPrompt from './TerminalPrompt';
import { HistoryEntry, ZshTheme } from './types';
import { useIsMobile } from '../../hooks/use-mobile';

type TerminalHistoryProps = {
  history: HistoryEntry[];
  zshTheme: ZshTheme;
};

const TerminalHistory: React.FC<TerminalHistoryProps> = ({ history, zshTheme }) => {
  const isMobile = useIsMobile();

  return (
    <>
      {history.map((entry, index) => (
        <div key={index} className={`mb-4 ${isMobile ? 'text-sm' : ''}`}>
          {entry.command && (
            <TerminalPrompt zshTheme={zshTheme} command={entry.command} />
          )}
          
          {entry.output}
        </div>
      ))}
    </>
  );
};

export default TerminalHistory;
