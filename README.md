# Code Streamer 🎮

**The Gamified IDE Companion: AI 弹幕 + 虚拟打赏的"代码直播间"**

一个让写代码变得有趣的 VS Code 扩展。当你写代码时，会有虚拟观众发弹幕、打赏，就像在直播一样！

## ✨ 特性

- 🎯 **三栏式直播导播台**：数据监控、互动直播流、人才市场
- 🔴 **状态栏"不死图腾"**：永远可见的直播状态，点击即可返回直播间
- 💬 **AI 弹幕系统**：支持 Mock 模式和 OpenAI-compatible API
- 💰 **虚拟打赏**：观众会为你的代码打赏
- 👥 **观众系统**：可购买/解锁不同的观众角色
- 📡 **官方源同步**：从 GitHub Pages 自动加载最新观众列表

## 🚀 快速开始

1. 安装扩展
2. 打开命令面板（`Ctrl+Shift+P`），运行 `Code Streamer: Start`
3. 开始写代码，享受直播体验！

## 📝 配置

在 VS Code 设置中搜索 `codeStreamer`：

- `codeStreamer.enabled`: 是否启用
- `codeStreamer.debounceMs`: 防抖时间（毫秒）
- `codeStreamer.llm.mode`: 弹幕生成模式（`mock` 或 `openaiCompatible`）
- `codeStreamer.enableOfficialSource`: 是否从官方源加载观众列表
- `codeStreamer.officialSourceUrl`: 官方源地址

## 🤝 贡献

### 添加新观众人设

**最简单的方式：只需修改 JSON 文件！**

1. 编辑 `prompts/personas.json`
2. 添加新的人设对象：

```json
{
  "name": "你的观众名",
  "type": "newbie | hater | pro | system",
  "templates": [
    "弹幕模板1",
    "弹幕模板2",
    "弹幕模板3"
  ]
}
```

3. 提交 PR！

### 添加新观众角色

编辑 `prompts/viewers.json`：

```json
{
  "id": "viewer_unique_id",
  "name": "观众名",
  "emoji": "🎯",
  "price": 500,
  "unlocked": false,
  "avatar": "🎯",
  "description": "描述",
  "sponsor": null
}
```

### 代码贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🎯 运营式开源策略

本项目采用"运营式开源"策略：

- ✅ **代码完全开源**：MIT License，自由使用和修改
- 🎁 **内容可配置**：所有观众人设都在 JSON 文件中，易于贡献
- 🌐 **官方源控制**：通过 GitHub Pages 控制"本周推荐观众"和广告位
- 💡 **降低贡献门槛**：不需要懂复杂代码，只需修改 JSON 即可贡献内容

## 🔗 相关链接

- [官方观众列表源](https://your-username.github.io/code-streamer/viewers.json)（示例）

---

**让写代码变得有趣！** 🚀

