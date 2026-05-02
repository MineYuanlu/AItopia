import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMClient } from './client';

const mockFetch = vi.fn();

describe('LLMClient', () => {
	beforeEach(() => {
		global.fetch = mockFetch;
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('should use provided config values', () => {
			const client = new LLMClient({
				apiBase: 'https://custom.api.com/v1',
				apiKey: 'custom-key',
				model: 'custom-model'
			});

			// Verify by checking the client properties indirectly through a request
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'custom-model',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'Hello' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
					})
			});

			return client.chat({ messages: [{ role: 'user', content: 'Hi' }] }).then(() => {
				const call = mockFetch.mock.calls[0];
				expect(call[0]).toBe('https://custom.api.com/v1/chat/completions');
				expect(call[1].headers.Authorization).toBe('Bearer custom-key');
				const body = JSON.parse(call[1].body);
				expect(body.model).toBe('custom-model');
			});
		});

		it('should use default values when no config provided', async () => {
			// Save original env
			const originalBase = process.env.LLM_API_BASE;
			const originalKey = process.env.LLM_API_KEY;
			const originalModel = process.env.LLM_MODEL;

			// Clear env vars
			delete process.env.LLM_API_BASE;
			delete process.env.LLM_API_KEY;
			delete process.env.LLM_MODEL;

			// Need to create client AFTER clearing env
			const defaultClient = new LLMClient();

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'Hello' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
					})
			});

			await defaultClient.chat({ messages: [{ role: 'user', content: 'Hi' }] });

		const call = mockFetch.mock.calls.at(-1)!;
		expect(call[0]).toBe('https://api-ad-ops-prod-advibe.nioint.com/v1/chat/completions');
		expect(call[1].headers.Authorization).toBe('Bearer ');
		const body = JSON.parse(call[1].body);
			expect(body.model).toBe('Kimi-K2.6');

			// Restore env
			if (originalBase !== undefined) process.env.LLM_API_BASE = originalBase;
			if (originalKey !== undefined) process.env.LLM_API_KEY = originalKey;
			if (originalModel !== undefined) process.env.LLM_MODEL = originalModel;
		});

		it('should prefer env vars over defaults', async () => {
			// Save original env
			const originalBase = process.env.LLM_API_BASE;
			const originalKey = process.env.LLM_API_KEY;
			const originalModel = process.env.LLM_MODEL;

			process.env.LLM_API_BASE = 'https://env.api.com/v1';
			process.env.LLM_API_KEY = 'env-key';
			process.env.LLM_MODEL = 'env-model';

			const envClient = new LLMClient();

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'env-model',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'Hello' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
					})
			});

		await envClient.chat({ messages: [{ role: 'user', content: 'Hi' }] });

		const call = mockFetch.mock.calls.at(-1)!;
		expect(call[0]).toBe('https://env.api.com/v1/chat/completions');
		expect(call[1].headers.Authorization).toBe('Bearer env-key');
		const body = JSON.parse(call[1].body);
		expect(body.model).toBe('env-model');

			// Restore env
			if (originalBase !== undefined) process.env.LLM_API_BASE = originalBase; else delete process.env.LLM_API_BASE;
			if (originalKey !== undefined) process.env.LLM_API_KEY = originalKey; else delete process.env.LLM_API_KEY;
			if (originalModel !== undefined) process.env.LLM_MODEL = originalModel; else delete process.env.LLM_MODEL;
		});
	});

	describe('chat', () => {
		it('should send correct request body', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'Hello world' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
					})
			});

			const response = await client.chat({
				messages: [
					{ role: 'system', content: 'You are a test' },
					{ role: 'user', content: 'Say hello' }
				],
				temperature: 0.5,
				maxTokens: 100,
				responseFormat: { type: 'json_object' }
			});

			expect(response.content).toBe('Hello world');
			expect(response.usage.promptTokens).toBe(5);
			expect(response.usage.completionTokens).toBe(2);
			expect(response.usage.totalTokens).toBe(7);
			expect(response.model).toBe('Kimi-K2.6');
			expect(response.latency).toBeGreaterThanOrEqual(0);

			const call = mockFetch.mock.calls.at(-1)!;
			const body = JSON.parse(call[1].body);
			expect(body.messages).toHaveLength(2);
			expect(body.temperature).toBe(0.5);
			expect(body.max_tokens).toBe(100);
			expect(body.response_format).toEqual({ type: 'json_object' });
		});

		it('should use default temperature and maxTokens when not provided', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'Hi' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
					})
			});

			await client.chat({ messages: [{ role: 'user', content: 'Hi' }] });

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.temperature).toBe(1.0);
			expect(body.max_tokens).toBe(2048);
			expect(body.response_format).toEqual({ type: 'text' });
		});

		it('should throw on API error', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: async () => '{"error": "Invalid API key"}'
			});

			await expect(client.chat({ messages: [{ role: 'user', content: 'Hi' }] })).rejects.toThrow(
				'401 Unauthorized'
			);
		});

		it('should throw on network error', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

			await expect(client.chat({ messages: [{ role: 'user', content: 'Hi' }] })).rejects.toThrow(
				'network error'
			);
		});

		it('should throw on invalid JSON response', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => 'not-json'
			});

			await expect(client.chat({ messages: [{ role: 'user', content: 'Hi' }] })).rejects.toThrow(
				'Invalid JSON'
			);
		});
	});

	describe('chatJSON', () => {
		it('should parse valid JSON response', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: '{"think":"ok","result":[1,2]}' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
					})
			});

			const { data, response } = await client.chatJSON<{ think: string; result: number[] }>({
				messages: [{ role: 'user', content: 'Give me numbers' }]
			});

			expect(data.think).toBe('ok');
			expect(data.result).toEqual([1, 2]);
			expect(response.content).toBe('{"think":"ok","result":[1,2]}');
		});

		it('should strip markdown code fences', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: {
									role: 'assistant',
									content: '```json\n{"key": "value"}\n```'
								},
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
					})
			});

			const { data } = await client.chatJSON<{ key: string }>({
				messages: [{ role: 'user', content: 'Give me JSON' }]
			});

			expect(data.key).toBe('value');
		});

		it('should throw on malformed JSON', async () => {
			const client = new LLMClient({ apiKey: 'test-key' });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () =>
					JSON.stringify({
						id: '1',
						object: 'chat.completion',
						created: 1234567890,
						model: 'Kimi-K2.6',
						choices: [
							{
								index: 0,
								message: { role: 'assistant', content: 'not-json' },
								finish_reason: 'stop'
							}
						],
						usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
					})
			});

			await expect(
				client.chatJSON({ messages: [{ role: 'user', content: 'Hi' }] })
			).rejects.toThrow('Failed to parse LLM response as JSON');
		});
	});
});
