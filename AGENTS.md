## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, mdsvex, mcp

---

## 🎯 项目推进规范

**本项目的核心架构设计文档位于 `doc/项目架构总体规划.md`。所有开发工作必须严格遵循该文档中的决策和设计。**

### 必须遵循的设计决策

| # | 决策项 | 要求 |
|---|---|---|
| 1 | **LLM 接入** | 使用 LiteLLM 适配层，JSON 配置模型路由。先只支持 OpenAI-compatible API。记录 token 消耗 |
| 2 | **动态代码** | 默认用 DSL JSON（precondition → effect），复杂场景才用 QuickJS 沙箱。绝不直接 eval |
| 3 | **真人介入** | 支持 A(附身)+B(副本交互)+C(上帝模式) 全部三种，HumanProxy 统一入口 |
| 4 | **版本控制** | 整个世界级别 fork/revert，Event Sourcing + Snapshot |
| 5 | **前端模式** | 面板模式为主：顶部状态栏 + 多栏可切换面板 + 底部操作区 |

### 开发优先级

1. **先做内核后做界面** — 先让 tick 循环和 Agent 决策跑起来，哪怕没有前端
2. **先做主角后做 NPC** — 先实现 Player Agent 的完整 LLM 交互，再实现 NPC 的规则调度
3. **先做单模型后做路由** — 先用一个模型跑通全流程，再加入多模型路由
4. **先 DSL 后 QuickJS** — 先用 JSON 规则满足大部分需求，复杂场景再引入沙箱

### 当前阶段

根据开发路线图，当前应推进 **MVP 0.1**：
- **目标**：3 个 Agent 在 1 个房间里生活 1 游戏天
- **关键交付物**：可行走的 tick 循环，LLM 指令真正改变世界状态
- **技术重点**：Scene 树 + ECS + Scheduler + LLM 客户端

---

## Available Svelte MCP Tools

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
