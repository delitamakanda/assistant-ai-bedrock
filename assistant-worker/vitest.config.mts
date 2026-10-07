import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			// Le binding `AI` est distant : les tests le simulent, ils n'ont pas besoin de se connecter à Cloudflare.
			remoteBindings: false,
		}),
	],
});
