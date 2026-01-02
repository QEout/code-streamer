import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Persona, PersonasConfig } from './types';

export class PersonaService {
  private personas: Persona[] = [];
  private configPath: string;

  constructor(context: vscode.ExtensionContext) {
    // 获取扩展的 prompts 目录路径
    const extensionPath = context.extensionPath;
    this.configPath = path.join(extensionPath, 'prompts', 'personas.json');
    this.loadPersonas();
  }

  private loadPersonas(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const config: PersonasConfig = JSON.parse(content);
        this.personas = config.personas || [];
      } else {
        // 如果文件不存在，使用默认人设
        this.personas = this.getDefaultPersonas();
        console.warn(`Personas config not found at ${this.configPath}, using defaults`);
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
      this.personas = this.getDefaultPersonas();
    }
  }

  public getPersonas(): Persona[] {
    return this.personas;
  }

  public getRandomPersona(): Persona {
    if (this.personas.length === 0) {
      return this.getDefaultPersonas()[0];
    }
    return this.personas[Math.floor(Math.random() * this.personas.length)];
  }

  private getDefaultPersonas(): Persona[] {
    // 兜底默认人设
    return [
      { name: '小白', type: 'newbie', templates: ['哇，这个写得好高级！'] },
      { name: '黑粉', type: 'hater', templates: ['又在写 Bug？'] },
      { name: '大佬', type: 'pro', templates: ['建议这里优化一下。'] }
    ];
  }

  public reload(): void {
    this.loadPersonas();
  }
}

