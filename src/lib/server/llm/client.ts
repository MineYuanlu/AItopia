/**
 * Lightweight OpenAI-compatible LLM client.
 * Uses native fetch() - no SDK dependency.
 */

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface LLMRequest {
	messages: LLMMessage[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	responseFormat?: { type: 'json_object' | 'text' };
	timeoutMs?: number;
}

export interface LLMResponse {
	content: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	latency: number; // ms
	finishReason?: string;
}

interface OpenAIChatResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string;
			refusal?: string | null;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export class LLMClient {
	private apiBase: string;
	private apiKey: string;
	private defaultModel: string;
	private defaultTimeoutMs: number = 30_000;
	private maxRetries: number = 3;

	constructor(config?: { apiBase?: string; apiKey?: string; model?: string; timeoutMs?: number }) {
		// Read from params, then env vars, then empty defaults (validated below)
		this.apiBase = config?.apiBase ?? process.env.LLM_API_BASE ?? '';
		this.apiKey = config?.apiKey ?? process.env.LLM_API_KEY ?? '';
		this.defaultModel = config?.model ?? process.env.LLM_MODEL ?? '';
		if (config?.timeoutMs) {
			this.defaultTimeoutMs = config.timeoutMs;
		}

		if (!this.apiBase) {
			throw new Error('LLMClient: apiBase is required (pass config.apiBase or set LLM_API_BASE)');
		}
		if (!this.apiKey) {
			throw new Error('LLMClient: apiKey is required (pass config.apiKey or set LLM_API_KEY)');
		}
		if (!this.defaultModel) {
			throw new Error('LLMClient: model is required (pass config.model or set LLM_MODEL)');
		}
	}

	/**
	 * Send a chat completion request to the LLM API.
	 */
	async chat(request: LLMRequest): Promise<LLMResponse> {
		const url = `${this.apiBase}/chat/completions`;
		const model = request.model ?? this.defaultModel;
		const body = {
			model,
			messages: request.messages,
			temperature: request.temperature ?? 1.0,
			max_tokens: request.maxTokens ?? 2048,
			response_format: request.responseFormat ?? { type: 'text' }
		};
		const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;

		const startTime = performance.now();
		let lastError: Error | undefined;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const res = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify(body),
					signal: controller.signal
				});

				const responseText = await res.text();

				if (!res.ok) {
					// Retryable status codes: 429 (rate limit), 502 (bad gateway), 503 (service unavailable)
					if (res.status === 429 || res.status === 502 || res.status === 503) {
						lastError = new Error(
							`LLM API error: ${res.status} ${res.statusText}\nResponse: ${responseText}`
						);
						const delay = Math.min(1000 * 2 ** attempt, 8000);
						await sleep(delay);
						continue;
					}
					throw new Error(
						`LLM API error: ${res.status} ${res.statusText}\n` + `Response: ${responseText}`
					);
				}

				clearTimeout(timer);
				const latency = Math.round(performance.now() - startTime);

				let parsed: OpenAIChatResponse;
				try {
					parsed = JSON.parse(responseText) as OpenAIChatResponse;
				} catch {
					throw new Error(`Invalid JSON from LLM API: ${responseText.slice(0, 500)}`);
				}

				const choice = parsed.choices[0];
				if (!choice) {
					throw new Error('No choices in LLM response');
				}

				const content = choice.message.content ?? '';
				const finishReason = choice.finish_reason;
				if (finishReason === 'length') {
					console.warn('[LLM] Response truncated due to length limit');
				} else if (finishReason === 'content_filter') {
					console.warn('[LLM] Response blocked by content filter');
				}

				const usage = parsed.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

				const llmResponse: LLMResponse = {
					content,
					usage: {
						promptTokens: usage.prompt_tokens,
						completionTokens: usage.completion_tokens,
						totalTokens: usage.total_tokens
					},
					model: parsed.model,
					latency,
					finishReason
				};

				// Log token usage for MVP (console for now, DB later)
				console.log(
					`[LLM] model=${llmResponse.model} latency=${llmResponse.latency}ms ` +
						`tokens=${llmResponse.usage.totalTokens} ` +
						`(prompt=${llmResponse.usage.promptTokens}, completion=${llmResponse.usage.completionTokens})`
				);

				return llmResponse;
			} catch (err) {
				clearTimeout(timer);
				if (err instanceof TypeError && err.message.includes('fetch')) {
					lastError = new Error(`LLM request failed: network error (${err.message})`);
					const delay = Math.min(1000 * 2 ** attempt, 8000);
					await sleep(delay);
					continue;
				}
				if (err instanceof Error && err.name === 'AbortError') {
					lastError = new Error(`LLM request timed out after ${timeoutMs}ms`);
					continue;
				}
				throw err;
			}
		}

		throw lastError ?? new Error('LLM request failed after max retries');
	}

	/**
	 * Wrapper that automatically sets responseFormat to json_object
	 * and parses the response content as JSON.
	 */
	async chatJSON<T>(request: LLMRequest): Promise<{ data: T; response: LLMResponse }> {
		const jsonRequest: LLMRequest = {
			...request,
			responseFormat: { type: 'json_object' }
		};

		const response = await this.chat(jsonRequest);

		let data: T;
		try {
			// Handle potential markdown code fences
			const cleaned = response.content
				.replace(/^```json\s*/, '')
				.replace(/```\s*$/, '')
				.trim();
			data = JSON.parse(cleaned) as T;
		} catch (err) {
			throw new Error(
				`Failed to parse LLM response as JSON:\n` +
					`Error: ${err instanceof Error ? err.message : String(err)}\n` +
					`Content: ${response.content.slice(0, 1000)}`
			);
		}

		return { data, response };
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
