import * as vscode from 'vscode';
import { Danmaku, StreamState } from './types';

export class BannerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeStreamer.banner';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

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

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'ready':
          // Initialization if needed
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

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            background-color: transparent;
            color: var(--vscode-foreground);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            height: 100vh;
            display: flex;
            align-items: center;
        }

        .scoreboard {
            display: flex;
            align-items: center;
            padding: 0 12px;
            background: rgba(20, 20, 20, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ffd700;
            height: 100%;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
            z-index: 10;
        }

        .stats-item {
            margin-right: 10px;
        }

        .stats-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #888;
            display: block;
            line-height: 1;
        }

        .stats-value {
            font-size: 14px;
            font-weight: bold;
            font-family: 'Courier New', Courier, monospace;
        }

        .live-indicator {
            display: flex;
            align-items: center;
            margin-right: 10px;
            font-size: 10px;
            color: #ff4444;
            font-weight: bold;
        }

        .dot {
            height: 6px;
            width: 6px;
            background-color: #ff4444;
            border-radius: 50%;
            display: inline-block;
            margin-right: 4px;
            animation: blink 1s infinite;
        }

        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }

        .danmaku-container {
            flex: 1;
            position: relative;
            height: 100%;
            overflow: hidden;
            display: flex;
            align-items: center;
        }

        .danmaku-item {
            position: absolute;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 4px;
            background: rgba(0,0,0,0.2);
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            pointer-events: none;
            will-change: transform;
        }

        .danmaku-newbie { color: #4caf50; }
        .danmaku-hater { color: #f44336; }
        .danmaku-pro { color: #2196f3; font-weight: bold; }
        .danmaku-system { color: #ffeb3b; }

        .sc-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
        }

        @keyframes sc-flash {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }

        .sc-card {
            background: linear-gradient(45deg, #ffd700, #ff8c00);
            color: #000;
            padding: 20px 40px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
            font-size: 24px;
            font-weight: bold;
            animation: sc-flash 2s forwards;
        }
    </style>
</head>
<body>
    <div class="scoreboard">
        <div class="live-indicator">
            <span class="dot"></span> LIVE
        </div>
        <div class="stats-item">
            <span class="stats-label">Donations</span>
            <div id="donations" class="stats-value">$0</div>
        </div>
        <div class="stats-item">
            <span class="stats-label">Viewers</span>
            <div id="viewers" class="stats-value">1,205</div>
        </div>
    </div>
    <div id="danmaku-track" class="danmaku-container"></div>
    <div id="sc-container" class="sc-overlay"></div>

    <script>
        const track = document.getElementById('danmaku-track');
        const donationsEl = document.getElementById('donations');
        const viewersEl = document.getElementById('viewers');
        const scContainer = document.getElementById('sc-container');

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'addDanmaku':
                    message.data.forEach(d => createDanmaku(d));
                    break;
                case 'updateState':
                    donationsEl.textContent = '$' + message.data.totalDonations.toLocaleString();
                    viewersEl.textContent = message.data.viewerCount.toLocaleString();
                    break;
            }
        });

        function createDanmaku(d) {
            const el = document.createElement('div');
            el.className = 'danmaku-item danmaku-' + d.type;
            el.textContent = (d.author ? '[' + d.author + '] ' : '') + d.text;
            
            if (d.donation) {
              showSC(d.author, d.donation);
            }

            const trackHeight = track.offsetHeight;
            const top = Math.random() * (trackHeight - 30);
            el.style.top = top + 'px';
            el.style.left = '100%';
            
            track.appendChild(el);

            const duration = 8000 + Math.random() * 4000;
            const startTime = performance.now();
            
            function step(timestamp) {
                const progress = (timestamp - startTime) / duration;
                if (progress < 1) {
                    const x = 100 - (progress * 130); // Move from 100% to -30%
                    el.style.left = x + '%';
                    requestAnimationFrame(step);
                } else {
                    el.remove();
                }
            }
            requestAnimationFrame(step);
        }

        function showSC(author, amount) {
            const card = document.createElement('div');
            card.className = 'sc-card';
            card.textContent = author + ' 打赏了 $' + amount;
            scContainer.appendChild(card);
            setTimeout(() => card.remove(), 2000);
        }
    </script>
</body>
</html>`;
  }
}

