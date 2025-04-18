import React, { useState, useEffect, useRef } from 'react';
import { getTerminalControls } from '../utils/systemInfo';
import TerminalHeader from './terminal/TerminalHeader';
import TerminalHistory from './terminal/TerminalHistory';
import TerminalInput from './terminal/TerminalInput';
import { HistoryEntry, Command, CommandCategory } from './terminal/types';

// Import all command implementations
import {
  // Terminal commands
  clearCommand,
  echoCommand,
  lsCommand,
  neofetchCommand,
  themeCommand,
  whoamiCommand,
  
  // Helpful commands
  aboutCommand,
  contactCommand,
  helpCommand,
  projectsCommand,
  readmeCommand,
  resumeCommand,
  skillsCommand,
  sourceCommand,
} from './terminal/terminalCommands';

const Terminal: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [terminalControls, setTerminalControls] = useState({ position: 'left', style: 'circles' });
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set terminal controls based on OS
    setTerminalControls(getTerminalControls());
  }, []);

  const zshTheme = {
    prompt: {
      user: "visitor",
      host: "portfolio",
      separator: ":",
      path: "~",
      git: {
        branch: "main",
        status: "✓",
        separator: "git:(",
        closing: ")",
      },
      symbol: "❯",
    }
  };

  // Build our commands object with all commands
  const commands: Record<string, Command> = {
    // Terminal Commands (alphabetical order)
    clear: {
      ...clearCommand,
      execute: () => {
        setTimeout(() => {
          setHistory([]);
        }, 0);
        return null;
      }
    },
    echo: echoCommand,
    ls: lsCommand,
    neofetch: neofetchCommand,
    theme: themeCommand,
    whoami: whoamiCommand,
    
    // Helpful Commands (alphabetical order)
    about: aboutCommand,
    contact: contactCommand,
    help: {
      ...helpCommand,
      execute: () => {
        const terminalCommands = Object.entries(commands)
          .filter(([_, cmd]) => cmd.category === 'terminal')
          .sort(([a], [b]) => a.localeCompare(b));
          
        const helpfulCommands = Object.entries(commands)
          .filter(([_, cmd]) => cmd.category === 'helpful')
          .sort(([a], [b]) => a.localeCompare(b));
          
        return (
          <div className="mt-2">
            <p className="text-mocha-lavender font-bold">Terminal commands:</p>
            <ul className="ml-4">
              {terminalCommands.map(([name, cmd]) => (
                <li key={name} className="mt-1">
                  <span className="text-mocha-green">{name}</span>
                  <span className="text-mocha-text ml-4">{cmd.description}</span>
                </li>
              ))}
            </ul>
            
            <p className="text-mocha-lavender font-bold mt-4">Helpful commands:</p>
            <ul className="ml-4">
              {helpfulCommands.map(([name, cmd]) => (
                <li key={name} className="mt-1">
                  <span className="text-mocha-green">{name}</span>
                  <span className="text-mocha-text ml-4">{cmd.description}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
    },
    projects: projectsCommand,
    readme: readmeCommand,
    resume: resumeCommand,
    skills: skillsCommand,
    source: sourceCommand,
  };

  const handleCommand = async (command: string) => {
    const [cmd, ...args] = command.split(' ');
    const commandObj = commands[cmd];

    if (!commandObj) {
      return (
        <div className="mt-2">
          <p className="text-mocha-red"> Command not recognized: '{cmd}'</p>
          <p className="text-mocha-red"> Try running <span className="text-mocha-red font-bold">'help'</span> to see available commands</p>
        </div>
      );
    }

    try {
      const output = commandObj.execute(args);
      if (output instanceof Promise) {
        return await output;
      }
      return output;
    } catch (error) {
      return <p className="text-mocha-red">Error executing command: {error instanceof Error ? error.message : 'Unknown error'}</p>;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  const getSuggestions = (inputText: string) => {
    if (!inputText) return [];
    
    return Object.keys(commands).filter(cmd => 
      cmd.startsWith(inputText.trim().split(' ')[0].toLowerCase())
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() !== '') {
      e.preventDefault();
      const command = input.trim();
      
      setHistory(prev => [...prev, { command, output: null }]);
      setCommandHistory(prev => [command, ...prev].slice(0, 50));
      setHistoryIndex(-1);
      setInput('');
      setShowSuggestions(false);

      (async () => {
        const output = await handleCommand(command);
        setHistory(prev => {
          const newHistory = [...prev];
          const lastEntry = newHistory[newHistory.length - 1];
          if (lastEntry && lastEntry.command === command) {
            newHistory[newHistory.length - 1] = { ...lastEntry, output };
          }
          return newHistory;
        });
      })();
    }
    
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    }
    
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
    
    else if (e.key === 'Tab') {
      e.preventDefault();
      
      if (showSuggestions && suggestions.length > 0) {
        setInput(suggestions[0]);
        setShowSuggestions(false);
      } else {
        const currentSuggestions = getSuggestions(input);
        if (currentSuggestions.length === 1) {
          setInput(currentSuggestions[0]);
        } else if (currentSuggestions.length > 1) {
          setSuggestions(currentSuggestions);
          setShowSuggestions(true);
        }
      }
    }
    
    else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const handleTerminalClick = (e: React.MouseEvent) => {
    // Only focus on input when terminal is clicked, but not when text is being selected
    if (window.getSelection()?.toString() === '') {
      const inputElement = document.querySelector('input');
      if (inputElement) {
        inputElement.focus();
      }
    }
  };

  // Fix the typing animation to show "neofetch" correctly from the start
  const simulateTyping = (command: string, delay = 100) => {
    let i = 0;
    setInput('');
    
    const interval = setInterval(() => {
      if (i < command.length) {
        setInput(command.substring(0, i + 1)); // Use substring instead of charAt to avoid "nofetch" issue
        i++;
      } else {
        clearInterval(interval);
        
        setTimeout(async () => {
          const output = await handleCommand(command);
          setHistory(prev => [...prev, { command, output }]);
          setCommandHistory(prev => [command, ...prev].slice(0, 50));
          setInput('');
        }, 300);
      }
    }, delay);
  };

  useEffect(() => {
    const initializeTerminal = async () => {
      const welcomeMessage: HistoryEntry = {
        command: '',
        output: await Promise.resolve(readmeCommand.execute([]))
      };
      setHistory([welcomeMessage]);
      
      setTimeout(() => {
        simulateTyping('neofetch', 70);
      }, 300);
    };

    initializeTerminal();
  }, []);

  return (
    <div 
      className="bg-mocha-base text-mocha-text rounded-md border border-mocha-surface0 shadow-lg overflow-hidden w-full max-w-4xl mx-auto h-[80vh] md:h-[85vh] select-text"
      onClick={handleTerminalClick}
    >
      <TerminalHeader 
        title="Terminal" 
        controls={terminalControls} 
      />
      
      <div 
        ref={terminalRef}
        className="p-4 h-[calc(100%-40px)] overflow-y-auto font-jetbrains"
      >
        <TerminalHistory history={history} zshTheme={zshTheme} />
        
        <TerminalInput
          input={input}
          setInput={setInput}
          handleKeyDown={handleKeyDown}
          zshTheme={zshTheme}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
        />
      </div>
    </div>
  );
};

export default Terminal;
