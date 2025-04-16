import { Apple, Monitor, Laptop, Terminal as TerminalIcon } from 'lucide-react';

/**
 * Get information about the user's system from browser APIs
 */
export const getSystemInfo = async () => {
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    const browser = 
      ua.includes('Chrome') ? 'Google Chrome' :
      ua.includes('Firefox') ? 'Mozilla Firefox' :
      ua.includes('Safari') ? 'Safari' :
      ua.includes('Edge') ? 'Microsoft Edge' :
      ua.includes('MSIE') || ua.includes('Trident/') ? 'Internet Explorer' :
      'Unknown Browser';
    
    return browser;
  };

  const getOSInfo = () => {
    const ua = navigator.userAgent.toLowerCase();
    
    // Improved iOS detection - checking for iPad more thoroughly
    // iPadOS 13+ reports as Mac in user agent, so we need additional checks
    const isIpad = ua.includes('ipad') || 
      (ua.includes('macintosh') && 'ontouchend' in document);
    
    if (ua.includes('iphone') || ua.includes('ipod') || isIpad) {
      return { name: isIpad ? 'iPadOS' : 'iOS', icon: 'apple' };
    } else if (ua.includes('mac') || ua.includes('darwin')) {
      return { name: 'macOS', icon: 'apple' };
    } else if (ua.includes('win')) {
      return { name: 'Windows', icon: 'windows' };
    } else if (ua.includes('android')) {
      return { name: 'Android', icon: 'android' };
    } else if (ua.includes('linux') || ua.includes('ubuntu') || ua.includes('debian')) {
      return { name: 'Linux', icon: 'linux' };
    } else {
      return { name: 'Unknown OS', icon: 'monitor' };
    }
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent.toLowerCase();
    
    // Improved iPad detection
    const isIpad = ua.includes('ipad') || 
      (ua.includes('macintosh') && 'ontouchend' in document);
      
    if (isIpad) {
      return 'iPad';
    } else if (ua.includes('iphone')) {
      return 'iPhone';
    } else if (ua.includes('android') && ua.includes('mobile')) {
      return 'Android Phone';
    } else if (ua.includes('android')) {
      return 'Android Device';
    } else if (ua.includes('windows') && (ua.includes('phone') || ua.includes('mobile'))) {
      return 'Windows Phone';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) {
      return 'Mac';
    } else if (ua.includes('windows')) {
      return 'PC';
    } else if (ua.includes('linux')) {
      return 'Linux Machine';
    } else {
      return 'Unknown Device';
    }
  };

  const getLocation = async () => {
    try {
      const response = await fetch('https://ip-api.com/json/');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Location API response:', data); // Debug log
      
      if (data.status === 'success' && data.city && data.country) {
        return `${data.city}, ${data.country}`;
      } else {
        console.warn('Incomplete location data:', data); // Debug log
        throw new Error('Location data incomplete');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      // Fallback to timezone-based approximation
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const region = timezone.split('/').pop()?.replace(/_/g, ' ') || 'Unknown';
      return region;
    }
  };

  const getLastLogin = () => {
    // Format current time in 24-hour format with timezone
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Get timezone abbreviation
    const timezone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).format(now).split(' ').pop();
    
    return `${timeString} ${timezone}`;
  };

  return {
    os: getOSInfo(),
    browser: getBrowserInfo(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenResolution: `${window.screen.width} x ${window.screen.height}`,
    platform: navigator.platform,
    deviceType: getDeviceInfo(),
    location: await getLocation(),
    lastLogin: getLastLogin()
  };
};

/**
 * Get ASCII art representation for different operating systems
 */
export const getOSAsciiArt = (osType: string) => {
  // Return ASCII art based on OS type
  switch (osType.toLowerCase()) {
    case 'apple':
    case 'macos':
      return `
                    'c.           
                 ,xNMM.           
               .OMMMMo            
               OMMM0,             
     .;loddo:' loolloddol;.       
   cKMMMMMMMMMMNWMMMMMMMMMM0:     
 .KMMMMMMMMMMMMMMMMMMMMMMMWd.     
 XMMMMMMMMMMMMMMMMMMMMMMMX.       
;MMMMMMMMMMMMMMMMMMMMMMMM:        
:MMMMMMMMMMMMMMMMMMMMMMMM:        
.MMMMMMMMMMMMMMMMMMMMMMMMX.       
 kMMMMMMMMMMMMMMMMMMMMMMMMWd.     
 .XMMMMMMMMMMMMMMMMMMMMMMMMMMk    
  .XMMMMMMMMMMMMMMMMMMMMMMMMK.    
    kMMMMMMMMMMMMMMMMMMMMMMd      
     ;KMMMMMMMWXXWMMMMMMMk.       
       .cooc,.    .,coo:.         
      `;
    case 'windows':
      return `
                                  
        ,.=:!!t3Z3z.,             
       :tt:::tt333EE3             
       Et:::ztt33EEEL @Ee.,      .
      ;tt:::tt333EE7 ;EEEEEEttt::.
     :Et:::zt333EEQ. $EEEEEttt:;. 
     it::::tt333EEF @EEEEEEtt::.  
    ;3=*^\`\`'*4EEV :EEEEEEttt::.   
    ,.=::::!t=., \`\` @EEEEEEtttt::. 
   ;::::::::zt33)   "4EEEtttji:. 
  :t::::::::tt33.:Z3z..  \`\` ,..g.
  i::::::::zt33F AEEEtttt::::ztF 
 ;:::::::::t33V ;EEEttttt::::t3  
 E::::::::zt33L @EEEtttt::::z3F  
{3=*^\`\`\`'*4E3) ;EEEtttt:::::tZ\`  
             \`\` :EEEEtttt::::z7   
                 "VEzjt:;;z>*\`    
      `;
    case 'linux':
    case 'ubuntu':
      return `
             .-.           
       .-''\`\`\`\`\`\`''-.       
    .-'              '-.    
   /                    \\   
  ;                      ;  
  |                      |  
  |                      |  
  ;                      ;  
  \\                      /   
   \\.                  ./    
     '''--........--'''      
      `;
    case 'android':
      return `
         -o          o-        
          +hydNNNNdyh+         
        +mMMMMMMMMMMMMm+       
       dMMm\:++::/++:/mMMd     
      hMMs              sMM    
     +MM/                /MM+  
     hMN                  NMh  
     MMo                  oMM  
     MMo                  oMM  
     hMN                  NMh  
     +MM/                /MM+  
      hMMs              sMM    
       dMMm\:++::/++:/mMMd     
        +mMMMMMMMMMMMMm+       
          +hydNNNNdyh+         
         -o          o-        
      `;
    default:
      return `
       _,met$$$$$gg.           
    ,g$$$$$$$$$$$$$$$P.        
  ,g$$P"        """Y$$.".      
 ,$$P'              \`$$$.      
',$$P       ,ggs.     \`$$b:    
\`d$$'     ,$P"'   .    $$$     
 $$P      d$'     ,    $$P     
 $$:      $$.   -    ,d$$'     
 $$;      Y$b._   _,d$P'       
 Y$$.    \`.\`"Y$$$$P"'          
 \`$$b      "-.__               
  \`Y$$                         
   \`Y$$.                       
     \`$$b.                     
       \`Y$$b.                  
          \`"Y$b._              
              \`""              
      `;
  }
};

/**
 * Determine terminal window controls based on OS
 */
export const getTerminalControls = () => {
  const ua = navigator.userAgent.toLowerCase();
  let controlsPosition = 'left';
  let controlsStyle = 'circles'; // circles (macOS/Linux), buttons (Windows)
  
  if (ua.includes('win')) {
    controlsPosition = 'right';
    controlsStyle = 'buttons';
  } else if (ua.includes('linux') && !ua.includes('android')) {
    // Some Linux distros have buttons on right
    controlsPosition = 'right';
    controlsStyle = 'circles';
  }
  
  return { position: controlsPosition, style: controlsStyle };
};
