# Code Streamer 🎮

> **"The Gamified IDE Companion."**  
> 把孤独枯燥的编程过程，瞬间转化为一场**高多巴胺“虚拟直播秀”**。

![Banner](media/icon.svg)

---

## 1. 核心痛点与解决方案

**痛点：**  
Vibe Coding 时代的程序员容易在 AI 生成代码的空窗期分神（刷手机/网页），且独立开发过程极度孤独，缺乏即时反馈。

**解决方案：**  
通过模拟“直播环境”，用 **AI 观众的实时弹幕**和**虚拟打赏**，提供持续的“被注视感”和“成就感”，将用户的注意力牢牢锁定在 IDE 中。

---

## 2. 核心功能 (The MVP Features)

### A. 智能弹幕系统 (AI Danmaku)
不再是死板规则，接入 LLM API (DeepSeek/GPT)，实时分析你正在写的代码。

**千人千面，性格各异的虚拟观众：**
- 🟢 **小白**： "哇，这个正则写得好高级！"
- 🔴 **黑粉**： "又在写 Bug？内存要爆了！"
- 🔵 **大佬**： "建议这里用 Map 优化一下查找速度。"

**实时互动：**  
根据你的代码质量、手速、甚至报错情况，生成神吐槽。

### B. 虚拟打赏经济 (The Dopamine Loop)
- **Super Chat (SC)**： 当你写出精彩代码（或搞笑 Bug）时，触发全屏金光闪烁特效。
- **累计收益**： 顶部常驻显示 "Total Donations: $1,250"。看着数字跳动，给你极强的心理暗示和爽感。

### C. 沉浸式直播导播台
- **三栏布局**： 左侧数据监控（人气/收益）、中间观众席、右侧实时弹幕流。
- **状态栏“不死图腾”**： VS Code 底部状态栏实时显示直播状态，点击一键切回直播间。

---

## 🚀 快速开始 (Quick Start)

1. **安装扩展**：在 VS Code 插件市场搜索 `Code Streamer` 并安装。
2. **启动直播**：
   - 打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - 输入 `Code Streamer: Start`
3. **配置 AI**（推荐）：
   - 点击直播间右下角的 `⚙️ 设置` 按钮。
   - 填入你的 OpenAI-compatible **Base URL** (如 `https://api.deepseek.com/v1`) 和 **API Key**。
   - 选择模型（支持自动获取模型列表）。
4. **开始 Coding**：回到代码编辑区，开始写代码，观众会根据你的改动自动发送弹幕！

---

## ⚙️ 配置指南

在直播间点击“设置”按钮，或在 VS Code 设置中搜索 `codeStreamer`：

| 设置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `llm.baseUrl` | LLM API 地址 (e.g. `https://api.deepseek.com/v1`) | - |
| `llm.apiKey` | LLM API Key | - |
| `llm.model` | 使用的模型名称 | `gpt-4o-mini` |
| `debounceMs` | 停手多久后触发 AI 分析（毫秒） | `1200` |

---

## 🤝 贡献与反馈

- **获取更多角色**：[前往官网](https://xxxx.com) (Coming Soon)
- **源码**：欢迎在 [GitHub](https://github.com/QEout/code-streamer) 上提交 Issue 或 PR。
- **Star**：如果你喜欢这个项目，请给个 ⭐ 鼓励一下！

---

**Happy Coding! 让代码不仅是工作，更是一场秀。**
