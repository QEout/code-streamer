# 贡献指南

感谢你对 Code Streamer 的兴趣！我们欢迎各种形式的贡献。

## 🎯 贡献方式

### 1. 添加观众人设（最简单！）

**不需要写代码，只需修改 JSON 文件！**

编辑 `prompts/personas.json`，添加新的人设：

```json
{
  "name": "你的观众名",
  "type": "newbie | hater | pro | system",
  "templates": [
    "弹幕模板1 - 可以使用 {symbol} 占位符",
    "弹幕模板2",
    "弹幕模板3"
  ]
}
```

**类型说明：**
- `newbie`: 小白观众，崇拜、问基础问题
- `hater`: 黑粉，吐槽、毒舌
- `pro`: 大佬，技术建议、优化建议
- `system`: 系统消息

**提交 PR 时：**
- 确保 JSON 格式正确
- 添加有创意的弹幕模板
- 可以添加多个模板增加多样性

### 2. 添加观众角色

编辑 `prompts/viewers.json`，添加新的观众：

```json
{
  "id": "viewer_unique_id",
  "name": "观众名",
  "emoji": "🎯",
  "price": 500,
  "unlocked": false,
  "avatar": "🎯",
  "description": "简短描述",
  "sponsor": "赞助商（可选）"
}
```

### 3. 代码贡献

如果你想贡献代码：

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 4. 报告 Bug

在 [Issues](https://github.com/your-username/code-streamer/issues) 中报告问题，包括：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（VS Code 版本、扩展版本等）

### 5. 提出功能建议

在 [Issues](https://github.com/your-username/code-streamer/issues) 中提出功能建议，描述：
- 功能用途
- 使用场景
- 可能的实现方式（可选）

## 📝 代码规范

- 使用 TypeScript
- 遵循现有代码风格
- 添加必要的注释
- 确保通过 lint 检查

## 🎁 贡献奖励

所有贡献者都会：
- 在 README 中被提及（如果愿意）
- 获得社区的感谢 ❤️

---

**让我们一起让写代码变得更有趣！** 🚀

