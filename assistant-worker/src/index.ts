/**
 * Worker de chat : reçoit `POST /chat` du front (GitHub Pages) et relaie les
 * messages vers Claude (AWS Bedrock) via Cloudflare AI Gateway.
 *
 * Secret requis : `CF_AIG_TOKEN` (`npx wrangler secret put CF_AIG_TOKEN`).
 */
const ALLOWED_ORIGINS = [
	"http://localhost:4200",
	"https://delitamakanda.github.io",
];

const MODEL = 'aws-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0';
const ROLES = ['system', 'user', 'assistant'] as const;
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;

export interface Env {
	CLOUDFLARE_ACCOUNT_ID: string;
	AI_GATEWAY_ID: string;
	CF_AIG_TOKEN: string;
}

interface ChatMessage {
	role: (typeof ROLES)[number];
	content: string;
}

interface GatewayResponse {
	choices?: Array<{ message?: { content?: string } }>;
}

function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin');
	if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
		return {};
	}
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400',
		'Vary': 'Origin',
	};
}

/** Toutes les réponses passent par ici : sans en-têtes CORS, le navigateur masque l'erreur réelle. */
function json(request: Request, body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
	});
}

function parseMessages(body: unknown): ChatMessage[] | null {
	if (typeof body !== 'object' || body === null || !('messages' in body)) {
		return null;
	}
	const { messages } = body as { messages: unknown };
	if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
		return null;
	}
	const valid = messages.every(
		(message): message is ChatMessage =>
			typeof message === 'object' &&
			message !== null &&
			ROLES.includes(message.role) &&
			typeof message.content === 'string' &&
			message.content.trim().length > 0 &&
			message.content.length <= MAX_CONTENT_LENGTH,
	);
	return valid ? messages.map(({ role, content }) => ({ role, content })) : null;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			if (request.method === 'OPTIONS') {
				return new Response(null, { status: 204, headers: corsHeaders(request) });
			}
			const url = new URL(request.url);
			if (request.method === 'POST' && url.pathname === '/chat') {
				return await handleChatRequest(request, env);
			}
			return json(request, { error: 'Not Found' }, 404);
		} catch (error) {
			console.error('Unhandled error', error);
			return json(request, { error: 'Internal Server Error' }, 500);
		}
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
	if (!env.CF_AIG_TOKEN) {
		console.error('CF_AIG_TOKEN is not set: run `wrangler secret put CF_AIG_TOKEN`');
		return json(request, { error: 'Server is not configured' }, 500);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(request, { error: 'Request body must be valid JSON' }, 400);
	}

	const messages = parseMessages(body);
	if (!messages) {
		return json(
			request,
			{ error: `"messages" must be a list of 1 to ${MAX_MESSAGES} items with a valid role and a non-empty content` },
			400,
		);
	}

	const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/compat/chat/completions`;

	let response: Response;
	try {
		response = await fetch(gatewayUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`,
			},
			body: JSON.stringify({
				model: MODEL,
				messages,
				temperature: 0.7,
				max_tokens: 1000,
			}),
		});
	} catch (error) {
		console.error('AI Gateway unreachable', error);
		return json(request, { error: 'AI service unreachable' }, 502);
	}

	if (!response.ok) {
		// Le détail reste dans les logs : on ne renvoie pas le texte brut de la passerelle au navigateur.
		console.error(`AI Gateway responded ${response.status}`, await response.text());
		return json(request, { error: 'AI service returned an error', upstreamStatus: response.status }, 502);
	}

	let content: string | undefined;
	try {
		const data = (await response.json()) as GatewayResponse;
		content = data.choices?.[0]?.message?.content;
	} catch (error) {
		console.error('AI Gateway returned an invalid response', error);
	}
	if (!content) {
		return json(request, { error: 'AI service returned an empty response' }, 502);
	}

	return json(request, { content });
}
