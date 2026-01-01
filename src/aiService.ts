import * as vscode from 'vscode';
import { Danmaku } from './types';

export class AIService {
  private static readonly PERSONAS = [
    { name: '小白', type: 'newbie' as const, templates: ['哇，这个{symbol}写得好高级！', '看不懂，但是觉得很牛逼的样子。', '大佬救命，这里为什么要这么写？'] },
    { name: '黑粉', type: 'hater' as const, templates: ['又在写 Bug？内存要爆了！', '这种代码我奶奶都能写。', '建议转行，真的。', '这一行逻辑看得我血压升高。'] },
    { name: '大佬', type: 'pro' as const, templates: ['建议这里用 Map 优化一下查找速度。', '注意这里的内存泄漏风险。', '这波重构思路不错，很有灵性。', '考虑一下并发情况下的安全性。'] }
  ];

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

      return parsed.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: item.text || '...',
        type: item.type || 'newbie',
        author: item.author || '匿名观众',
        donation: item.donation || undefined
      }));
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return this.generateMockComments();
    }
  }

  private generateMockComments(): Danmaku[] {
    const count = Math.floor(Math.random() * 3) + 1;
    const comments: Danmaku[] = [];

    for (let i = 0; i < count; i++) {
      const persona = AIService.PERSONAS[Math.floor(Math.random() * AIService.PERSONAS.length)];
      const template = persona.templates[Math.floor(Math.random() * persona.templates.length)];
      
      comments.push({
        id: Math.random().toString(36).substr(2, 9),
        text: template.replace('{symbol}', '逻辑'),
        type: persona.type,
        author: persona.name,
        donation: Math.random() > 0.8 ? Math.floor(Math.random() * 50) + 1 : undefined
      });
    }

    return comments;
  }
}
