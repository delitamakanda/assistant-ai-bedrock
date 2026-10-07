/**
 * Worker de chat : reçoit `POST /chat` du front (GitHub Pages) et relaie les
 * messages vers Qwen3 (Workers AI) via le binding `AI`, en passant par la
 * passerelle Cloudflare AI Gateway (logs, cache, limites). Aucun secret requis.
 */
const ALLOWED_ORIGINS = [
	"http://localhost:4200",
	"https://delitamakanda.github.io",
];

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const ROLES = ['system', 'user', 'assistant'] as const;
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;
/** Qwen3 raisonne avant de répondre : la réserve doit couvrir le raisonnement et la réponse. */
const MAX_OUTPUT_TOKENS = 2000;

export interface Env {
	AI: Ai;
	AI_GATEWAY_ID: string;
}

interface ChatMessage {
	role: (typeof ROLES)[number];
	content: string;
}

/** Réponse de Workers AI au format chat completion (`response` : ancien format de certains modèles). */
function extractContent(result: unknown): string | undefined {
	if (typeof result !== 'object' || result === null) {
		return undefined;
	}
	const { choices, response } = result as {
		choices?: Array<{ message?: { content?: unknown } }>;
		response?: unknown;
	};
	const content = choices?.[0]?.message?.content ?? response;
	return typeof content === 'string' && content.trim() ? content : undefined;
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

	let result: unknown;
	try {
		result = await env.AI.run(
			MODEL,
			{ messages, temperature: 0.7, max_tokens: MAX_OUTPUT_TOKENS },
			{ gateway: { id: env.AI_GATEWAY_ID } },
		);
	} catch (error) {
		// Le détail reste dans les logs : on ne le renvoie pas au navigateur.
		console.error('Workers AI call failed', error);
		return json(request, { error: 'AI service returned an error' }, 502);
	}

	const content = extractContent(result);
	if (!content) {
		console.error('Workers AI returned no content', JSON.stringify(result));
		return json(request, { error: 'AI service returned an empty response' }, 502);
	}

	return json(request, { content });
}
