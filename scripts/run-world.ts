#!/usr/bin/env node

/**
 * AItopia MVP 0.1 - World Simulation CLI
 *
 * Usage:
 *   DATABASE_URL=local.db npx tsx scripts/run-world.ts           # Auto mode
 *   DATABASE_URL=local.db npx tsx scripts/run-world.ts --step    # Step mode
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// 1. Load .env BEFORE any ESM imports that might read process.env
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
	console.warn('[CLI] dotenv load failed:', dotenvResult.error.message);
} else {
	console.log('[CLI] dotenv loaded from', dotenvResult.parsed ? Object.keys(dotenvResult.parsed).length : 0, 'vars');
}

// Ensure DATABASE_URL is available for db/index.ts which reads it at import time
if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = path.join(projectRoot, 'local.db');
	console.log('[CLI] DATABASE_URL not set, defaulting to', process.env.DATABASE_URL);
} else {
	console.log('[CLI] DATABASE_URL =', process.env.DATABASE_URL);
}

// Resolve $lib to the actual src/lib path, so all internal imports work
const $libPath = path.join(projectRoot, 'src', 'lib');
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// 2. Resolve $lib imports via Node monkey-patch
// ---------------------------------------------------------------------------
const Module = require('module');
const originalResolveFilename = Module._resolveFilename.bind(Module);
// @ts-expect-error — monkey-patching Node internals
Module._resolveFilename = (request: string, parent: string, isMain: boolean, options?: unknown) => {
	if (request.startsWith('$lib/')) {
		request = path.join($libPath, request.slice('$lib/'.length));
	}
	return originalResolveFilename(request, parent, isMain, options);
};

// ---------------------------------------------------------------------------
// 3. Imports (resolved via the monkey-patch above)
// ---------------------------------------------------------------------------
import { WorldKernel } from '$lib/server/game/world/world-kernel';
import { Scheduler } from '$lib/server/game/tick/scheduler';
import { LLMClient } from '$lib/server/llm/client';
import { AgentGenerator } from '$lib/server/game/agents/agent-generator';
import { AgentFactory } from '$lib/server/game/agents/agent-factory';
import { closeDb } from '$lib/server/db';
import type { Agent } from '$lib/server/game/agents/agent';
import type { GeneratedAgent } from '$lib/server/game/agents/agent-generator';

// ---------------------------------------------------------------------------
// 4. CLI helpers
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const mode = args.includes('--step') ? 'step' : 'auto';
const tickInterval = mode === 'auto' ? 2000 : 0; // ms between ticks in auto mode

function formatTime(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600) % 24;
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getAgentNameByEntityId(agents: Agent[], entityId: string | null): string {
	if (!entityId) return 'System';
	const agent = agents.find((a) => a.getEntityId() === entityId);
	return agent?.getName() ?? 'Unknown';
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function prompt(message: string): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(message, (answer: string) => {
			rl.close();
			resolve(answer);
		});
	});
}

// ---------------------------------------------------------------------------
// 5. Fallback agents (used when LLM is unavailable)
// ---------------------------------------------------------------------------
function getFallbackAgents(): GeneratedAgent[] {
	return [
		{
			名称: '小明',
			性别: '男',
			生日: '1998-03-15',
			身高: 175,
			体重: 68,
			智商: 85,
			体力: 80,
			智慧: 70,
			幸运: 60,
			性格: ['开朗', '热心'],
			职业: '程序员',
			爱好: ['打游戏', '看电影'],
			技能: ['编程', '做饭'],
			身世: '来自南方小城，大学毕业后在这座大城市打拼',
			大记忆: ['大学室友关系很好', '第一次独自租房很紧张'],
			小记忆: ['今天搬家很累', '新室友看起来不错'],
			情绪: '兴奋',
			关系: []
		},
		{
			名称: '小红',
			性别: '女',
			生日: '1999-07-22',
			身高: 162,
			体重: 52,
			智商: 90,
			体力: 65,
			智慧: 85,
			幸运: 75,
			性格: ['细心', '温柔'],
			职业: '设计师',
			爱好: ['画画', '瑜伽'],
			技能: ['平面设计', '插画'],
			身世: '艺术世家出身，从小学习绘画',
			大记忆: ['大学毕业设计获了奖', '养过一只猫叫汤圆'],
			小记忆: ['行李箱还没整理完', '客厅的阳光很好'],
			情绪: '平静',
			关系: []
		},
		{
			名称: '阿强',
			性别: '男',
			生日: '1997-11-08',
			身高: 180,
			体重: 75,
			智商: 75,
			体力: 95,
			智慧: 60,
			幸运: 80,
			性格: ['直率', '豪爽'],
			职业: '健身教练',
			爱好: ['健身', '吃美食'],
			技能: ['力量训练', '营养搭配'],
			身世: '体育院校毕业，梦想开一家自己的健身房',
			大记忆: ['大学时是篮球队队长', '曾经减重30斤'],
			小记忆: ['搬家的货车迟到了', '新社区的健身房看起来不错'],
			情绪: '期待',
			关系: []
		}
	];
}

// ---------------------------------------------------------------------------
// 6. Main simulation
// ---------------------------------------------------------------------------
async function main(): Promise<{ world: WorldKernel }> {
	console.log('🏰 AItopia MVP 0.1 - World Simulation');
	console.log(`Mode: ${mode} (${mode === 'auto' ? 'auto-running' : 'press Enter to step'})`);
	console.log('');

	// Initialize LLM client
	let llm: LLMClient | undefined;
	try {
		llm = new LLMClient();
	} catch (err) {
		console.warn('⚠️ LLMClient init failed:', err instanceof Error ? err.message : String(err));
		llm = undefined;
	}

	// Create world
	console.log('🌍 Creating world...');
	const world = await WorldKernel.create('幸福小区203');
	console.log(`✅ World created: ${world.worldId}`);

	// Get the living room scene (created by WorldKernel.create)
	const rootScene = world.sceneTree.getRootScene();
	if (!rootScene) throw new Error('No root scene');
	const scenes = world.sceneTree.getChildren(rootScene.id);
	const livingRoom = scenes[0]; // The first child scene is the living room
	if (!livingRoom) throw new Error('No living room scene found');
	console.log(`🏠 Scene: ${world.sceneTree.getScenePath(livingRoom.id)}`);

	// Generate 3 agents via LLM (with fallback)
	console.log('🎲 Generating agents via LLM...');
	const generator = new AgentGenerator(llm);

	let generatedAgents: GeneratedAgent[];
	try {
		generatedAgents = await generator.generateAgents(3, '刚搬入合租公寓的年轻人');
		console.log(`✅ Generated ${generatedAgents.length} agents via LLM:`);
	} catch (err) {
		console.warn('⚠️ LLM generation failed, using fallback agents:',
			err instanceof Error ? err.message : String(err));
		generatedAgents = getFallbackAgents();
		console.log(`✅ Using ${generatedAgents.length} fallback agents:`);
	}

	for (const agent of generatedAgents) {
		console.log(`   - ${agent.名称} (${agent.性别}), ${agent.职业}, ${agent.性格.join('/')}`);
	}
	console.log('');

	// Create agents in world
	const agents: Agent[] = [];

	// First agent is Player (LLM-driven)
	const player = AgentFactory.createPlayer(generatedAgents[0], world, livingRoom.id, llm);
	agents.push(player);

	// Other agents are NPCs (rule-based)
	for (let i = 1; i < generatedAgents.length; i++) {
		const npc = AgentFactory.createNPC(generatedAgents[i], world, livingRoom.id, undefined, i * 42);
		agents.push(npc);
	}

	console.log(`🎮 ${agents.length} agents ready`);
	console.log('');

	// Setup event display
	world.eventBus.onAny((event) => {
		const time = formatTime(world.getTime());

		if (event.type === 'SPEAK') {
			const agentName = getAgentNameByEntityId(agents, event.agentId);
			const content = event.data.content as string;
			console.log(`[${time}] ${agentName}: "${content}"`);
		} else if (event.type === 'MOVE') {
			const agentName = getAgentNameByEntityId(agents, event.data.entityId as string);
			const toSceneId = event.data.toSceneId as string | undefined;
			const direction = event.data.direction as string | undefined;
			const dest = toSceneId
				? world.sceneTree.getScene(toSceneId)?.name ?? 'somewhere'
				: direction ?? 'somewhere';
			console.log(`[${time}] ${agentName} moved to ${dest}`);
		} else if (event.type === 'TIME_ADVANCE') {
			console.log(`[${time}] ⏰ Time advanced by ${event.data.advancedBy}s`);
			// Show agent energy levels periodically
			const advancedBy = event.data.advancedBy as number;
			if (advancedBy >= 60) {
				const energyInfo = agents
					.map((a) => {
						const stats = world.entityStore.getComponent(a.getEntityId(), 'Stats');
						return `${a.getName()}:${stats?.energy ?? '?'}`;
					})
					.join(' ');
				console.log(`[${time}] ⚡ Energy: ${energyInfo}`);
			}
		} else if (event.type === 'AGENT_ACTION' && (event.data.action as { type: string } | undefined)?.type === 'WAIT') {
			// Don't print WAIT actions to keep output clean
		}
		// Note: thoughts are NEVER printed (requirement)
	});

	// Setup graceful shutdown
	let isRunning = true;
	let shouldShutdown = false;
	process.on('SIGINT', async () => {
		console.log('\n\n🛑 SIGINT received, shutting down gracefully...');
		shouldShutdown = true;
		isRunning = false;
		try {
			await world.flush();
			await world.saveSnapshot();
			console.log('💾 Snapshot saved on shutdown');
		} catch (e) {
			console.error('Failed to save snapshot on shutdown:', e);
		} finally {
			closeDb();
			process.exit(0);
		}
	});

	// Main game loop
	console.log('🚀 Starting simulation...\n');

	const scheduler = new Scheduler(world.eventBus, world.getTime());

	// Schedule initial agent decisions
	for (const agent of agents) {
		scheduler.scheduleIn(0, 1, {
			type: 'AGENT_DECIDE',
			agentId: agent.getEntityId(),
			data: { agentId: agent.getEntityId() }
		});
	}

	while (isRunning) {
		// Process any scheduled events
		const events = scheduler.tick();

		// For each AGENT_DECIDE event, let that agent act
		for (const event of events) {
			if (event.type === 'AGENT_DECIDE') {
				const agent = agents.find((a) => a.getEntityId() === event.agentId);
				if (agent) {
					try {
						const intent = await agent.tick();
						if (intent) {
							// Schedule next decision after this action's time
							scheduler.scheduleIn(intent.timeAdvanceSeconds, 1, {
								type: 'AGENT_DECIDE',
								agentId: agent.getEntityId(),
								data: { agentId: agent.getEntityId() }
							});

							// Advance world time
							world.advanceTime(intent.timeAdvanceSeconds);

							// Sync scheduler time with world time
							scheduler.setTime(world.getTime());
						}
					} catch (error) {
						console.error(`Agent ${agent.getName()} error:`, error);
					}
				}
			}
		}

		// Flush events to DB periodically
		await world.flush();

		if (mode === 'step') {
			// Wait for user input
			const answer = await prompt('Press Enter to continue (or type "exit" to quit)...');
			if (answer.trim().toLowerCase() === 'exit' || shouldShutdown) {
				isRunning = false;
				if (shouldShutdown) {
					console.log('\n🛑 Exiting due to shutdown signal...');
				} else {
					console.log('\n🛑 Exiting...');
				}
			}
		} else {
			// Auto mode: wait between ticks
			if (shouldShutdown) {
				isRunning = false;
			} else {
				await sleep(tickInterval);
			}
		}
	}

	return { world };
}

main()
	.then(async ({ world }) => {
		// flush + save on normal completion
		try {
			await world.flush();
			await world.saveSnapshot();
			console.log('💾 Snapshot saved');
		} catch (e) {
			console.error('Failed to save snapshot on exit:', e);
		} finally {
			closeDb();
		}
	})
	.catch(async (err) => {
		console.error('Fatal error:', err);
		closeDb();
		process.exit(1);
	});
