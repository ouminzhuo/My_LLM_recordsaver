# Multi-LLM Chat Extractor - Chrome Extension Module

## 1. 项目概述 (Project Overview)

本项目是 "LLM to Obsidian Canvas" 知识流转系统的数据提取层（Data Extraction Layer）。 **目标**：构建一个 Chrome 浏览器扩展（Manifest V3），用于从主流 LLM 网页端提取当前的完整对话历史，并将其清洗为结构化的 JSON 数据，以便后续进行 AI 总结和 Obsidian 导入。

### 1.1 支持平台范围 (Target Platforms)

当前需求至少支持以下网页端：

- **Google Gemini**: `gemini.google.com`
- **xAI Grok**: `grok.com` / `x.com/i/grok`
- **OpenAI ChatGPT**: `chatgpt.com` / `chat.openai.com`

要求采用**可扩展架构**：后续可低成本新增 Claude、Kimi、DeepSeek 等平台解析器。

## 2. 技术栈 (Tech Stack)

- **Manifest Version**: V3
- **Language**: Vanilla JavaScript (ES6+)
- **Target Platform**: Google Chrome / Edge
- **Permissions**: `activeTab`, `scripting`

## 3. 文件结构 (Directory Structure)

Plaintext

```
/gemini-extractor
│── manifest.json      # 插件配置（多站点 host permissions）
│── popup.html         # 插件弹窗界面 (包含 "Extract" 按钮)
│── popup.js           # 弹窗逻辑 (发送消息给 content script)
│── content.js         # 核心逻辑：识别站点、选择解析器、提取并清洗数据
│── background.js      # Service Worker (可选，用于处理快捷键或跨域请求)
│── parsers/
│   ├── gemini.js      # Gemini 解析器
│   ├── grok.js        # Grok 解析器
│   └── chatgpt.js     # ChatGPT 解析器
│── styles.css         # 简单的 UI 样式
└── README.md          # 本文档
```

> 注：若暂不拆分 `parsers/` 目录，也应在 `content.js` 内部保持“按平台分模块函数”的结构。

## 4. 数据结构规范 (Data Schema)

插件必须输出以下格式的 JSON 数组。这是后续 "AI 逻辑处理层" 的输入标准。

JSON

```
[
  {
    "id": "msg_001",              // (可选) 消息唯一标识
    "platform": "gemini",         // 必填: gemini | grok | chatgpt
    "conversation_id": "...",     // (可选) 会话ID
    "role": "user",               // 枚举: "user" | "model" | "system"
    "timestamp": "HH:MM",         // (可选) 提取时间戳
    "content": "这里是用户的提问文本...",
    "segments": [                   // 必填: 多模态分段（至少包含 text/image/file 中的一种）
      {
        "type": "text",
        "text": "这里是用户的提问文本..."
      },
      {
        "type": "image",
        "url": "https://.../generated-image.png",
        "mime": "image/png",
        "alt": "Gemini generated image"
      },
      {
        "type": "file",
        "name": "deep_research_report.pdf",
        "url": "https://.../file.pdf",
        "mime": "application/pdf",
        "size": 123456
      }
    ],
    "meta": {
      "hasImage": true,             // 是否包含图片
      "imageUrls": ["..."],        // (可选) 图片链接
      "hasFile": true,              // 是否包含文件
      "fileCount": 1,               // (可选) 文件数
      "hasCodeBlock": false,        // 是否包含代码块
      "modelName": "gpt-4o",       // (可选) 模型名
      "hasCitations": true,          // 是否包含引用来源
      "citationCount": 2             // (可选) 引用数量
    },
    "fact_check": {                  // (可选) 事实核实记录
      "actions": [
        {
          "type": "citation",      // citation | web_search | tool_call
          "label": "Source [1]",
          "url": "https://example.com/source",
          "accessed_at": "2026-02-12T10:00:00Z"
        }
      ],
      "sources": [
        {
          "title": "Example Source",
          "url": "https://example.com/source",
          "domain": "example.com",
          "snippet": "..."
        }
      ]
    }
  },
  {
    "id": "msg_002",
    "platform": "chatgpt",
    "role": "model",
    "content": "这里是模型回答内容...",
    "raw_html": "<div>...</div>"  // (可选) 保留原始 HTML 用于后续复杂解析（如表格/代码块）
  }
]
```

## 5. 核心功能逻辑 (Functional Requirements)

### 5.1 站点识别与解析器路由 (Critical)

`content.js` 必须先识别当前站点，再路由到对应解析函数：

- `parseGeminiChat()`
- `parseGrokChat()`
- `parseChatGPTChat()`

必须实现 `detectPlatformByUrl(location)`，基于 `hostname + pathname` 自动识别当前网页模型，示例规则：

- `gemini.google.com` => `gemini`
- `grok.com` 或 `x.com/i/grok` => `grok`
- `chatgpt.com` 或 `chat.openai.com` => `chatgpt`

识别结果要用于：

1. 路由到对应解析器。
2. 写入输出 JSON 的 `platform` 字段。
3. 在 popup 成功提示中展示模型名称。

若当前站点不在支持列表中，需返回明确错误提示（如 `Unsupported site`）。

### 5.2 DOM 解析策略 (Critical)

LLM 页面 DOM 类名可能动态混淆，因此代码**不能硬编码**随机 class。必须使用**语义化选择器**或**相对结构查询**。

通用策略：

- **容器识别**：优先找 `main`、`article`、`[role="main"]`、ARIA 标注区域。
- **消息识别**：优先基于可访问性属性、data-testid、消息结构层级，而不是随机类名。
- **角色识别**：区分 user / model / system（如系统提示、工具消息）。
- **文本提取**：
  - 提取纯文本 (`innerText`)。
  - 保留代码块格式（识别 `pre > code` / markdown ```）。
- **图片提取**：
  - 提取消息中图片 URL（包括模型生成图，如 Gemini 图片生成结果）。
  - 保留图片 `alt`、`mime`（可推断）等信息。
- **文件提取**：
  - 提取消息中的文件附件记录（如 ChatGPT 深度研究输出的 PDF/文档/表格链接）。
  - 至少记录 `name`、`url`、`mime`、`size(如可得)`。

平台建议：

- **Gemini**：可优先检查带有用户/模型头像、或平台特征 `data-testid` 的节点。
- **Grok**：需兼容 `grok.com` 与 `x.com/i/grok` 的页面差异。
- **ChatGPT**：兼容 `chatgpt.com` 与历史域名 `chat.openai.com`。

### 5.2.1 事实核实与来源保留 (Critical)

**需要保留会话中的事实核实动作与来源信息**，不能在清洗阶段丢失。至少包含：

- 模型在回答中给出的引用链接（citation links）
- 模型进行网页检索/工具调用后呈现的来源卡片或参考列表
- 与回答段落的来源映射关系（如 `[1]` 对应 URL）

建议输出：

- `fact_check.actions[]`：记录“核实动作”本身（citation/web_search/tool_call）
- `fact_check.sources[]`：记录来源标题、URL、域名、摘录
- `meta.hasCitations` / `meta.citationCount`：用于快速统计

### 5.3 数据清洗 (Data Cleaning)

在提取过程中，必须移除噪音元素，包括但不限于：

- 草稿、重新生成、修改回答等控制按钮文案
- 引用来源角标（如 `[1]`, `[2]`）：仅在与 `fact_check.sources` 建立映射后才可清理展示噪音
- 无关 SVG 图标文本
- 分享、复制、点赞等操作栏文本

要求：清洗时不能破坏正文语义与代码块内容。

同时要求：

- 不得误删图片或文件附件节点。
- 若无法获取文件真实下载 URL，需保留可回溯标识（如 data-id / 文件名）。

### 5.4 交互流程 (User Flow)

1. 用户在目标 LLM 页面点击插件图标。
2. 弹出 Popup，显示 `Extract Chat` 按钮。
3. 点击按钮后，执行站点识别与对应抓取。
4. **反馈**：抓取成功后，将 JSON **自动复制到剪贴板**，并在 Popup 中显示成功提示（包含站点名，如 `Success! ChatGPT chat copied.`）。
5. (进阶可选) 提供 `Download .json` 按钮直接下载文件。

### 5.5 异常处理 (Error Handling)

- 不支持站点：提示用户当前仅支持 Gemini / Grok / ChatGPT。
- 页面结构变更：返回可诊断错误（如 `Parser matched 0 messages`）。
- 空会话：提示 `No messages found`。
- 无图片/无文件：不报错，但 `segments` 中省略对应类型，`meta.hasImage/hasFile` 置为 `false`。

## 6. 开发提示 (Prompt for AI Coder)

> **给 AI 助手的指令：** 请基于上述文档，编写 `manifest.json`, `popup.html`, `popup.js`, `content.js`，并实现按站点拆分的解析器（可在 `parsers/` 下）。
>
> **特别注意 `content.js` 的实现：** 必须实现统一入口 `parseCurrentSiteChat()`，并先调用 `detectPlatformByUrl(location)` 自动识别当前模型，再路由到 `parseGeminiChat()` / `parseGrokChat()` / `parseChatGPTChat()`。每个解析器都应包含“语义选择器 + 启发式回退”两层策略，并完整提取 `text/image/file` 三类记录。
>
> **Manifest 配置：** `host_permissions` 必须至少包含：
>
> - `https://gemini.google.com/*`
> - `https://grok.com/*`
> - `https://x.com/i/grok*`
> - `https://chatgpt.com/*`
> - `https://chat.openai.com/*`

## 7. 可优化项与易遗漏场景 (Recommended Enhancements)

以下为建议加入的“高优先级优化点”，用于提升可用性、稳定性和可维护性。

### 7.1 会话完整性与分页/懒加载

- **自动滚动抓取**：部分平台仅渲染可视区消息，需在提取前执行“渐进滚动 + 去重”。
- **去重策略**：建议使用 `id || (role + content hash + timestamp)` 生成去重键，防止重复消息。
- **中断恢复**：当消息很多时，支持分批抓取并在失败后从上次偏移继续。

### 7.2 多模态覆盖细节

- **图片记录增强**：除 URL 外，建议记录 `width/height`、`thumbnailUrl`、`sourceType`（generated/uploaded）。
- **文件记录增强**：支持“无直链文件”（仅按钮/卡片）场景，保留 `fileToken`、`data-id`、`displayName`。
- **富媒体扩展**：预留 `audio/video` 类型，避免未来协议破坏式升级。

### 7.3 结构化内容保真

- **代码块保真**：保留 `language` 与原始缩进，避免只保留纯文本导致可执行性下降。
- **表格保真**：除 `raw_html` 外，建议输出 `tableMarkdown` 或二维数组格式。
- **引用保真**：不要只删 `[1]`；可将引用链接单独提取为 `citations[]`。

### 7.4 平台与模型识别鲁棒性

- **域名变体兼容**：考虑 `www/chat` 子路径、A/B 实验路径、地区化域名。
- **模型名识别来源**：优先使用页面可见模型标签，其次使用请求元数据，最后回退为 `unknown`。
- **解析器版本标记**：每条结果附加 `parserVersion`，便于排查“网站改版导致失效”。

### 7.5 错误分级与可观测性

- 建议引入标准错误码：
  - `UNSUPPORTED_SITE`
  - `NO_MESSAGES`
  - `DOM_CHANGED`
  - `CLIPBOARD_DENIED`
  - `PARTIAL_EXTRACT`
- **部分成功机制**：即使图片/文件失败，也返回文本结果并标记 `warnings[]`。
- **调试导出**：支持导出 `debugSnapshot`（裁剪后的节点信息），便于后续修复解析器。

### 7.6 性能与配额

- **大会话性能**：采用迭代器/分块序列化，避免一次性拼接超大字符串。
- **输出大小控制**：支持 `maxMessages` / `maxBytes`，超限时给出截断提示。
- **节流与防抖**：避免重复点击导致并发抓取。

### 7.7 安全与隐私

- **敏感信息脱敏（可选开关）**：邮箱、手机号、密钥样式字符串自动打码。
- **最小权限原则**：仅保留必要 `host_permissions`。
- **本地优先**：不上传会话数据到外部服务（除非用户明确开启）。

### 7.8 用户体验

- **预览模式**：复制前可预览/编辑提取结果。
- **导出格式**：除 JSON 外可选 Markdown（含图片与文件链接）。
- **成功反馈增强**：显示“提取条数、图片数、文件数、耗时”。

### 7.9 测试与验收建议

- 增加最小测试矩阵：
  - 平台：Gemini / Grok / ChatGPT
  - 内容：纯文本 / 代码块 / 图片 / 文件 / 混合消息
  - 状态：空会话 / 长会话 / 网络波动 / 页面改版（选择器失效）
- 建议引入“解析器回归样本库”：存储脱敏 HTML 片段，防止改动引入回归。




### 7.10 事实核实链路（Provenance）

- **来源可追溯**：每个引用链接应保留 `url + domain + title`，避免仅剩编号。
- **段落级映射**：建议支持消息段落到来源的映射（例如 `segments[i].citations`）。
- **时间上下文**：若可得，记录来源访问时间 `accessed_at`，便于后续审计。
- **去重归并**：同一 URL 在多个引用位出现时可归并，但需保留出现次数。

## 8. GitHub 文件同步与发布要求 (GitHub Sync & Release)

为确保“本地需求文档”与 GitHub 仓库保持一致，建议将以下流程纳入日常规范：

1. 每次需求更新后，先在本地执行格式与内容自检（章节编号、示例 JSON、链接有效性）。
2. 使用清晰 commit message（如 `docs: ...`）提交变更，并在 PR 描述中标注“新增/变更/删除”项。
3. PR 合并前，至少由 1 名协作者进行文档 review（重点检查 schema 兼容性）。
4. 合并后在 GitHub Release 或变更日志中记录本次文档版本（如 `spec v0.3`）。
5. 若 schema 发生不兼容变更，必须升级版本号并保留迁移说明（`migration notes`）。

建议新增文档版本字段（可放在 README 顶部或独立 `SPEC_VERSION` 文件），例如：

- `spec_version`: `0.3.0`
- `last_updated`: `YYYY-MM-DD`
- `breaking_changes`: `true/false`

