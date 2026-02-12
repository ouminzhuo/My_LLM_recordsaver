# Gemini Chat Extractor - Chrome Extension Module

## 1. 项目概述 (Project Overview)

本项目是 "Gemini to Obsidian Canvas" 知识流转系统的数据提取层（Data Extraction Layer）。 **目标**：构建一个 Chrome 浏览器扩展（Manifest V3），用于从 Google Gemini 网页端 (`gemini.google.com`) 提取当前的完整对话历史，并将其清洗为结构化的 JSON 数据，以便后续进行 AI 总结和 Obsidian 导入。

## 2. 技术栈 (Tech Stack)

- **Manifest Version**: V3
    
- **Language**: Vanilla JavaScript (ES6+)
    
- **Target Platform**: Google Chrome / Edge
    
- **Permissions**: `activeTab`, `scripting`
    

## 3. 文件结构 (Directory Structure)

Plaintext

```
/gemini-extractor
│── manifest.json      # 插件配置
│── popup.html         # 插件弹窗界面 (包含 "Extract" 按钮)
│── popup.js           # 弹窗逻辑 (发送消息给 content script)
│── content.js         # 核心逻辑：注入页面，解析 DOM，提取数据
│── background.js      # Service Worker (可选，用于处理快捷键或跨域请求)
│── styles.css         # 简单的 UI 样式
└── README.md          # 本文档
```

## 4. 数据结构规范 (Data Schema)

插件必须输出以下格式的 JSON 数组。这是后续 "AI 逻辑处理层" 的输入标准。

JSON

```
[
  {
    "id": "msg_001",              // (可选) 消息唯一标识
    "role": "user",               // 枚举: "user" | "model"
    "timestamp": "HH:MM",         // (可选) 提取时间戳
    "content": "这里是用户的提问文本...",
    "meta": {
      "hasImage": true,           // 是否包含图片
      "imageUrls": ["..."]        // (可选) 图片链接
    }
  },
  {
    "id": "msg_002",
    "role": "model",
    "content": "这里是 Gemini 的回答内容...",
    "raw_html": "<div>...</div>"  // (可选) 保留原始 HTML 用于后续复杂解析（如表格/代码块）
  }
]
```

## 5. 核心功能逻辑 (Functional Requirements)

### 5.1 DOM 解析策略 (Critical)

Gemini 的 DOM 类名可能是动态混淆的（如 `class="lb67"`），因此代码**不能硬编码**随机类名。必须使用**语义化选择器**或**相对结构查询**。

- **容器识别**：查找包含对话流的主容器（通常带有 `role="main"` 或特定的 ARIA 标签）。
    
- **消息行识别**：
    
    - **User**: 通常包含用户的头像，或特定的 `data-testid="user-message"` 属性（需动态检测）。
        
    - **Model**: 通常包含 Gemini 的图标，或 `data-testid="model-response"`。
        
- **文本提取**：
    
    - 提取纯文本 (`innerText`)。
        
    - 保留代码块格式（识别 ` ``` ` 标记）。
        

### 5.2 数据清洗 (Data Cleaning)

在提取过程中，必须移除以下噪音元素：

- 底部的 "Show drafts"（查看草稿）按钮。
    
- "Regenerate draft"（重新生成）图标。
    
- "Modify response"（修改回答）工具栏。
    
- 引用来源的角标（如 `[1]`, `[2]`）。
    
- 无关的 SVG 图标文本。
    

### 5.3 交互流程 (User Flow)

1. 用户在 Gemini 页面点击插件图标。
    
2. 弹出 Popup，显示 "Extract Chat" 按钮。
    
3. 点击按钮后，`content.js` 执行抓取。
    
4. **反馈**：抓取成功后，将 JSON **自动复制到剪贴板**，并在 Popup 中显示 "Success! Copied to clipboard" 提示。
    
5. (进阶可选) 提供 "Download .json" 按钮直接下载文件。
    

## 6. 开发提示 (Prompt for AI Coder)

> **给 AI 助手的指令：** 请基于上述文档，编写 `manifest.json`, `popup.html`, `popup.js`, 和 `content.js`。
> 
> **特别注意 `content.js` 的实现：** 由于 Gemini 页面结构复杂，请编写一个名为 `parseGeminiChat()` 的函数。该函数应该遍历 DOM，尝试通过 `querySelectorAll` 查找对话气泡。如果找不到确切的 class，请尝试使用 `innerText` 长度或特定的子元素（如 `<img>` 标签作为头像）来启发式地判断是 User 还是 Model。
> 
> **Manifest 配置：** 确保 `host_permissions` 包含 `https://gemini.google.com/*`。
