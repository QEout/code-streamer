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

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const config = vscode.workspace.getConfiguration('codeStreamer');
    const debounceMs = config.get<number>('debounceMs', 1200);

    debounceTimer = setTimeout(async () => {
      const content = event.document.getText();
      // Only analyze if content is not too short
      if (content.length < 10) return;

      console.log('Code Streamer: Analyzing code change...');
      // 未配置：不刷聊天区，只走 VSCode 通知
      const cfg = vscode.workspace.getConfiguration('codeStreamer');
      const apiKey = String(cfg.get<string>('llm.apiKey', '') || '').trim();
      const baseUrl = String(cfg.get<string>('llm.baseUrl', '') || '').trim();
      if (!apiKey || !baseUrl) {
        vscode.window
          .showErrorMessage('未配置 AI 弹幕：请在「⚙️ 设置」中填写 Base URL 与 API Key。', '打开设置')
          .then(sel => {
            if (sel === '打开设置') {
              vscode.commands.executeCommand('codeStreamer.focus');
              bannerProvider.showSettings();
            }
          });
        return;
      }

      let messages;
      try {
        messages = await aiService.generateMessages(content);
      } catch (error: any) {
        const msg = typeof error?.message === 'string' ? error.message : '请求失败';
        vscode.window
          .showErrorMessage(`AI 请求失败：${msg}`, '打开设置')
          .then(sel => {
            if (sel === '打开设置') {
              vscode.commands.executeCommand('codeStreamer.focus');
              bannerProvider.showSettings();
            }
          });
        return;
      }

      console.log(`Code Streamer: Generated ${messages.length} messages.`);
      
      messages.forEach(c => {
        if (c.donation) {
          totalDonations += c.donation;
        }
        // 如果消息还没有观众信息，尝试从观众列表补充
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

      // 累计收益 >= 1000 触发一次求 Star
      const hasAskedForStar = context.globalState.get<boolean>('hasAskedForStar', false);
      if (!hasAskedForStar && totalDonations >= 1000) {
        context.globalState.update('hasAskedForStar', true);
        bannerProvider.addMessages([
          {
            id: 'star_req',
            type: 'system',
            author: '系统',
            text: '看来你已经是个成熟的主播了！去 GitHub 给作者点个 Star 鼓励一下吧？',
            action: 'openGitHubStar'
          }
        ]);
      }

      // 检查是否有重要消息（比如乔布斯、Linus等知名人物）
      const importantAuthors = ['乔布斯', 'Steve Jobs', 'Linus', 'Linus Torvalds'];
      const hasImportantMessage = messages.some(c => 
        c.author && importantAuthors.some(author => c.author!.includes(author))
      );
      
      if (hasImportantMessage && !isPanelVisible) {
        const importantComment = messages.find(c => 
          c.author && importantAuthors.some(author => c.author!.includes(author))
        );
        if (importantComment) {
          pendingImportantMessage = `${importantComment.author}: ${importantComment.text}`;
          // 状态栏闪烁提醒
          updateStatusBar(true);
        }
      }
    }, debounceMs);
  });

  context.subscriptions.push(onDidChangeTextDocument);

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

