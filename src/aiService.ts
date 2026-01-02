import * as vscode from 'vscode';
import { ChatMessage } from './types';
import { ViewerService } from './viewerService';

export class AIService {
  private viewerService: ViewerService;

  constructor(viewerService: ViewerService) {
    this.viewerService = viewerService;
  }

  async generateMessages(code: string): Promise<ChatMessage[]> {
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

    return await this.generateAIComments(code, apiKey, baseUrl, model);
  }

  private async generateAIComments(code: string, apiKey: string, baseUrl: string, model: string): Promise<ChatMessage[]> {
    const unlockedViewers = this.viewerService
      .getViewers()
      .filter(v => v.unlocked)
      .map(v => v.name)
      .slice(0, 50); // 防止 prompt 过长

    const viewerHint =
      unlockedViewers.length > 0
        ? `author 必须从以下列表中选择其一：${unlockedViewers.join('、')}`
        : 'author 可以使用任意昵称';

    const prompt = `你是一个直播间观众弹幕生成器。
请阅读以下代码片段，并生成 1-3 条短弹幕（口语化、有梗但不低俗）。

代码：
\`\`\`
${code.substring(0, 1000)}
\`\`\`

要求：
- type 只能是 newbie | hater | pro
- ${viewerHint}
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
