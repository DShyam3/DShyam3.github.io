
import React, { useRef, useEffect } from 'react';
import TerminalPrompt from './TerminalPrompt';
import { ZshTheme } from './types';

type TerminalInputProps = {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  zshTheme: ZshTheme;
  suggestions: string[];
  showSuggestions: boolean;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
};

const TerminalInput: React.FC<TerminalInputProps> = ({
  input,
  setInput,
  handleKeyDown,
  zshTheme,
  suggestions,
  showSuggestions,
  setShowSuggestions
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <TerminalPrompt zshTheme={zshTheme} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (e.target.value.trim() !== '') {
              // This will be handled by parent
            } else {
              setShowSuggestions(false);
            }
          }}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none outline-none flex-1 ml-1 font-jetbrains select-text"
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="ml-10 mt-1 p-2 bg-mocha-surface0 rounded border border-mocha-surface1 max-w-md select-text">
          <p className="text-sm text-mocha-subtext1 mb-1">Suggestions (press Tab to complete):</p>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index} 
                className="text-mocha-blue cursor-pointer hover:text-mocha-lavender"
                onClick={() => {
                  setInput(suggestion);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalInput;
