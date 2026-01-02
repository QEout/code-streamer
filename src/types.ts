export interface ChatMessage {
  id: string;
  text: string;
  type: 'newbie' | 'hater' | 'pro' | 'system';
  author: string;
  donation?: number;
  messageBackground?: string; // 消息背景色
  tag?: string; // 标签
  avatar?: string; // 头像
  action?: 'openSettings' | 'openOfficialRoles' | 'openGitHubStar'; // 点击动作
}

export interface StreamState {
  totalDonations: number;
  viewerCount: number;
  lastUpdate: number;
}

export interface Persona {
  name: string;
  type: 'newbie' | 'hater' | 'pro' | 'system';
  templates: string[];
}

export interface PersonasConfig {
  version: string;
  description: string;
  personas: Persona[];
}

export interface Viewer {
  id: string;
  name: string;
  emoji: string;
  price: number;
  unlocked: boolean;
  avatar: string;
  description: string;
  sponsor?: string | null;
  prompts?: string[]; // 发言模板
  messageBackground?: string; // 发言条目背景色，默认透明
  tag?: string; // 标签
}

export interface ViewersConfig {
  version: string;
  description: string;
  viewers: Viewer[];
}


