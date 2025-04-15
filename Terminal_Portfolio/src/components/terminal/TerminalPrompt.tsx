
import React from 'react';
import { ZshTheme } from './types';

type TerminalPromptProps = {
  zshTheme: ZshTheme;
  command?: string;
};

const TerminalPrompt: React.FC<TerminalPromptProps> = ({ zshTheme, command }) => {
  return (
    <div className="flex items-center">
      <span className="text-mocha-green">{zshTheme.prompt.user}</span>
      <span className="text-mocha-text">@</span>
      <span className="text-mocha-green">{zshTheme.prompt.host}</span>
      <span className="text-mocha-text mx-1">{zshTheme.prompt.separator}</span>
      <span className="zsh-prompt-path">{zshTheme.prompt.path}</span>
      <span className="text-mocha-yellow ml-1">{zshTheme.prompt.git.separator}</span>
      <span className="zsh-prompt-git">{zshTheme.prompt.git.branch}</span>
      <span className="text-mocha-green ml-0.5">{zshTheme.prompt.git.status}</span>
      <span className="text-mocha-yellow">{zshTheme.prompt.git.closing}</span>
      <span className="zsh-prompt-arrow ml-1">❯</span>
      {command && <span className="ml-1">{command}</span>}
    </div>
  );
};

export default TerminalPrompt;
