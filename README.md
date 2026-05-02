# 🏰 AItopia 2.0 — AI 乌托邦

> **基于大模型的纯文字模拟人生 / 类星露谷沙盒世界**
> 每个角色由独立 LLM 驱动，在无限嵌套的世界中自主生活、交互与涌现叙事。

---

## 🌟 项目愿景

AItopia 是一款基于大语言模型的纯文字模拟人生仿真游戏。玩家以"上帝"的视角观察、介入并影响一个由 AI 驱动的虚拟世界。

在这个世界中：
- 🧠 **每个角色都有独立心智** —— 由 LLM 驱动，具有感知、记忆、情绪和自主决策能力
- 🌍 **世界是无限嵌套的** —— 从小镇到房间到物品，Scene 树无限延伸
- ⏰ **时间从不固定流逝** —— 世界只在"有事发生"时前进，无事时 LLM 直接跳到下一个有意义时刻
- 🎭 **故事自然涌现** —— 没有预设剧情，AI 交互自然产生叙事
- 👤 **真人无痕介入** —— 你可以附身任何角色、创建场景副本对话、或以上帝身份与系统 LLM 交流
- 🔄 **世界可分叉回退** —— 像 Git 一样 fork/revert，探索不同可能性

---

## 🏗️ 核心架构

本项目采用**五层确定性引擎 + Specialist LLM 编排**架构：

```
┌─────────────────────────────────────┐
│  L5: 前端 (Svelte 5 + SvelteKit 2)  │  面板模式：世界状态栏 + 可切换面板区
├─────────────────────────────────────┤
│  L4: API 网关 (+server.ts)           │  SSE 实时流 + 上帝指令 + 分支操作
├─────────────────────────────────────┤
│  L3: 编排层 Conductor               │  EventBus / ActionDAG / ModelRouter / HumanProxy
├─────────────────────────────────────┤
│  L2: Specialist LLM × 5             │  主交互 / 记忆 / 叙事 / 时间 / 代码
├─────────────────────────────────────┤
│  L1: 世界内核 (确定性引擎)            │  SceneTree / ECS / Rule Engine / EventQueue
├─────────────────────────────────────┤
│  L0: 持久化 (SQLite + Drizzle)       │  Current State / Event Log / Snapshots / Memories
└─────────────────────────────────────┘
```

**关键设计原则**：
- **引擎至上**：WorldKernel 是唯一真相源，LLM 只有建议权
- **按需唤醒**：日常行为走规则，关键时刻才调 LLM
- **安全分层**：DSL JSON 为主 → 受限表达式 → QuickJS 沙箱（按需）
- **Token 意识**：记录每次 LLM 调用的 token 消耗和延迟

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| Framework | SvelteKit v2 + Svelte 5 Runes |
| Language | TypeScript 5.7+ |
| Styling | Tailwind CSS v4 + shadcn-svelte |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| State | Svelte 5 Runes (`$state` in `.svelte.ts`) |
| Real-time | SSE (Server-Sent Events) |
| LLM | 自研轻量适配层，统一 OpenAI-compatible API，JSON 配置路由 |
| Code Sandbox | QuickJS (`quickjs-emscripten`，按需安装) |

---

## 📋 开发路线图

| 阶段 | 目标 | 时间预估 |
|------|------|----------|
| **MVP 0.1** | 3 个 Agent 在 1 个房间里生活 1 游戏天 | 2-3 周 |
| **V0.2** | 多房间地图 + 物品交互 + 场景移动 | 4-5 周 |
| **V0.3** | 日程系统 + 体力/时间压缩 + 事件调度 | 6-7 周 |
| **V0.4** | 记忆系统 + 对话系统 + 关系网 | 8-9 周 |
| **V0.5** | 版本控制 + 存档系统 (fork/revert) | 10-11 周 |
| **V0.6** | 真人介入系统 (附身/副本/上帝模式) | 12-13 周 |
| **V0.7** | LLM 配置系统 + 模型路由 | 14-15 周 |
| **V0.8** | 动态规则 + 代码沙箱 | 16-17 周 |
| **V1.0** | 类星露谷核心循环 | 18-20 周 |

---

## 📚 文档

- 📄 [`doc/项目架构总体规划.md`](doc/项目架构总体规划.md) — 完整架构设计（五层模型、核心技术点、目录结构、开发路线图）
- 🤖 [`AGENTS.md`](AGENTS.md) — AI 编码助手工作规范

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（SQLite）
npm run db:push

# 开发模式
npm run dev

# 运行测试
npm run test
```

---

> *"世界在有事情发生时才前进，无事发生时 LLM 决定跳到下一个有意义时刻。"*
