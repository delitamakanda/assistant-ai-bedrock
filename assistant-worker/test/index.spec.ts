import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const ORIGIN = "https://delitamakanda.github.io";
const testEnv = { ...env, CF_AIG_TOKEN: "test-token" } as unknown as Env;

function chat(body: unknown, origin: string | null = ORIGIN): Request {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (origin) headers.Origin = origin;
	return new Request("https://worker.test/chat", {
		method: "POST",
		headers,
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

const validBody = { messages: [{ role: "user", content: "Bonjour" }] };

function gatewayReplies(response: Response | Error) {
	const fetchMock = vi.fn(async () => {
		if (response instanceof Error) throw response;
		return response;
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("assistant worker", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("CORS", () => {
		it("répond au preflight pour une origine autorisée", async () => {
			const request = new Request("https://worker.test/chat", {
				method: "OPTIONS",
				headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
			});

			const response = await worker.fetch(request, testEnv);

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
		});

		it("n'autorise pas une origine inconnue", async () => {
			const request = new Request("https://worker.test/chat", {
				method: "OPTIONS",
				headers: { Origin: "https://evil.example" },
			});

			const response = await worker.fetch(request, testEnv);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("ajoute les en-têtes CORS aux réponses 404", async () => {
			const request = new Request("https://worker.test/", { headers: { Origin: ORIGIN } });

			const response = await worker.fetch(request, testEnv);

			expect(response.status).toBe(404);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
		});
	});

	describe("POST /chat", () => {
		it("renvoie la réponse du modèle", async () => {
			const fetchMock = gatewayReplies(
				Response.json({ choices: [{ message: { role: "assistant", content: "Salut !" } }] }),
			);

			const response = await worker.fetch(chat(validBody), testEnv);

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(await response.json()).toEqual({ content: "Salut !" });

			const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
			expect(url).toBe(
				`https://gateway.ai.cloudflare.com/v1/${testEnv.CLOUDFLARE_ACCOUNT_ID}/${testEnv.AI_GATEWAY_ID}/compat/chat/completions`,
			);
			expect((init.headers as Record<string, string>)["cf-aig-authorization"]).toBe("Bearer test-token");
			const sent = JSON.parse(init.body as string);
			expect(sent.messages).toEqual(validBody.messages);
			expect(sent).not.toHaveProperty("mode");
		});

		it("rejette un corps qui n'est pas du JSON, avec les en-têtes CORS", async () => {
			const response = await worker.fetch(chat("pas du json"), testEnv);

			expect(response.status).toBe(400);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
		});

		it.each([
			["sans messages", {}],
			["liste vide", { messages: [] }],
			["rôle inconnu", { messages: [{ role: "admin", content: "x" }] }],
			["contenu vide", { messages: [{ role: "user", content: "  " }] }],
			["contenu trop long", { messages: [{ role: "user", content: "x".repeat(8001) }] }],
			["trop de messages", { messages: Array.from({ length: 51 }, () => ({ role: "user", content: "x" })) }],
		])("rejette des messages invalides (%s)", async (_label, body) => {
			const fetchMock = gatewayReplies(Response.json({}));

			const response = await worker.fetch(chat(body), testEnv);

			expect(response.status).toBe(400);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("signale un secret manquant sans appeler la passerelle", async () => {
			const fetchMock = gatewayReplies(Response.json({}));

			const response = await worker.fetch(chat(validBody), { ...testEnv, CF_AIG_TOKEN: "" });

			expect(response.status).toBe(500);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("renvoie 502 avec CORS quand la passerelle échoue, sans fuite du détail", async () => {
			gatewayReplies(new Response("secret interne de la passerelle", { status: 401 }));

			const response = await worker.fetch(chat(validBody), testEnv);
			const text = await response.text();

			expect(response.status).toBe(502);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(text).not.toContain("secret interne");
			expect(JSON.parse(text)).toMatchObject({ upstreamStatus: 401 });
		});

		it("renvoie 502 avec CORS quand la passerelle est injoignable", async () => {
			gatewayReplies(new Error("réseau coupé"));

			const response = await worker.fetch(chat(validBody), testEnv);

			expect(response.status).toBe(502);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
		});

		it("renvoie 502 quand le modèle répond sans contenu", async () => {
			gatewayReplies(Response.json({ choices: [] }));

			const response = await worker.fetch(chat(validBody), testEnv);

			expect(response.status).toBe(502);
		});
	});
});
