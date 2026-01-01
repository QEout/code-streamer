export interface Danmaku {
  id: string;
  text: string;
  type: 'newbie' | 'hater' | 'pro' | 'system' | 'sc';
  author: string;
  avatar?: string;
  donation?: number;
}

export interface Persona {
  id: string;
  name: string;
  role: 'newbie' | 'hater' | 'pro';
  description: string;
  avatar: string;
  price: number;
  prompt: string;
  unlocked: boolean;
}

export interface StreamState {
  totalDonations: number;
  viewerCount: number;
  lastUpdate: number;
  activePersonas: string[]; // IDs of hired personas watching
  unlockedPersonas: string[];
}
