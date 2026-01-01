export interface Danmaku {
  id: string;
  text: string;
  type: 'newbie' | 'hater' | 'pro' | 'system';
  author: string;
  donation?: number;
}

export interface StreamState {
  totalDonations: number;
  viewerCount: number;
  lastUpdate: number;
}

