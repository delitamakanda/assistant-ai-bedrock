/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
const ALLOWED_ORIGINS = [
	"http://localhost:4200",
	"https://delitamakanda.github.io",
];

function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("Origin");
	if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
		return {};
	}
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Allow-Credentials': 'true',
		'Vary': 'Origin',
	};
}

interface Env {
	CLOUDFLARE_ACCOUNT_ID: string;
	AI_GATEWAY_ID: string;
	CF_AIG_TOKEN: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  mode?: 'auto' | 'fast' | 'reasoning';
}

interface ChatResponse {
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
	}>;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(request),
			});
		}
		const url = new URL(request.url);
		if (request.method === 'POST' && url.pathname === '/chat') {
			return handleChatRequest(request, env, ctx);
		}
		
		return new Response(JSON.stringify({error: 'Not Found'}), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

	const requestBody = await request.json<ChatRequest>();

	const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/compat/chat/completions`;

	const response = await fetch(gatewayUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
		},
		body: JSON.stringify({
			model:'aws-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0',
			messages: requestBody.messages,
			mode: requestBody.mode || 'auto',
			temperature: 0.7,
			max_tokens: 1000,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		return new Response(JSON.stringify({error: `Gateway request failed with status ${response.status}: ${errorText}`}), { status: 500 });
	}

	const responseBody = await response.json<ChatResponse>();

	const content = responseBody.choices[0]?.message?.content || '';

	return new Response(JSON.stringify({ content }), {
		status: response.status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
	});
}
