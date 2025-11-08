/**
 * @fileOverview TypeScript palette constants for transcript rendering
 * 
 * Use these constants in:
 * - PDF generation (jsPDF doesn't read CSS vars)
 * - SSR contexts where CSS vars aren't available
 * - Server-side rendering
 * - Email/report generation
 * 
 * Keep in sync with src/styles/transcript.css
 */

export const TX_COLORS = {
  // Agent (company representative)
  agentBg: '#4f46e5',        // indigo-600
  agentFg: '#ffffff',
  agentBorder: 'rgba(79, 70, 229, 0.2)',
  agentAvatarBg: '#eef2ff',  // indigo-50
  agentAvatarFg: '#4338ca',  // indigo-700
  
  // User (customer/caller)
  userBg: '#0f172a',         // slate-900
  userFg: '#ffffff',
  userBorder: 'rgba(15, 23, 42, 0.2)',
  userAvatarBg: '#f1f5f9',   // slate-100
  userAvatarFg: '#0f172a',   // slate-900
  
  // System events
  systemBg: '#6b7280',       // gray-500
  systemFg: '#ffffff',
  
  // Timestamps
  timeBg: 'rgba(0, 0, 0, 0.35)',
  timeFg: '#ffffff',
  
  // Dark mode variants (for PDF dark theme support)
  dark: {
    agentBg: '#6366f1',      // indigo-500
    agentAvatarBg: '#312e81', // indigo-900
    agentAvatarFg: '#c7d2fe', // indigo-200
    userBg: '#1f2937',       // gray-800
    userAvatarBg: '#374151',  // gray-700
    userAvatarFg: '#e5e7eb',  // gray-200
  },
} as const;

/**
 * Get color for a speaker role
 * @param role - 'AGENT' | 'USER' | 'SYSTEM'
 * @param property - 'bg' | 'fg' | 'border' | 'avatarBg' | 'avatarFg'
 * @param darkMode - Whether to use dark mode colors
 * @returns Hex color string
 */
export function getTxColor(
  role: 'AGENT' | 'USER' | 'SYSTEM',
  property: 'bg' | 'fg' | 'border' | 'avatarBg' | 'avatarFg',
  darkMode = false
): string {
  if (role === 'SYSTEM') {
    return property === 'bg' ? TX_COLORS.systemBg : TX_COLORS.systemFg;
  }
  
  const roleKey = role === 'AGENT' ? 'agent' : 'user';
  const propKey = property === 'bg' ? 'Bg' : 
                  property === 'fg' ? 'Fg' :
                  property === 'border' ? 'Border' :
                  property === 'avatarBg' ? 'AvatarBg' : 'AvatarFg';
  
  const fullKey = `${roleKey}${propKey}` as keyof typeof TX_COLORS;
  
  // Use dark mode variant if available and requested
  if (darkMode && property in TX_COLORS.dark) {
    const darkKey = `${roleKey}${propKey}` as keyof typeof TX_COLORS.dark;
    return TX_COLORS.dark[darkKey] || TX_COLORS[fullKey];
  }
  
  return TX_COLORS[fullKey];
}

/**
 * Convert rgba string to hex (for PDF compatibility)
 * @param rgba - rgba(r, g, b, a) string
 * @returns Hex color string
 */
export function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return '#000000';
  
  const [, r, g, b] = match;
  const toHex = (n: string) => parseInt(n).toString(16).padStart(2, '0');
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
