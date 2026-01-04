import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Viewer } from './types';

export class ViewerService {
  private viewers: Viewer[] = [];
  private configPath: string;
  private context: vscode.ExtensionContext;
  private unlockedViewerIds: Set<string> = new Set();

  private loadPromise: Promise<void>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const extensionPath = context.extensionPath;
    this.configPath = path.join(extensionPath, 'prompts', 'viewers.json');
    
    // Load persisted unlocked viewers
    const unlocked = this.context.globalState.get<string[]>('unlockedViewers', []);
    this.unlockedViewerIds = new Set(unlocked);

    this.loadPromise = this.loadViewers();
  }

  public async waitForLoad(): Promise<void> {
    await this.loadPromise;
  }

  private async loadViewers(): Promise<void> {
    try {
      // 仅从本地加载（官方源功能已移除）
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const config: any = JSON.parse(content);
        const viewers = Array.isArray(config?.viewers) ? config.viewers : [];
        this.viewers = viewers.map((v: Viewer) => this.normalizeViewer(v));
      } else {
        this.viewers = this.getDefaultViewers();
      }
    } catch (error) {
      console.error('Failed to load viewers:', error);
      this.viewers = this.getDefaultViewers();
    }
  }

  public checkUnlock(totalDonations: number): Viewer[] {
    const newlyUnlocked: Viewer[] = [];
    let stateChanged = false;

    this.viewers.forEach(v => {
      // 这里的 v 是内存中的对象，可以直接修改
      if (!v.unlocked && v.price > 0 && totalDonations >= v.price) {
        v.unlocked = true;
        this.unlockedViewerIds.add(v.id);
        newlyUnlocked.push(v);
        stateChanged = true;
      }
    });

    if (stateChanged) {
      this.context.globalState.update('unlockedViewers', Array.from(this.unlockedViewerIds));
    }

    return newlyUnlocked;
  }

  public getViewers(): Viewer[] {
    return this.viewers;
  }

  public async refresh(): Promise<void> {
    await this.loadViewers();
  }

  private getDefaultViewers(): Viewer[] {
    return [
      {
        id: 'viewer_anonymous',
        name: '路人甲',
        emoji: '🔘',
        price: 0,
        unlocked: true,
        avatar: '👤',
        description: '免费观众',
        prompts: ['这个代码看起来不错', '学到了', '666'],
        messageBackground: '',
        tag: '萌新'
      },
      {
        id: 'viewer_linus',
        name: '林纳斯',
        emoji: '⚪',
        price: 2000,
        unlocked: false,
        avatar: '🐧',
        description: 'Linux 和 Git 之父',
        prompts: ['这个实现方式可以优化一下', '建议考虑性能问题', '代码结构不错，但可以更简洁'],
        messageBackground: '',
        tag: '大佬'
      },
      {
        id: 'viewer_jobs',
        name: '乔布斯',
        emoji: '✅',
        price: 1000,
        unlocked: false,
        avatar: '🍎',
        description: 'Apple 创始人',
        prompts: ['设计很简洁', '用户体验很重要', '保持简单'],
        messageBackground: '',
        tag: 'VIP'
      }
    ];
  }

  private normalizeViewer(viewer: Viewer): Viewer {
    const normalized = {
      ...viewer,
      prompts: Array.isArray((viewer as any).prompts) ? (viewer as any).prompts : [],
      messageBackground: (viewer as any).messageBackground ?? '',
      tag: (viewer as any).tag ?? undefined
    };

    // Apply unlock status from global state
    if (this.unlockedViewerIds.has(normalized.id)) {
      normalized.unlocked = true;
    }
    
    return normalized;
  }
}

