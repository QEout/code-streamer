import * as vscode from 'vscode';
import { ChatMessage } from './types';
import { ViewerService } from './viewerService';

export class AIService {
  private viewerService: ViewerService;
  private projectContext: string = '';

  constructor(viewerService: ViewerService) {
    this.viewerService = viewerService;
    this.detectProjectContext();
  }

  public async detectProjectContext() {
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) return;

      const root = folders[0].uri;
      const files = await vscode.workspace.findFiles(new vscode.RelativePattern(root, '{package.json,go.mod,Cargo.toml,requirements.txt,pom.xml,build.gradle,pubspec.yaml}'), null, 10);
      
      const keywords: string[] = [];
      for (const file of files) {
        const filename = file.path.split('/').pop();
        if (filename === 'package.json') {
          try {
            const content = await vscode.workspace.fs.readFile(file);
            const json = JSON.parse(new TextDecoder().decode(content));
            if (json.dependencies) keywords.push(...Object.keys(json.dependencies));
            if (json.devDependencies) keywords.push(...Object.keys(json.devDependencies));
          } catch {}
        } else if (filename) {
          keywords.push(filename); // 比如看到 go.mod 就知道是 Go 项目
        }
      }
      
      // 筛选一些关键库
      const importantKeys = ['react', 'vue', 'next', 'express', 'nestjs', 'torch', 'tensorflow', 'pandas', 'spring', 'gin', 'flutter', 'ethers', 'web3'];
      const found = keywords.filter(k => importantKeys.some(i => k.includes(i))).slice(0, 5);
      
      if (found.length > 0) {
        this.projectContext = `Project Tech Stack: ${found.join(', ')}`;
      }
    } catch (e) {
      console.error('Project detection failed:', e);
    }
  }

  async generateMessages(code: string, trigger: string = 'writing', language: string = ''): Promise<ChatMessage[]> {
    const config = vscode.workspace.getConfiguration('codeStreamer');
    const apiKey = String(config.get<string>('llm.apiKey', '') || '').trim();
    const baseUrl = String(config.get<string>('llm.baseUrl', '') || '').trim();
    const model = String(config.get<string>('llm.model', 'gpt-4o-mini') || '').trim();

    // 未配置：由 extension 负责 VSCode 通知，这里只抛错
    if (!apiKey || !baseUrl) {
      const err: any = new Error('未配置 AI 弹幕：请在「⚙️ 设置」中填写 Base URL 与 API Key。');
      err.code = 'NEED_CONFIG';
      throw err;
    }

    return await this.generateAIComments(code, apiKey, baseUrl, model, trigger, language);
  }

  private async generateAIComments(code: string, apiKey: string, baseUrl: string, model: string, trigger: string, language: string): Promise<ChatMessage[]> {
    const unlockedViewers = this.viewerService
      .getViewers()
      .filter(v => v.unlocked)
      .slice(0, 15); // 限制人数，避免 Token 爆炸

    // 构建角色设定表
    const rolesDescription = unlockedViewers.map(v => {
      // 如果有 prompts 仍然利用，如果没有则依靠 description
      const desc = v.description ? `性格描述："${v.description}"` : '';
      const samples = v.prompts && v.prompts.length > 0 ? `, 语气参考: ["${v.prompts.slice(0, 3).join('", "')}"]` : '';
      return `- ${v.name} (${v.tag || '观众'}): ${desc}${samples}`;
    }).join('\n');

    const triggerDesc = 
      trigger === 'save' ? '用户刚保存了代码，可能完成了一个功能模块。' :
      trigger === 'paste' ? '用户刚粘贴了一大段代码（CV工程师行为）。' :
      trigger === 'error' ? '代码出现了错误/红波浪线，快吐槽！' :
      '用户正在思考或编写代码。';

    const prompt = `你是一个直播间观众弹幕生成器。
${this.projectContext ? `当前项目背景：${this.projectContext}` : ''}
语言：${language}
触发原因：${triggerDesc}

可用角色列表与性格设定：
${rolesDescription}

请阅读以下代码片段（光标附近的上下文），并生成 1-3 条短弹幕。
从上述角色中选择合适的 author（保持人设）。

代码上下文：
\`\`\`${language}
${code.substring(0, 2000)}
\`\`\`

要求：
- type 只能是 newbie | hater | pro
- author 必须从“可用角色列表”中选择
- donation 为可选整数（1-100），只有在真的“很赞/很搞笑/很有料”时才给
- 只输出 JSON（数组），不要输出任何解释性文字

返回格式示例：
[
  { "text": "弹幕内容", "type": "newbie", "author": "路人甲", "donation": 0 }
]`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 300
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {}
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const data: any = await response.json();
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    const parsed = this.parseDanmakuJson(content);

    const viewers = this.viewerService.getViewers();
    return parsed.slice(0, 3).map((item: any) => {
      const author = String(item?.author ?? '匿名观众');
      const viewer = viewers.find(v => v.name === author || v.name.includes(author) || author.includes(v.name));

      return {
        id: Math.random().toString(36).slice(2, 9),
        text: String(item?.text ?? '...'),
        type: (item?.type === 'hater' || item?.type === 'pro' || item?.type === 'system') ? item.type : 'newbie',
        author,
        donation: typeof item?.donation === 'number' && item.donation > 0 ? Math.min(100, Math.floor(item.donation)) : undefined,
        avatar: viewer?.avatar,
        tag: viewer?.tag,
        messageBackground: viewer?.messageBackground || undefined
      };
    });
  }

  private parseDanmakuJson(raw: string): any[] {
    // 1) 直接解析
    try {
      const direct = JSON.parse(raw);
      return Array.isArray(direct) ? direct : (direct?.danmaku && Array.isArray(direct.danmaku) ? direct.danmaku : [direct]);
    } catch {}

    // 2) 截取第一个 JSON 数组
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const sliced = raw.slice(start, end + 1);
      try {
        const arr = JSON.parse(sliced);
        return Array.isArray(arr) ? arr : [arr];
      } catch {}
    }

    // 3) 兜底：抛错，由 extension 走 VSCode 通知
    throw new Error('AI 返回格式不正确（未解析到 JSON 数组）。');
  }
}
