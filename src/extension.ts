import * as vscode from 'vscode';
import { BannerViewProvider } from './bannerViewProvider';
import { AIService } from './aiService';
import { ViewerService } from './viewerService';
import { StreamState } from './types';

export function activate(context: vscode.ExtensionContext) {
  const bannerProvider = new BannerViewProvider(context.extensionUri);
  const viewerService = new ViewerService(context);
  const aiService = new AIService(viewerService);

  let totalDonations = context.globalState.get<number>('totalDonations', 0);
  let viewerCount = 1205 + Math.floor(Math.random() * 200);
  let debounceTimer: NodeJS.Timeout | undefined;
  let isPanelVisible = true;
  let pendingImportantMessage: string | null = null;

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(BannerViewProvider.viewType, bannerProvider)
  );

  // 状态栏项 - "不死图腾"
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  statusBarItem.command = 'codeStreamer.focus';
  statusBarItem.tooltip = '点击切换回 Code Streamer 面板';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  let statusBarBlinkTimer: NodeJS.Timeout | undefined;

  // 更新状态栏显示
  const updateStatusBar = (blink: boolean = false) => {
    statusBarItem.text = `🔴 Live: $${totalDonations.toLocaleString()}`;
    
    if (blink) {
      // 清除之前的闪烁
      if (statusBarBlinkTimer) {
        clearInterval(statusBarBlinkTimer);
      }
      
      // 闪烁红色
      let isRed = false;
      statusBarBlinkTimer = setInterval(() => {
        isRed = !isRed;
        statusBarItem.backgroundColor = isRed 
          ? new vscode.ThemeColor('statusBarItem.errorBackground')
          : undefined;
      }, 500);
      
      // 3秒后停止闪烁
      setTimeout(() => {
        if (statusBarBlinkTimer) {
          clearInterval(statusBarBlinkTimer);
          statusBarBlinkTimer = undefined;
        }
        statusBarItem.backgroundColor = undefined;
      }, 3000);
    } else {
      statusBarItem.backgroundColor = undefined;
    }
  };
  updateStatusBar();

  // 监听面板可见性变化
  const updatePanelVisibility = (visible: boolean) => {
    isPanelVisible = visible;
    if (!visible && pendingImportantMessage) {
      // 面板被切到后台，显示提醒
      vscode.window.showInformationMessage(
        `💬 ${pendingImportantMessage}`,
        '查看直播间'
      ).then(selection => {
        if (selection === '查看直播间') {
          vscode.commands.executeCommand('codeStreamer.focus');
        }
      });
      pendingImportantMessage = null;
    }
  };

  // 注册命令：切换回Code Streamer面板
  context.subscriptions.push(
    vscode.commands.registerCommand('codeStreamer.focus', () => {
      vscode.commands.executeCommand('codeStreamer.banner.focus');
    })
  );

  // 监听webview可见性
  bannerProvider.onVisibilityChange = updatePanelVisibility;

  // Initial state update
  setInterval(() => {
    viewerCount += Math.floor(Math.random() * 5) - 2;
    if (viewerCount < 100) viewerCount = 100;
    bannerProvider.updateState({ totalDonations, viewerCount, lastUpdate: Date.now() });
    updateStatusBar();
  }, 5000);

  let lastTriggerTime = 0;
  const COOLDOWN_NORMAL = 15000;
  const COOLDOWN_HIGH = 5000;

  // 核心触发函数
  const triggerAI = async (reason: 'idle' | 'save' | 'paste' | 'error', priority: 'normal' | 'high') => {
    const now = Date.now();
    const cooldown = priority === 'high' ? COOLDOWN_HIGH : COOLDOWN_NORMAL;
    
    if (now - lastTriggerTime < cooldown) {
      return; // Cooldown active
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Sliding Window: 光标前30行 + 后5行
    const cursorLine = editor.selection.active.line;
    const startLine = Math.max(0, cursorLine - 30);
    const endLine = Math.min(editor.document.lineCount - 1, cursorLine + 5);
    const range = new vscode.Range(startLine, 0, endLine, 1000);
    const contextCode = editor.document.getText(range);
    const language = editor.document.languageId;

    if (contextCode.length < 10) return;

    lastTriggerTime = now;
    console.log(`[Code Streamer] Trigger: ${reason}, Priority: ${priority}`);

    // Config check
    const cfg = vscode.workspace.getConfiguration('codeStreamer');
    const apiKey = String(cfg.get<string>('llm.apiKey', '') || '').trim();
    const baseUrl = String(cfg.get<string>('llm.baseUrl', '') || '').trim();

    if (!apiKey || !baseUrl) {
      // 仅在非 idle 触发时提示，避免打扰
      if (reason !== 'idle') {
        vscode.window.showInformationMessage('Code Streamer: 请配置 API Key 以启用 AI 弹幕', '打开设置')
          .then(s => {
            if (s === '打开设置') {
              vscode.commands.executeCommand('codeStreamer.focus');
              bannerProvider.showSettings();
            }
          });
      }
      return;
    }

    try {
      const messages = await aiService.generateMessages(contextCode, reason, language);
      
      // Process messages
      messages.forEach(c => {
        if (c.donation) totalDonations += c.donation;
        if (!c.avatar || !c.tag) {
          const viewers = viewerService.getViewers();
          const viewer = viewers.find(v => v.name === c.author || v.name.includes(c.author) || c.author.includes(v.name));
          if (viewer) {
            if (!c.avatar) c.avatar = viewer.avatar;
            if (!c.tag) c.tag = viewer.tag;
            if (!c.messageBackground) c.messageBackground = viewer.messageBackground || undefined;
          }
        }
      });

      context.globalState.update('totalDonations', totalDonations);
      bannerProvider.updateState({ totalDonations, viewerCount, lastUpdate: Date.now() });
      bannerProvider.addMessages(messages);
      updateStatusBar();

      // Check Viewer Unlock
      const unlockedViewers = viewerService.checkUnlock(totalDonations);
      if (unlockedViewers.length > 0) {
        bannerProvider.updateViewers(viewerService.getViewers());
        unlockedViewers.forEach(v => {
          bannerProvider.addMessages([{
            id: `unlock_${v.id}`,
            type: 'system',
            author: '系统',
            text: `🎉 新观众解锁：${v.name} (${v.description})`,
            messageBackground: 'linear-gradient(90deg, #ffd700 0%, #fdb931 100%)'
          }]);
          vscode.window.showInformationMessage(`Code Streamer: 新观众 ${v.name} 已解锁！`);
        });
      }

      // Check Star Request
      const hasAskedForStar = context.globalState.get<boolean>('hasAskedForStar', false);
      if (!hasAskedForStar && totalDonations >= 1000) {
        context.globalState.update('hasAskedForStar', true);
        bannerProvider.addMessages([{
          id: 'star_req',
          type: 'system',
          author: '系统',
          text: '看来你已经是个成熟的主播了！去 GitHub 给作者点个 Star 鼓励一下吧？',
          action: 'openGitHubStar'
        }]);
      }

      // Check Important Messages
      const importantAuthors = ['乔布斯', 'Steve Jobs', 'Linus', 'Linus Torvalds'];
      const importantComment = messages.find(c => c.author && importantAuthors.some(a => c.author!.includes(a)));
      if (importantComment && !isPanelVisible) {
        pendingImportantMessage = `${importantComment.author}: ${importantComment.text}`;
        updateStatusBar(true);
      }

    } catch (error: any) {
      console.error('AI Request Failed:', error);
      if (reason === 'save' || reason === 'error') {
         // 仅高优先级错误提示
         vscode.window.showWarningMessage(`Code Streamer AI Error: ${error?.message || 'Unknown'}`);
      }
    }
  };

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
    if (debounceTimer) clearTimeout(debounceTimer);

    // 1. Paste Detection
    const isPaste = event.contentChanges.some(c => c.text.length > 50 && c.text.includes('\n'));
    if (isPaste) {
      triggerAI('paste', 'high'); // Paste is immediate but respects high cooldown
      return;
    }

    // 2. Idle Detection (Debounce)
    // 默认防抖时间加长到 3000ms
    const config = vscode.workspace.getConfiguration('codeStreamer');
    const debounceMs = Math.max(config.get<number>('debounceMs', 3000), 3000);

    debounceTimer = setTimeout(() => {
      triggerAI('idle', 'normal');
    }, debounceMs);
  });

  // 3. Save Detection
  const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(() => {
    triggerAI('save', 'high');
  });

  // 4. Error Detection
  let lastErrorTrigger = 0;
  const onDidChangeDiagnostics = vscode.languages.onDidChangeDiagnostics(e => {
    const now = Date.now();
    if (now - lastErrorTrigger < 30000) return; // Error cooldown 30s

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const hasError = diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error);

    if (hasError) {
      lastErrorTrigger = now;
      triggerAI('error', 'high');
    }
  });

  context.subscriptions.push(onDidChangeTextDocument);
  context.subscriptions.push(onDidSaveTextDocument);
  context.subscriptions.push(onDidChangeDiagnostics);


  // Command to manually start or trigger
  context.subscriptions.push(
    vscode.commands.registerCommand('codeStreamer.start', () => {
      vscode.commands.executeCommand('codeStreamer.banner.focus');
      vscode.window.showInformationMessage('Code Streamer is now live! 🚀');
    })
  );

  // Command to refresh viewers from official source
  context.subscriptions.push(
    vscode.commands.registerCommand('codeStreamer.refreshViewers', async () => {
      await viewerService.refresh();
      vscode.window.showInformationMessage('观众列表已刷新！');
    })
  );

  // Command: 打开聊天输入（尽量不打扰写代码，用快捷键/点击触发）
  context.subscriptions.push(
    vscode.commands.registerCommand('codeStreamer.openChatInput', async () => {
      await vscode.commands.executeCommand('codeStreamer.banner.focus');
      // 让 webview 展开输入框并聚焦（如果 view 尚未 ready，会在 ready 后补发）
      bannerProvider.setComposer(true, true);
    })
  );

  // 将 viewerService 传递给 bannerProvider
  bannerProvider.setViewerService(viewerService);

  // 等待观众列表加载完成后更新 UI
  viewerService.waitForLoad().then(() => {
    bannerProvider.updateViewers(viewerService.getViewers());
  });

  // 定期刷新观众列表（每小时）
  setInterval(async () => {
    await viewerService.refresh();
    bannerProvider.updateViewers(viewerService.getViewers());
  }, 3600000);
}

export function deactivate() {}

