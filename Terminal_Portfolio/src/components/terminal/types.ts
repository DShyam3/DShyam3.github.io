import React from 'react';

export type HistoryEntry = {
  command: string;
  output: React.ReactNode | Promise<React.ReactNode> | null;
};

export type CommandCategory = 'terminal' | 'helpful';

export type Command = {
  name: string;
  description: string;
  execute: (args: string[]) => React.ReactNode | Promise<React.ReactNode> | null;
  category: CommandCategory;
};

export type ZshTheme = {
  prompt: {
    user: string;
    host: string;
    separator: string;
    path: string;
    git: {
      branch: string;
      status: string;
      separator: string;
      closing: string;
    };
    symbol: string;
  };
};

export type TerminalControlsProps = {
  position: string;
  style: string;
};
