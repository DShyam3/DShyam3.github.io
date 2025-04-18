import React from 'react';
import { Command } from './types';
import { getSystemInfo, getOSAsciiArt } from '../../utils/systemInfo';

// Terminal Commands (alphabetical order)
export const clearCommand: Command = {
  name: 'clear',
  description: 'Clears the terminal',
  category: 'terminal',
  execute: () => {
    setTimeout(() => {
      // This will be handled by the Terminal component
      return null;
    }, 0);
    return null;
  },
};

export const echoCommand: Command = {
  name: 'echo',
  description: 'Echoes the input text',
  category: 'terminal',
  execute: (args) => <p className="mt-2">{args.join(' ')}</p>,
};

export const lsCommand: Command = {
  name: 'ls',
  description: 'Lists files and directories',
  category: 'terminal',
  execute: () => (
    <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-2">
      <span className="text-mocha-blue">about.md</span>
      <span className="text-mocha-blue">skills.json</span>
      <span className="text-mocha-blue">projects.yml</span>
      <span className="text-mocha-blue">contact.txt</span>
      <span className="text-mocha-blue">resume.pdf</span>
      <span className="text-mocha-blue">readme.md</span>
      <span className="text-mocha-lavender">secret/</span>
      <span className="text-mocha-lavender">src/</span>
    </div>
  ),
};

export const neofetchCommand: Command = {
  name: 'neofetch',
  description: 'Displays system information',
  category: 'terminal',
  execute: async (args) => {
    try {
      const systemInfo = await getSystemInfo();
      const asciiArt = getOSAsciiArt(systemInfo.os.icon);
      
      // Reordered system details as requested
      const systemDetails = [
        { label: 'Location', value: systemInfo.location },
        { label: 'Host', value: systemInfo.deviceType },
        { label: 'OS', value: systemInfo.os.name },
        { label: 'Browser', value: systemInfo.browser },
        { label: 'Last Login', value: systemInfo.lastLogin }, // Now includes timezone
        { label: 'Kernel', value: 'Portfolio Terminal' },
        { label: 'Terminal', value: 'Kitty Emulation' },
        { label: 'Shell', value: 'Oh-My-Zsh' },
        { label: 'Theme', value: 'Catppuccin Mocha' },
        { label: 'Font', value: 'JetBrains Mono' },
        { label: 'Language', value: systemInfo.language },
        { label: 'Screen Resolution', value: systemInfo.screenResolution }
      ];

      return (
        <div className="mt-2">
          <div className="flex">
            <div className="font-mono text-mocha-blue whitespace-pre mr-8">
              {asciiArt}
            </div>
            
            <div className="flex-1">
              <div className="space-y-1">
                {systemDetails.map((detail, index) => (
                  <p key={index}>
                    <span className="text-mocha-blue">{detail.label}:</span> <span className="text-mocha-text">{detail.value}</span>
                  </p>
                ))}
              </div>
              <div className="mt-2 flex">
                <div className="flex space-x-1">
                  <div className="w-4 h-4 bg-mocha-red"></div>
                  <div className="w-4 h-4 bg-mocha-peach"></div>
                  <div className="w-4 h-4 bg-mocha-yellow"></div>
                  <div className="w-4 h-4 bg-mocha-green"></div>
                  <div className="w-4 h-4 bg-mocha-blue"></div>
                  <div className="w-4 h-4 bg-mocha-mauve"></div>
                  <div className="w-4 h-4 bg-mocha-lavender"></div>
                  <div className="w-4 h-4 bg-mocha-pink"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      return <p className="text-mocha-red mt-2">Error fetching system information</p>;
    }
  },
};

export const themeCommand: Command = {
  name: 'theme',
  description: 'Displays theme information',
  category: 'terminal',
  execute: () => (
    <div className="mt-2 space-y-2">
      <p className="text-mocha-lavender font-bold">Theme: Catppuccin Mocha</p>
      <p>A soothing pastel theme for the high-spirited!</p>
      <div className="mt-4 grid grid-cols-4 md:grid-cols-8 gap-2">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-rosewater"></div>
          <span className="text-xs mt-1">Rosewater</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-flamingo"></div>
          <span className="text-xs mt-1">Flamingo</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-pink"></div>
          <span className="text-xs mt-1">Pink</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-mauve"></div>
          <span className="text-xs mt-1">Mauve</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-red"></div>
          <span className="text-xs mt-1">Red</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-maroon"></div>
          <span className="text-xs mt-1">Maroon</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-peach"></div>
          <span className="text-xs mt-1">Peach</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-yellow"></div>
          <span className="text-xs mt-1">Yellow</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-green"></div>
          <span className="text-xs mt-1">Green</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-teal"></div>
          <span className="text-xs mt-1">Teal</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-sky"></div>
          <span className="text-xs mt-1">Sky</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-sapphire"></div>
          <span className="text-xs mt-1">Sapphire</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-blue"></div>
          <span className="text-xs mt-1">Blue</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-lavender"></div>
          <span className="text-xs mt-1">Lavender</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-text"></div>
          <span className="text-xs mt-1">Text</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-mocha-base"></div>
          <span className="text-xs mt-1">Base</span>
        </div>
      </div>
    </div>
  ),
};

export const whoamiCommand: Command = {
  name: 'whoami',
  description: 'Shows current user',
  category: 'terminal',
  execute: () => <p className="mt-2 text-mocha-green">visitor</p>,
};

// Helpful Commands (alphabetical order)
export const aboutCommand: Command = {
  name: 'about',
  description: 'Shows information about me',
  category: 'helpful',
  execute: () => (
    <div className="mt-2 space-y-2">
      <p className="text-mocha-lavender font-bold text-lg">About Me</p>
      <p>I am a Robotics and Artificial Intelligence Engineer, freshly graduated with a Master's degree from University College London (UCL).</p>
      <p>My passion lies in building and tinkering with robots, seamlessly merging hardware and software to bring intelligent machines to life.</p>
      <p>When I'm not crafting robotic systems, you'll find me exploring the creative side of coding by experimenting with vibe coding to create websites.</p>
    </div>
  ),
};

export const contactCommand: Command = {
  name: 'contact',
  description: 'Shows my contact information',
  category: 'helpful',
  execute: () => (
    <div className="mt-2 space-y-2">
      <p className="text-mocha-lavender font-bold text-lg">Contact Information</p>
      <p>
        <span className="text-mocha-blue">Email:</span> 
        <a href="mailto:d.shyam1256@gmail.com" className="ml-2 text-mocha-green hover:underline">
          d.shyam1256@gmail.com
        </a>
      </p>
      <p>
        <span className="text-mocha-blue">GitHub:</span> 
        <a href="https://github.com/DShyam3" target="_blank" rel="noopener noreferrer" className="ml-2 text-mocha-green hover:underline">
          github.com/DShyam3
        </a>
      </p>
      <p>
        <span className="text-mocha-blue">LinkedIn:</span> 
        <a href="https://linkedin.com/in/dhyan-shyam" target="_blank" rel="noopener noreferrer" className="ml-2 text-mocha-green hover:underline">
          linkedin.com/in/dhyan-shyam
        </a>
      </p>
    </div>
  ),
};

export const helpCommand: Command = {
  name: 'help',
  description: 'Shows available commands',
  category: 'helpful',
  execute: () => {
    // This will be handled in the Terminal component since it needs access to all commands
    return null;
  },
};

export const projectsCommand: Command = {
  name: 'projects',
  description: 'Shows my projects',
  category: 'helpful',
  execute: () => (
    <div className="mt-2 space-y-4">
      <p className="text-mocha-lavender font-bold text-lg">Projects</p>
      
      <div className="p-4 bg-mocha-surface0 rounded-md border border-mocha-surface1">
        <h3 className="text-mocha-blue font-semibold">Portfolio Website</h3>
        <p className="text-mocha-text mt-1">A terminal-style portfolio website fully developed using vibe coding.</p>
        <p className="text-mocha-yellow mt-2">Tech Stack: React, TypeScript, Tailwind CSS, Vite</p>
      </div>

      <div className="p-4 bg-mocha-surface0 rounded-md border border-mocha-surface1">
        <h3 className="text-mocha-blue font-semibold">
          <a 
            href={import.meta.env.MODE === 'development' 
              ? 'http://localhost:5175' 
              : '/DShyam3.github.io/MediaBoard/'} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            MediaBoard <span className="text-sm text-mocha-text">(Click to open website)</span>
          </a>
        </h3>
        <p className="text-mocha-text mt-1">A website made to track my media consumption fully developed using vibe coding.</p>
        <p className="text-mocha-yellow mt-2">Tech Stack: HTML, Tailwind CSS, JavaScript, Supabase</p>
      </div>

      <div className="p-4 bg-mocha-surface0 rounded-md border border-mocha-surface1">
        <h3 className="text-mocha-blue font-semibold">
          <a 
            href={import.meta.env.MODE === 'development' 
              ? 'http://localhost:5174' 
              : '/DShyam3.github.io/Travel_Tracker/'} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            Travel Tracker <span className="text-sm text-mocha-text">(Click to open website)</span>
          </a>
        </h3>
        <p className="text-mocha-text mt-1">A website made to keep track of my travelling adventures using vibe coding.</p>
        <p className="text-mocha-yellow mt-2">Tech Stack: HTML, Tailwind CSS, JavaScript, Supabase</p>
      </div>

      <div className="p-4 bg-mocha-surface0 rounded-md border border-mocha-surface1">
        <h3 className="text-mocha-blue font-semibold">Masters's Thesis</h3>
        <p className="text-mocha-text mt-1">A ROS2 based framework for control of a UR5 robotic arm through VICON's data.</p>
        <p className="text-mocha-yellow mt-2">Technologies: ROS2, UR5 Robotic Arm, VICON Motion Capture System</p>
      </div>
      
      <div className="p-4 bg-mocha-surface0 rounded-md border border-mocha-surface1">
        <h3 className="text-mocha-blue font-semibold">
          <a 
            href={import.meta.env.MODE === 'development' 
              ? '/Bachelors_Thesis.pdf' 
              : '/DShyam3.github.io/Bachelors_Thesis.pdf'} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            Bachelor's Thesis <span className="text-sm text-mocha-text">(Click to download PDF)</span>
          </a>
        </h3>
        <p className="text-mocha-text mt-1">An IoT water quality monitoring system.</p>
        <p className="text-mocha-yellow mt-2">Technologies: C/C++,ESP32, LoRa / LoRaWAN, Datacake, GPS</p>
      </div>
    </div>
        
  ),
};

export const skillsCommand: Command = {
  name: 'skills',
  description: 'Lists my technical skills',
  category: 'helpful',
  execute: () => (
    <div className="mt-2">
      <p className="text-mocha-lavender font-bold text-lg">Skills</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 mt-3">
        <div>
          <p className="text-mocha-blue font-semibold">Languages</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>C/C++</li>
            <li>Python</li>
            <li>Matlab</li>
            <li>Verilog / VHDL</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-sapphire font-semibold">Embedded Systems</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>STM32</li>
            <li>Arduino</li>
            <li>ESP32</li>
            <li>Raspberry Pi</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-peach font-semibold">Machine Learning</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>OpenCV</li>
            <li>PyTorch</li>
            <li>Scikit-learn</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-green font-semibold">Web Development</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>UI/UX Design</li>
            <li>Responsive Design</li>
            <li>Creative Development</li>
            <li>Vibe Coding</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-yellow font-semibold">AI Tools</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>ChatGPT</li>
            <li>Claude</li>
            <li>Grok</li>
            <li>DeepSeek</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-mauve font-semibold">Development Tools</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>VS Code</li>
            <li>Cursor</li>
            <li>Git / GitHub</li>
            <li>Docker</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-pink font-semibold">Robotics</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>ROS (Noetic & Humble)</li>
            <li>Digital Electronics</li>
            <li>Analog Electronics</li>
            <li>Machine Learning</li>
            <li>Machine Vision</li>
            <li>Embedded Systems</li>
            <li>Control Systems</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-teal font-semibold">Protocols</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>UART</li>
            <li>I2C</li>
            <li>SPI</li>
            <li>LoRa/LoRaWAN</li>
            <li>Bluetooth</li>
            <li>WiFi</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="text-mocha-flamingo font-semibold">Platforms & Hardware</p>
          <ul className="ml-4 list-disc text-mocha-text">
            <li>MacOS, Linux, Windows</li>
            <li>Robot Arms & Legged Robots</li>
            <li>CAD: Fusion 360 + Onshape</li>
            <li>3D Printers & Laser Cutters</li>
            <li>Bench Electronics</li>
          </ul>
        </div>
      </div>
    </div>
  ),
};

export const readmeCommand: Command = {
  name: 'readme',
  description: 'Display the welcome message',
  category: 'helpful',
  execute: () => (
    <div className="space-y-2 mt-2">
      <p className="text-mocha-lavender font-bold text-lg">Welcome to my terminal portfolio!</p>
      <p>This is a teminal-inspired website, showcasing my background and skills</p>
      <p className="mt-2 text-mocha-overlay0">Try the following commands:</p>
      <ul className="ml-4 space-y-1">
        <li><span className="text-mocha-green">help</span> - See all available commands</li>
        <li><span className="text-mocha-green">about</span> - Learn about me</li>
        <li><span className="text-mocha-green">projects</span> - View my projects</li>
        <li><span className="text-mocha-green">neofetch</span> - Display system info</li>
      </ul>
      <p className="mt-2 italic text-mocha-overlay1">Hint: Use Tab for autocompletion and use the arrow up and down keys for command history</p>
    </div>
  ),
};

export const resumeCommand: Command = {
  name: 'resume',
  description: 'View and download my resume',
  category: 'helpful',
  execute: () => {
    // Trigger download when the command is executed
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = '/resume.pdf';
      link.download = 'Dhyan_Shyam_Resume.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 500);

    return (
      <div className="mt-2 space-y-2">
        <p className="text-mocha-lavender font-bold">Resume</p>
        <div className="bg-mocha-mantle p-4 rounded-md border border-mocha-surface1">
          <p className="text-mocha-blue font-semibold mb-2">Dhyan Shyam - Robotics and AI Engineer</p>
          <div className="space-y-4">
            <div>
              <p className="text-mocha-lavender font-medium">Skills</p>
              <p className="text-mocha-text">C/C++, Python, ROS, Matlab, Embedded Systems, AI/ML, CAD</p>
            </div>
            <div>
              <p className="text-mocha-lavender font-medium">Experience</p>
              <p className="text-mocha-green">R&D Engineering Intern - Keysight Technologies (2022-2023)</p>
              <p className="text-mocha-text">Led two projects automating the testing of 5G equipment</p>
              <br />
              <p className="text-mocha-green">Tutor (2020-present)</p>
              <p className="text-mocha-text">Tutor in Maths, Physics and Chemistry for A-levels and GCSEs</p>
            </div>
            <div>
              <p className="text-mocha-lavender font-medium">Education</p>
              <p className="text-mocha-text">MSc in Robotics and Artificial Intelligence - University College London (2024-2025)</p>
              <p className="text-mocha-text">BEng in Robotics Engineering - University of Plymouth (2020-2024)</p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-mocha-overlay0 italic">
          A download of the complete resume has been initiated. If it doesn't start automatically, 
          <a href="/resume.pdf" download="DhyanShyam_Resume.pdf" className="text-mocha-blue ml-1 hover:underline">
            click here
          </a>
        </p>
      </div>
    );
  },
};

export const sourceCommand: Command = {
  name: 'source',
  description: 'View source code of this terminal',
  category: 'helpful',
  execute: () => (
    <div className="mt-2 space-y-2">
      <p className="text-mocha-lavender font-bold">Terminal Source Code</p>
      <div className="bg-mocha-mantle p-4 rounded-md border border-mocha-surface1 text-sm">
        <pre className="text-mocha-text">
{`import React, { useState, useEffect, useRef } from 'react';

const Terminal: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
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
  
  const processCommand = (cmd: string) => {
    const args = cmd.trim().split(' ');
    const command = args.shift()?.toLowerCase() || '';
    
    if (command === '') return null;
    if (commands[command]) {
      return commands[command].execute(args);
    } else {
      return (
        <p className="text-mocha-red mt-2">
          Command not found: {command}. Type 'help' to see available commands.
        </p>
      );
    }
  };
  
  // Additional code omitted for brevity...
  
  return (
    <div className="terminal-container">
      {/* Terminal UI */}
    </div>
  );
};

export default Terminal;`}
        </pre>
      </div>
      <p className="mt-2">
        The complete source code is available on GitHub:
        <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="text-mocha-blue ml-2 hover:underline">
          github.com/username/terminal-portfolio
        </a>
      </p>
    </div>
  ),
};
