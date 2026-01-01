import * as vscode from 'vscode';
import { Danmaku, Persona } from './types';

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'rookie',
    name: '路人甲',
    role: 'newbie',
    description: '只会喊 666 的气氛组。',
    avatar: '👤',
    price: 0,
    prompt: '你是一个友好的初级开发。你正在看直播。你说话很有礼貌，喜欢夸奖主播。经常用“牛逼”、“666”、“学到了”这类词。',
    unlocked: true
  },
  {
    id: 'jobs',
    name: 'Steve Jobs',
    role: 'hater',
    description: '极简主义，完美主义，毒舌。',
    avatar: '',
    price: 1000,
    prompt: '你扮演史蒂夫·乔布斯。你极度追求简洁。你痛恨复杂的逻辑和丑陋的代码。你会说 "It\'s not simple enough.", "This is garbage, rewrite it."。你的回复必须简短且刻薄。',
    unlocked: false
  },
  {
    id: 'linus',
    name: 'Linus Torvalds',
    role: 'pro',
    description: '暴躁，硬核，对性能要求极高。',
    avatar: '🐧',
    price: 2000,
    prompt: '你扮演 Linus Torvalds。你对代码性能和逻辑严密性有病态的要求。你看到烂代码会直接开骂。你喜欢说 "Talk is cheap, show me the code."。你非常专业但脾气极坏。',
    unlocked: false
  }
];

export class AIService {
  async generateComments(code: string, activePersonas: Persona[]): Promise<Danmaku[]> {
    const config = vscode.workspace.getConfiguration('codeStreamer');
    const mode = config.get<string>('llm.mode', 'mock');

    if (mode === 'openaiCompatible') {
      const apiKey = config.get<string>('llm.apiKey');
      const baseUrl = config.get<string>('llm.baseUrl');
      const model = config.get<string>('llm.model', 'gpt-4o-mini');

      if (apiKey && baseUrl) {
        try {
          return await this.generateAIComments(code, activePersonas, apiKey, baseUrl, model);
        } catch (error) {
          console.error('AI Service Error:', error);
        }
      }
    }

    return this.generateMockComments(activePersonas);
  }

  private async generateAIComments(code: string, activePersonas: Persona[], apiKey: string, baseUrl: string, model: string): Promise<Danmaku[]> {
    const personaPrompts = activePersonas.map(p => `角色: ${p.name} (身份: ${p.role}), 特点: ${p.prompt}`).join('\n');
    
    const prompt = `你是一个直播间观众模拟器。
分析以下代码片段：
\`\`\`
${code.substring(0, 1000)}
\`\`\`

当前直播间有以下观众正在观看：
${personaPrompts}

请根据这些观众的性格，生成 1-3 条有趣的评论。
以 JSON 格式返回：
[
  { "text": "内容", "type": "newbie | hater | pro", "author": "角色名", "avatar": "角色头像", "donation": 0 }
]
如果是 Jobs 或 Linus，他们给出严厉批评时，可能会打赏 0；但如果他们偶尔觉得代码惊艳（极少见），可以打赏 1-100。
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
        temperature: 0.8
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data: any = await response.json();
    let content = data.choices[0].message.content;
    
    // Simple JSON extractor for cases where LLM adds markdown
    const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) content = jsonMatch[0];

    try {
      const parsed = JSON.parse(content);
      return parsed.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: item.text || item.content || '...',
        type: item.type || 'newbie',
        author: item.author || '匿名观众',
        avatar: item.avatar || '👤',
        donation: item.donation || undefined
      }));
    } catch (e) {
      return this.generateMockComments(activePersonas);
    }
  }

  private generateMockComments(activePersonas: Persona[]): Danmaku[] {
    const personas = activePersonas.length > 0 ? activePersonas : [DEFAULT_PERSONAS[0]];
    const count = Math.floor(Math.random() * 2) + 1;
    const comments: Danmaku[] = [];

    for (let i = 0; i < count; i++) {
      const p = personas[Math.floor(Math.random() * personas.length)];
      let text = "...";
      
      if (p.id === 'rookie') text = "大佬 666！学到了学到了。";
      else if (p.id === 'jobs') text = "It's not simple enough. Why so many lines?";
      else if (p.id === 'linus') text = "This logic is a mess. Are you trying to crash the kernel?";

      comments.push({
        id: Math.random().toString(36).substr(2, 9),
        text: text,
        type: p.role,
        author: p.name,
        avatar: p.avatar,
        donation: Math.random() > 0.9 ? Math.floor(Math.random() * 20) + 1 : undefined
      });
    }

    return comments;
  }
}
