import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const ORIGIN = "https://delitamakanda.github.io";

function createEnv(run: (...args: unknown[]) => unknown) {
	const ai = { run: vi.fn(run) };
	return { env: { AI: ai, AI_GATEWAY_ID: "assistant-gateway" } as unknown as Env, run: ai.run };
}

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
const completion = (content: unknown) => ({ choices: [{ message: { role: "assistant", content } }] });

describe("assistant worker", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("CORS", () => {
		it("répond au preflight pour une origine autorisée", async () => {
			const { env } = createEnv(() => completion("x"));
			const request = new Request("https://worker.test/chat", {
				method: "OPTIONS",
				headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
			});

			const response = await worker.fetch(request, env);

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
		});

		it("n'autorise pas une origine inconnue", async () => {
			const { env } = createEnv(() => completion("x"));
			const request = new Request("https://worker.test/chat", {
				method: "OPTIONS",
				headers: { Origin: "https://evil.example" },
			});

			const response = await worker.fetch(request, env);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("ajoute les en-têtes CORS aux réponses 404", async () => {
			const { env } = createEnv(() => completion("x"));
			const request = new Request("https://worker.test/", { headers: { Origin: ORIGIN } });

			const response = await worker.fetch(request, env);

			expect(response.status).toBe(404);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
		});
	});

	describe("POST /chat", () => {
		it("renvoie la réponse de Qwen3 via la passerelle", async () => {
			const { env, run } = createEnv(() => completion("Salut !"));

			const response = await worker.fetch(chat(validBody), env);

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(await response.json()).toEqual({ content: "Salut !" });

			expect(run).toHaveBeenCalledTimes(1);
			const [model, inputs, options] = run.mock.calls[0] as unknown as [string, Record<string, unknown>, unknown];
			expect(model).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
			expect(inputs.messages).toEqual(validBody.messages);
			expect(inputs).not.toHaveProperty("mode");
			expect(options).toEqual({ gateway: { id: "assistant-gateway" } });
		});

		it("accepte l'ancien format `response`", async () => {
			const { env } = createEnv(() => ({ response: "Ancien format" }));

			const response = await worker.fetch(chat(validBody), env);

			expect(await response.json()).toEqual({ content: "Ancien format" });
		});

		it("rejette un corps qui n'est pas du JSON, avec les en-têtes CORS", async () => {
			const { env } = createEnv(() => completion("x"));

			const response = await worker.fetch(chat("pas du json"), env);

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
			const { env, run } = createEnv(() => completion("x"));

			const response = await worker.fetch(chat(body), env);

			expect(response.status).toBe(400);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(run).not.toHaveBeenCalled();
		});

		it("renvoie 502 avec CORS quand Workers AI échoue, sans fuite du détail", async () => {
			const { env } = createEnv(() => {
				throw new Error("secret interne de la plateforme");
			});

			const response = await worker.fetch(chat(validBody), env);
			const text = await response.text();

			expect(response.status).toBe(502);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(text).not.toContain("secret interne");
		});

		it.each([
			["aucun choix", { choices: [] }],
			["contenu vide (raisonnement trop long)", completion("")],
			["contenu absent", {}],
			["flux inattendu", new ReadableStream()],
		])("renvoie 502 quand le modèle répond sans contenu (%s)", async (_label, result) => {
			const { env } = createEnv(() => result);

			const response = await worker.fetch(chat(validBody), env);

			expect(response.status).toBe(502);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
		});
	});
});
