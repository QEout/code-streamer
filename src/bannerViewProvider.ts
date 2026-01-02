import * as vscode from 'vscode';
import { Danmaku, StreamState, Viewer } from './types';
import { ViewerService } from './viewerService';

export class BannerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeStreamer.banner';
  private _view?: vscode.WebviewView;
  public onVisibilityChange?: (visible: boolean) => void;
  private viewerService?: ViewerService;
  private pendingComposer?: { visible: boolean; focus: boolean };

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public setViewerService(service: ViewerService): void {
    this.viewerService = service;
  }

  public setComposer(visible: boolean, focus: boolean = false): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'setComposer', data: { visible, focus } });
      return;
    }
    this.pendingComposer = { visible, focus };
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 监听可见性变化
    webviewView.onDidChangeVisibility(() => {
      if (this.onVisibilityChange) {
        this.onVisibilityChange(webviewView.visible);
      }
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready':
          // 初始化时发送观众列表
          if (this.viewerService) {
            this.updateViewers(this.viewerService.getViewers());
          }
          // 如果快捷键触发了“展开输入框”，在 webview ready 后再发
          if (this.pendingComposer) {
            webviewView.webview.postMessage({ type: 'setComposer', data: this.pendingComposer });
            this.pendingComposer = undefined;
          }
          break;
        case 'userChat': {
          const text = String((data as any).text ?? '').trim();
          if (!text) return;
          this.addDanmaku([
            {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              text,
              type: 'system',
              author: 'Me'
            }
          ]);
          break;
        }
        case 'openSettings':
          // 切换设置面板显示/隐藏
          if (this._view) {
            this._view.webview.postMessage({ type: 'toggleSettings' });
          }
          break;
        case 'getSettings':
          // 获取当前配置
          const config = vscode.workspace.getConfiguration('codeStreamer');
          if (this._view) {
            this._view.webview.postMessage({
              type: 'settingsData',
              data: {
                enabled: config.get<boolean>('enabled', true),
                debounceMs: config.get<number>('debounceMs', 1200),
                llmMode: config.get<string>('llm.mode', 'mock'),
                llmBaseUrl: config.get<string>('llm.baseUrl', ''),
                llmApiKey: config.get<string>('llm.apiKey', ''),
                llmModel: config.get<string>('llm.model', 'gpt-4o-mini'),
                enableOfficialSource: config.get<boolean>('enableOfficialSource', true),
                officialSourceUrl: config.get<string>('officialSourceUrl', '')
              }
            });
          }
          break;
        case 'updateSetting':
          // 更新配置
          const { key, value } = (data as any);
          const settingConfig = vscode.workspace.getConfiguration('codeStreamer');
          await settingConfig.update(key, value, vscode.ConfigurationTarget.Global);
          break;
        case 'showWarning':
          vscode.window.showWarningMessage(data.text);
          break;
      }
    });
  }

  public addDanmaku(danmaku: Danmaku[]) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'addDanmaku', data: danmaku });
    }
  }

  public updateState(state: StreamState) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'updateState', data: state });
    }
  }

  public updateViewers(viewers: Viewer[]) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'updateViewers', data: viewers });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            overflow: hidden;
        }

        /* 统一滚动条观感 */
        *::-webkit-scrollbar { width: 8px; height: 8px; }
        *::-webkit-scrollbar-thumb {
            background: color-mix(in srgb, var(--vscode-scrollbarSlider-background) 70%, transparent);
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: content-box;
        }
        *::-webkit-scrollbar-thumb:hover {
            background: color-mix(in srgb, var(--vscode-scrollbarSlider-hoverBackground) 80%, transparent);
        }
        *::-webkit-scrollbar-corner { background: transparent; }

        /* 左区：控制台 (Command Center) - 25% */
        .sidebar {
            width: 25%;
            min-width: 240px;
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 20;
        }

        /* 顶栏：核心数据 */
        .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBarSectionHeader-background);
        }

        .live-status {
            display: flex;
            align-items: center;
            font-size: 13px;
            font-weight: 800;
            color: #ff4444;
            margin-bottom: 12px;
            letter-spacing: 0.5px;
        }

        .live-dot {
            width: 8px;
            height: 8px;
            background: #ff4444;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
        }

        .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            font-weight: 600;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            color: var(--vscode-foreground);
        }

        .stat-value.money { color: #ffd700; }
        .stat-value.viewers { color: #4caf50; }

        /* 中栏：内容区 (观众列表) */
        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .section-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            padding-left: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .viewer-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .viewer-item {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }

        .viewer-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .viewer-item.active {
            background: var(--vscode-list-inactiveSelectionBackground);
            border-color: var(--vscode-focusBorder);
        }

        .viewer-avatar {
            font-size: 14px;
            margin-right: 8px;
            width: 20px;
            text-align: center;
        }

        .viewer-info {
            flex: 1;
            min-width: 0;
        }

        .viewer-name {
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .viewer-price {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .viewer-status {
            font-size: 12px;
        }

        /* 底栏：操作区 */
        .sidebar-footer {
            padding: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
        }

        .chat-actions {
            display: flex;
            gap: 8px;
        }

        .action-btn {
            flex: 1;
            padding: 6px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            text-align: center;
        }

        .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        /* 输入框 - 改为Flex布局，默认高度为0 */
        .chat-input-wrapper {
            height: 0;
            overflow: hidden;
            transition: all 0.2s ease-out;
            padding: 0 24px; /* 左右留白 */
            background: transparent;
            opacity: 0;
        }

        .chat-input-wrapper.visible {
            height: 54px; /* 足够容纳输入框的高度 */
            opacity: 1;
            padding-bottom: 16px; /* 底部留白 */
        }

        .chat-input {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            outline: none;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .chat-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        /* 右区：沉浸式直播流 - 75% */
        .stream-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            background: transparent; /* 透出编辑器背景 */
        }

        /* 设置面板 */
        .settings-panel {
            position: absolute;
            top: 0;
            right: 0;
            width: 0;
            height: 100%;
            background: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-panel-border);
            overflow: hidden;
            transition: width 0.3s ease-out;
            z-index: 100;
            display: flex;
            flex-direction: column;
        }

        .settings-panel.visible {
            width: 400px;
        }

        .settings-header {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBarSectionHeader-background);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .settings-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--vscode-foreground);
        }

        .settings-close {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 18px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.2s;
        }

        .settings-close:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .settings-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .settings-group {
            margin-bottom: 24px;
        }

        .settings-group-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .settings-item {
            margin-bottom: 16px;
        }

        .settings-label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: var(--vscode-foreground);
            margin-bottom: 6px;
        }

        .settings-description {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            line-height: 1.4;
        }

        .settings-input {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 12px;
            outline: none;
        }

        .settings-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .settings-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        .settings-checkbox input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .settings-select {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }

        .settings-select:focus {
            border-color: var(--vscode-focusBorder);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            scroll-behavior: smooth;
        }

        /* 消息样式优化 */
        .chat-message {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 6px 10px;
            border-radius: 6px;
            transition: background 0.2s;
            flex-shrink: 0; /* 关键：防止高度被挤压 */
        }

        .chat-message:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .chat-message.highlight-me {
            background: var(--vscode-list-inactiveSelectionBackground);
        }

        .chat-message.highlight-system {
            /* 系统消息样式 */
        }

        .chat-message.highlight-vip {
            /* VIP消息样式 */
        }

        .chat-avatar-img {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            background: var(--vscode-input-background);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }

        .chat-content {
            flex: 1;
            min-width: 0;
        }

        .chat-header-line {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        }

        .chat-badges {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
        }

        .badge {
            font-size: 9px;
            padding: 1px 5px;
            border-radius: 4px;
            font-weight: 700;
            text-transform: uppercase;
            line-height: 1.4;
        }

        .badge.sys { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .badge.me { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .badge.vip { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .badge.pro { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .badge.hater { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .badge.newbie { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }

        .chat-author-name {
            font-size: 12px;
            font-weight: 700;
            color: var(--vscode-foreground);
            opacity: 0.9;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .chat-text {
            font-size: 13px;
            line-height: 1.5;
            color: var(--vscode-foreground);
            opacity: 0.85;
            word-wrap: break-word;
        }

        .donation-amount {
            color: var(--vscode-foreground);
            font-weight: 500;
            font-size: 12px;
            margin-left: auto; /* 推到右侧 */
            flex-shrink: 0;    /* 防止被挤压 */
            white-space: nowrap;
        }

        .donation-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-weight: 500;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 9px;
            text-transform: uppercase;
        }

        /* 打赏特效样式 */
        .donation-highlight {
            /* 打赏消息样式 */
        }

        .donation-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 3px;
            padding: 2px 6px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        /* 全屏粒子 Canvas */
        #fx-canvas {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <!-- 左侧：Command Center -->
    <div class="sidebar">
        <div class="sidebar-header">
            <div class="live-status">
                <div class="live-dot"></div> 直播中 (LIVE)
            </div>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">累计收益</span>
                    <span id="donations" class="stat-value money">$0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">人气值</span>
                    <span id="viewers" class="stat-value viewers">0</span>
                </div>
            </div>
        </div>

        <div class="sidebar-content">
            <div class="section-title">
                <span>观众席</span>
                <span style="font-size: 10px; opacity: 0.6">在线</span>
            </div>
            <div id="viewer-list" class="viewer-list">
                <!-- 动态填充 -->
            </div>
        </div>

        <div class="sidebar-footer">
            <div class="chat-actions">
                <button id="btn-settings" class="action-btn">⚙️ 设置</button>
                <button id="btn-chat" class="action-btn">💬 发言</button>
            </div>
        </div>
    </div>

    <!-- 右侧：Immersive Stream -->
    <div class="stream-area">
        <div id="chat-messages" class="chat-messages"></div>
        <!-- 输入框移至右侧底部 -->
        <div id="chat-input-wrapper" class="chat-input-wrapper">
            <input id="chat-input" class="chat-input" placeholder="在直播间说点什么... (Enter)" />
        </div>
        <!-- 设置面板 -->
        <div id="settings-panel" class="settings-panel">
            <div class="settings-header">
                <div class="settings-title">⚙️ 设置</div>
                <button id="settings-close" class="settings-close">×</button>
            </div>
            <div class="settings-content">
                <div class="settings-group">
                    <div class="settings-group-title">基础设置</div>
                    <div class="settings-item">
                        <label class="settings-label">启用 Code Streamer</label>
                        <div class="settings-description">是否启用 Code Streamer 功能</div>
                        <label class="settings-checkbox">
                            <input type="checkbox" id="setting-enabled" />
                            <span>启用</span>
                        </label>
                    </div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-debounceMs">防抖时间（毫秒）</label>
                        <div class="settings-description">停手触发分析的防抖时间</div>
                        <input type="number" id="setting-debounceMs" class="settings-input" min="200" />
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">AI 弹幕设置</div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-llmMode">弹幕生成模式</label>
                        <div class="settings-description">mock（本地随机）或 OpenAI-compatible API</div>
                        <select id="setting-llmMode" class="settings-select">
                            <option value="mock">mock</option>
                            <option value="openaiCompatible">openaiCompatible</option>
                        </select>
                    </div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-llmBaseUrl">Base URL</label>
                        <div class="settings-description">OpenAI-compatible Base URL（例如 DeepSeek 的兼容地址）</div>
                        <input type="text" id="setting-llmBaseUrl" class="settings-input" placeholder="https://api.deepseek.com" />
                    </div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-llmApiKey">API Key</label>
                        <div class="settings-description">API Key（建议使用 Settings Sync 的 Secret Storage）</div>
                        <input type="password" id="setting-llmApiKey" class="settings-input" placeholder="sk-..." />
                    </div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-llmModel">模型名</label>
                        <div class="settings-description">模型名（OpenAI-compatible）</div>
                        <input type="text" id="setting-llmModel" class="settings-input" placeholder="gpt-4o-mini" />
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">观众列表设置</div>
                    <div class="settings-item">
                        <label class="settings-label">从官方源加载</label>
                        <div class="settings-description">是否从官方源加载观众列表（GitHub Pages）</div>
                        <label class="settings-checkbox">
                            <input type="checkbox" id="setting-enableOfficialSource" />
                            <span>启用</span>
                        </label>
                    </div>
                    <div class="settings-item">
                        <label class="settings-label" for="setting-officialSourceUrl">官方源地址</label>
                        <div class="settings-description">官方观众列表源地址（GitHub Pages URL）</div>
                        <input type="text" id="setting-officialSourceUrl" class="settings-input" placeholder="https://..." />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- 特效层 -->
    <canvas id="fx-canvas"></canvas>

    <script>
        const chatMessages = document.getElementById('chat-messages');
        const donationsEl = document.getElementById('donations');
        const viewersEl = document.getElementById('viewers');
        const viewerList = document.getElementById('viewer-list');
        const chatInputWrapper = document.getElementById('chat-input-wrapper');
        const chatInput = document.getElementById('chat-input');
        const btnChat = document.getElementById('btn-chat');
        const btnSettings = document.getElementById('btn-settings');
        const fxCanvas = document.getElementById('fx-canvas');
        
        // Canvas Setup
        let ctx = fxCanvas.getContext('2d');
        let particles = [];
        
        function resizeCanvas() {
            fxCanvas.width = window.innerWidth;
            fxCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function createExplosion(x, y, amount) {
            const count = Math.min(50, 10 + Math.floor(amount / 10)); // 根据金额决定粒子数量
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15 - 5,
                    life: 1.0,
                    color: Math.random() > 0.5 ? '#ffd700' : '#ffffff',
                    size: Math.random() * 6 + 2,
                    type: Math.random() > 0.8 ? '💰' : null // 20% 概率是金钱符号
                });
            }
            if (!isAnimating) requestAnimationFrame(animateFx);
        }

        let isAnimating = false;
        function animateFx() {
            if (particles.length === 0) {
                ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
                isAnimating = false;
                return;
            }
            
            isAnimating = true;
            ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
            
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.5; // Gravity
                p.life -= 0.015;
                
                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                
                ctx.globalAlpha = p.life;
                if (p.type) {
                    ctx.font = \`\${p.size * 3}px Arial\`;
                    ctx.fillText(p.type, p.x, p.y);
                } else {
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1.0;
            requestAnimationFrame(animateFx);
        }

        // Logic
        let vscodeApi = null;
        try { vscodeApi = acquireVsCodeApi(); } catch(e) {}

        const MAX_MESSAGES = 100;
        let viewerAvatarMap = {};

        // Update Viewers
        function updateViewerList(viewers) {
            viewerAvatarMap = {};
            viewerList.innerHTML = '';
            viewers.forEach(v => {
                viewerAvatarMap[v.name] = v.avatar;
                const div = document.createElement('div');
                div.className = 'viewer-item ' + (v.unlocked ? 'active' : '');
                div.innerHTML = \`
                    <div class="viewer-avatar">\${v.avatar}</div>
                    <div class="viewer-info">
                        <div class="viewer-name">\${v.name}</div>
                        \${!v.unlocked ? \`<div class="viewer-price">🔒 $\${v.price}</div>\` : ''}
                    </div>
                \`;
                
                // Click handler
                div.onclick = () => {
                    if (!v.unlocked) {
                        // 发送给 extension 显示系统通知，不污染聊天区
                        vscodeApi?.postMessage({ 
                            type: 'showWarning', 
                            text: '🔒 解锁 [' + v.name + '] 需要充值 $' + v.price
                        });
                    }
                };
                viewerList.appendChild(div);
            });
        }

        // Add Message
        function addMessage(d) {
            // 在添加 DOM 之前先判断是否接近底部（用于决定是否自动滚动）
            const distToBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
            const shouldAutoScroll = distToBottom < 150; // 距离底部 150px 内都算"接近底部"
            
            const div = document.createElement('div');
            let highlightClass = '';
            if (d.author === 'Me') highlightClass = 'highlight-me';
            else if (d.type === 'system') highlightClass = 'highlight-system';
            else if (['乔布斯', 'Steve Jobs', 'Linus'].some(n => d.author?.includes(n))) highlightClass = 'highlight-vip';
            
            if (d.donation) highlightClass += ' donation-highlight';

            div.className = \`chat-message \${highlightClass}\`;
            
            // 应用自定义背景色
            if (d.messageBackground) {
                div.style.background = d.messageBackground;
            }
            
            // Badges - 优先使用消息中的标签
            let badgesHtml = '';
            if (d.tag) {
                badgesHtml += \`<span class="badge">\${d.tag}</span>\`;
            } else if (d.author === 'Me') {
                badgesHtml += '<span class="badge me">主播</span>';
            } else if (d.type === 'system') {
                badgesHtml += '<span class="badge sys">系统</span>';
            } else if (d.donation) {
                badgesHtml += '<span class="donation-badge">💰 打赏</span>';
            } else if (d.type === 'hater') {
                badgesHtml += '<span class="badge hater">黑粉</span>';
            } else if (d.type === 'pro') {
                badgesHtml += '<span class="badge pro">大佬</span>';
            } else {
                badgesHtml += '<span class="badge newbie">萌新</span>';
            }

            // 优先使用消息中的头像，否则从观众映射中获取
            const avatarChar = d.avatar || viewerAvatarMap[d.author] || getAvatarFallback(d.author);

            // 打赏消息特殊布局
            const donationTag = d.donation ? \`
                <div class="donation-tag">
                    <span>💰</span>
                    <span>打赏 $\${d.donation.toLocaleString()}</span>
                </div>
            \` : '';

            div.innerHTML = \`
                <div class="chat-avatar-img">\${avatarChar}</div>
                <div class="chat-content">
                    <div class="chat-header-line">
                        <div class="chat-badges">\${badgesHtml}</div>
                        <div class="chat-author-name">\${d.author || '匿名'}</div>
                    </div>
                    <div class="chat-text">\${d.text}</div>
                    \${donationTag}
                </div>
            \`;

            chatMessages.appendChild(div);
            
            // Trigger FX if donation
            if (d.donation) {
                // Center explosion
                createExplosion(window.innerWidth / 2 + 100, window.innerHeight / 2, d.donation);
            }

            // Cleanup
            if (chatMessages.children.length > MAX_MESSAGES) {
                chatMessages.removeChild(chatMessages.firstChild);
            }

            // 关键修复：等待 DOM 更新后再滚动，使用 requestAnimationFrame 确保布局已计算
            if (shouldAutoScroll) {
                requestAnimationFrame(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                });
            }
        }

        function getAvatarFallback(name) {
            if (!name) return '👤';
            if (name === 'Me') return '🧑';
            if (name === 'System' || name === '系统') return '⚡';
            if (name.includes('Jobs') || name.includes('乔布斯')) return '🍎';
            if (name.includes('Linus') || name.includes('林纳斯')) return '🐧';
            return '👤';
        }

        // Handle Messages
        window.addEventListener('message', event => {
            const msg = event.data;
            switch (msg.type) {
                case 'addDanmaku': msg.data.forEach(addMessage); break;
                case 'updateState': 
                    donationsEl.innerText = '$' + msg.data.totalDonations.toLocaleString();
                    viewersEl.innerText = msg.data.viewerCount.toLocaleString();
                    break;
                case 'updateViewers': updateViewerList(msg.data); break;
                case 'setComposer':
                    toggleChatInput(msg.data.visible, msg.data.focus);
                    break;
                case 'toggleSettings':
                    toggleSettings();
                    break;
                case 'settingsData':
                    // 更新设置面板的值
                    const data = msg.data;
                    settingEnabled.checked = data.enabled;
                    settingDebounceMs.value = data.debounceMs;
                    settingLlmMode.value = data.llmMode;
                    settingLlmBaseUrl.value = data.llmBaseUrl;
                    settingLlmApiKey.value = data.llmApiKey;
                    settingLlmModel.value = data.llmModel;
                    settingEnableOfficialSource.checked = data.enableOfficialSource;
                    settingOfficialSourceUrl.value = data.officialSourceUrl;
                    break;
            }
        });

        // Chat Input Logic
        function toggleChatInput(show, focus) {
            if (show) {
                chatInputWrapper.classList.add('visible');
                // 延迟滚动，确保 flex 布局调整后再滚到底
                setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 150);
                if (focus) setTimeout(() => chatInput.focus(), 50);
            } else {
                chatInputWrapper.classList.remove('visible');
                chatInput.blur();
            }
        }

        btnChat.onclick = () => {
            const isVisible = chatInputWrapper.classList.contains('visible');
            toggleChatInput(!isVisible, true);
        };

        // Settings Panel
        const settingsPanel = document.getElementById('settings-panel');
        const settingsClose = document.getElementById('settings-close');
        let settingsVisible = false;

        function toggleSettings() {
            settingsVisible = !settingsVisible;
            if (settingsVisible) {
                settingsPanel.classList.add('visible');
                // 请求当前配置
                if (vscodeApi) {
                    vscodeApi.postMessage({ type: 'getSettings' });
                }
            } else {
                settingsPanel.classList.remove('visible');
            }
        }

        btnSettings.onclick = () => {
            if (vscodeApi) {
                vscodeApi.postMessage({ type: 'openSettings' });
            } else {
                toggleSettings();
            }
        };

        settingsClose.onclick = () => {
            toggleSettings();
        };

        // 设置项元素
        const settingEnabled = document.getElementById('setting-enabled');
        const settingDebounceMs = document.getElementById('setting-debounceMs');
        const settingLlmMode = document.getElementById('setting-llmMode');
        const settingLlmBaseUrl = document.getElementById('setting-llmBaseUrl');
        const settingLlmApiKey = document.getElementById('setting-llmApiKey');
        const settingLlmModel = document.getElementById('setting-llmModel');
        const settingEnableOfficialSource = document.getElementById('setting-enableOfficialSource');
        const settingOfficialSourceUrl = document.getElementById('setting-officialSourceUrl');

        // 更新设置值的函数
        function updateSettingValue(key, value) {
            if (vscodeApi) {
                vscodeApi.postMessage({ type: 'updateSetting', key, value });
            }
        }

        // 绑定设置项事件
        settingEnabled.addEventListener('change', (e) => {
            updateSettingValue('enabled', e.target.checked);
        });

        settingDebounceMs.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 200) {
                updateSettingValue('debounceMs', value);
            }
        });

        settingLlmMode.addEventListener('change', (e) => {
            updateSettingValue('llm.mode', e.target.value);
        });

        settingLlmBaseUrl.addEventListener('change', (e) => {
            updateSettingValue('llm.baseUrl', e.target.value);
        });

        settingLlmApiKey.addEventListener('change', (e) => {
            updateSettingValue('llm.apiKey', e.target.value);
        });

        settingLlmModel.addEventListener('change', (e) => {
            updateSettingValue('llm.model', e.target.value);
        });

        settingEnableOfficialSource.addEventListener('change', (e) => {
            updateSettingValue('enableOfficialSource', e.target.checked);
        });

        settingOfficialSourceUrl.addEventListener('change', (e) => {
            updateSettingValue('officialSourceUrl', e.target.value);
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const text = chatInput.value.trim();
                if (text) {
                    vscodeApi?.postMessage({ type: 'userChat', text });
                    // 本地立即回显优化体验
                    if (!vscodeApi) addMessage({ id: Date.now(), text, author: 'Me', type: 'system' });
                    chatInput.value = '';
                    toggleChatInput(false); // 发完即走
                }
            }
            if (e.key === 'Escape') toggleChatInput(false);
        });

        // Init
        if (vscodeApi) {
            vscodeApi.postMessage({ type: 'ready' });
            // 直播开启欢迎语
            addMessage({
                id: 'welcome',
                type: 'system',
                author: '系统',
                text: '🔴 直播已开启！Start coding to impress your audience!'
            });
        }

    </script>
</body>
</html>`;
  }
}
