/**
 * Vitest configuration for Cloudflare Worker
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		// Allow tests in __tests__ directories
		include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
		// Use Cloudflare's vitest pool for workers
		pool: "@cloudflare/vitest-pool-workers",
		poolOptions: {
			workers: {
				miniflare: {
					// Configuration for Miniflare
					buildWatchPaths: ["src/**/*.ts"],
					modules: true,
					sourceMap: true,
				},
			},
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"src/**/*.test.ts",
				"src/**/*.spec.ts",
				"dist/",
			],
		},
	},
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
		},
	},
});
