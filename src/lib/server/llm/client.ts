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

	constructor(config?: { apiBase?: string; apiKey?: string; model?: string }) {
		// Read from params, then env vars, then hardcoded defaults
		this.apiBase =
			config?.apiBase ??
			process.env.LLM_API_BASE ??
			'https://api-ad-ops-prod-advibe.nioint.com/v1';
		this.apiKey = config?.apiKey ?? process.env.LLM_API_KEY ?? '';
		this.defaultModel = config?.model ?? process.env.LLM_MODEL ?? 'Kimi-K2.6';
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

		const startTime = performance.now();
		let responseText: string;

		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`
				},
				body: JSON.stringify(body)
			});

			responseText = await res.text();

			if (!res.ok) {
				throw new Error(
					`LLM API error: ${res.status} ${res.statusText}\n` + `Response: ${responseText}`
				);
			}
		} catch (err) {
			if (err instanceof TypeError && err.message.includes('fetch')) {
				throw new Error(`LLM request failed: network error (${err.message})`);
			}
			throw err;
		}

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
		const usage = parsed.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

		const llmResponse: LLMResponse = {
			content,
			usage: {
				promptTokens: usage.prompt_tokens,
				completionTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens
			},
			model: parsed.model,
			latency
		};

		// Log token usage for MVP (console for now, DB later)
		console.log(
			`[LLM] model=${llmResponse.model} latency=${llmResponse.latency}ms ` +
				`tokens=${llmResponse.usage.totalTokens} ` +
				`(prompt=${llmResponse.usage.promptTokens}, completion=${llmResponse.usage.completionTokens})`
		);

		return llmResponse;
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
