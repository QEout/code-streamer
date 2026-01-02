import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Viewer, ViewersConfig } from './types';

export class ViewerService {
  private viewers: Viewer[] = [];
  private configPath: string;
  private officialSource: string = 'https://your-username.github.io/code-streamer/viewers.json';
  private context: vscode.ExtensionContext;

  private loadPromise: Promise<void>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const extensionPath = context.extensionPath;
    this.configPath = path.join(extensionPath, 'prompts', 'viewers.json');
    this.loadPromise = this.loadViewers();
  }

  public async waitForLoad(): Promise<void> {
    await this.loadPromise;
  }

  private async loadViewers(): Promise<void> {
    try {
      // 先尝试从本地加载
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const config: ViewersConfig = JSON.parse(content);
        this.viewers = config.viewers || [];
        this.officialSource = config.officialSource || this.officialSource;
      } else {
        this.viewers = this.getDefaultViewers();
      }

      // 尝试从官方源加载（异步，不阻塞）
      this.loadFromOfficialSource().catch(err => {
        console.log('Failed to load from official source, using local:', err);
      });
    } catch (error) {
      console.error('Failed to load viewers:', error);
      this.viewers = this.getDefaultViewers();
    }
  }

  private async loadFromOfficialSource(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('codeStreamer');
      const enableOfficialSource = config.get<boolean>('enableOfficialSource', true);
      
      if (!enableOfficialSource) {
        return;
      }

      // 从配置中读取官方源地址，如果没有则使用默认值
      const customSource = config.get<string>('officialSourceUrl', '');
      const sourceUrl = customSource || this.officialSource;

      const response = await fetch(sourceUrl, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const remoteConfig: ViewersConfig = await response.json();
      
      // 合并远程和本地配置：远程优先，但保留本地已解锁的观众
      const localUnlocked = this.viewers.filter(v => v.unlocked).map(v => v.id);
      const mergedViewers = remoteConfig.viewers.map(remoteViewer => {
        const localViewer = this.viewers.find(v => v.id === remoteViewer.id);
        return {
          ...remoteViewer,
          // 如果本地已解锁，保持解锁状态
          unlocked: localUnlocked.includes(remoteViewer.id) ? true : remoteViewer.unlocked
        };
      });

      // 添加本地独有的观众（不在远程列表中的）
      const remoteIds = new Set(remoteConfig.viewers.map(v => v.id));
      const localOnly = this.viewers.filter(v => !remoteIds.has(v.id));
      
      this.viewers = [...mergedViewers, ...localOnly];
      
      console.log('Loaded viewers from official source');
    } catch (error) {
      // 静默失败，使用本地配置
      console.log('Could not load from official source:', error);
    }
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
}

