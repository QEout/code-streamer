import * as vscode from 'vscode';
import { Danmaku, Persona, Viewer } from './types';
import { PersonaService } from './personaService';
import { ViewerService } from './viewerService';

export class AIService {
  private personaService: PersonaService;
  private viewerService?: ViewerService;

  constructor(personaService: PersonaService, viewerService?: ViewerService) {
    this.personaService = personaService;
    this.viewerService = viewerService;
  }

  async generateComments(code: string): Promise<Danmaku[]> {
    const config = vscode.workspace.getConfiguration('codeStreamer');
    const mode = config.get<string>('llm.mode', 'mock');

    if (mode === 'openaiCompatible') {
      const apiKey = config.get<string>('llm.apiKey');
      const baseUrl = config.get<string>('llm.baseUrl');
      const model = config.get<string>('llm.model', 'gpt-4o-mini');

      if (apiKey && baseUrl) {
        try {
          return await this.generateAIComments(code, apiKey, baseUrl, model);
        } catch (error) {
          console.error('AI Service Error:', error);
          return [{ id: 'err', text: '直播间网络波动...', type: 'system', author: '系统' }];
        }
      }
    }

    return this.generateMockComments();
  }

  private async generateAIComments(code: string, apiKey: string, baseUrl: string, model: string): Promise<Danmaku[]> {
    const prompt = `你是一个直播间观众模拟器。
分析以下代码片段：
\`\`\`
${code.substring(0, 1000)}
\`\`\`

请生成 1-3 条有趣的弹幕评论。
身份包括：
- 小白 (newbie): 崇拜、看不懂、问基础问题
- 黑粉 (hater): 吐槽、毒舌、挑刺
- 大佬 (pro): 建议优化、指出潜在风险、技术讨论

以 JSON 格式返回，格式如下：
[
  { "text": "弹幕内容", "type": "newbie | hater | pro", "author": "昵称", "donation": 0 }
]
如果觉得代码写得特别好或者有明显的冷笑话潜质，可以设置 donation 为 1-100 的整数。
只返回 JSON。`;

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' } // Some providers support this
      })
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      // Handle cases where the model might return a wrapped object or the array directly
      let parsed = JSON.parse(content);
      if (parsed.danmaku) parsed = parsed.danmaku;
      if (!Array.isArray(parsed)) {
        if (typeof parsed === 'object') parsed = [parsed];
        else throw new Error('Invalid JSON format');
      }

      const comments = parsed.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: item.text || '...',
        type: item.type || 'newbie',
        author: item.author || '匿名观众',
        donation: item.donation || undefined
      }));

      // 从观众列表补充信息
      if (this.viewerService) {
        const viewers = this.viewerService.getViewers();
        comments.forEach(c => {
          const viewer = viewers.find(v => v.name === c.author || v.name.includes(c.author) || c.author.includes(v.name));
          if (viewer && viewer.unlocked) {
            c.avatar = viewer.avatar;
            c.tag = viewer.tag;
            c.messageBackground = viewer.messageBackground || undefined;
          }
        });
      }

      return comments;
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return this.generateMockComments();
    }
  }

  private generateMockComments(): Danmaku[] {
    const count = Math.floor(Math.random() * 3) + 1;
    const comments: Danmaku[] = [];

    // 优先从观众列表中选择已解锁的观众
    let availableViewers: Viewer[] = [];
    if (this.viewerService) {
      availableViewers = this.viewerService.getViewers().filter(v => v.unlocked && v.prompts && v.prompts.length > 0);
    }

    for (let i = 0; i < count; i++) {
      let viewer: Viewer | null = null;
      let text = '';
      let author = '';
      let type: 'newbie' | 'hater' | 'pro' | 'system' = 'newbie';
      let avatar = '';
      let tag = '';
      let messageBackground = '';

      // 如果有可用的观众，优先使用观众
      if (availableViewers.length > 0 && Math.random() > 0.3) {
        viewer = availableViewers[Math.floor(Math.random() * availableViewers.length)];
        const prompts = viewer.prompts || [];
        if (prompts.length > 0) {
          text = prompts[Math.floor(Math.random() * prompts.length)];
          author = viewer.name;
          avatar = viewer.avatar;
          tag = viewer.tag || '';
          messageBackground = viewer.messageBackground || '';
          // 根据标签推断类型
          if (tag.includes('大佬') || tag.includes('pro')) type = 'pro';
          else if (tag.includes('黑粉') || tag.includes('hater')) type = 'hater';
          else if (tag.includes('VIP')) type = 'pro';
          else type = 'newbie';
        }
      }

      // 如果没有观众或随机选择使用 Persona
      if (!viewer || !text) {
        const persona = this.personaService.getRandomPersona();
        const template = persona.templates[Math.floor(Math.random() * persona.templates.length)];
        text = template.replace('{symbol}', '逻辑');
        author = persona.name;
        type = persona.type;
      }
      
      comments.push({
        id: Math.random().toString(36).substr(2, 9),
        text,
        type,
        author,
        donation: Math.random() > 0.8 ? Math.floor(Math.random() * 50) + 1 : undefined,
        avatar: avatar || undefined,
        tag: tag || undefined,
        messageBackground: messageBackground || undefined
      });
    }

    return comments;
  }
}
