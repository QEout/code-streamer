import * as vscode from 'vscode';
import { BannerViewProvider } from './bannerViewProvider';
import { AIService } from './aiService';
import { StreamState } from './types';

export function activate(context: vscode.ExtensionContext) {
  const bannerProvider = new BannerViewProvider(context.extensionUri);
  const aiService = new AIService();

  let totalDonations = context.globalState.get<number>('totalDonations', 0);
  let viewerCount = 1205 + Math.floor(Math.random() * 200);
  let debounceTimer: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(BannerViewProvider.viewType, bannerProvider)
  );

  // Initial state update
  setInterval(() => {
    viewerCount += Math.floor(Math.random() * 5) - 2;
    if (viewerCount < 100) viewerCount = 100;
    bannerProvider.updateState({ totalDonations, viewerCount, lastUpdate: Date.now() });
  }, 5000);

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
    if (!vscode.workspace.getConfiguration('codeStreamer').get('enabled')) return;
    
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
      const comments = await aiService.generateComments(content);
      console.log(`Code Streamer: Generated ${comments.length} comments.`);
      
      comments.forEach(c => {
        if (c.donation) {
          totalDonations += c.donation;
        }
      });

      context.globalState.update('totalDonations', totalDonations);
      bannerProvider.updateState({ totalDonations, viewerCount, lastUpdate: Date.now() });
      bannerProvider.addDanmaku(comments);
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
}

export function deactivate() {}

