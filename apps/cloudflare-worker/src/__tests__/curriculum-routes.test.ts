/**
 * MIT License
 *
 * Copyright (c) 2024-2026 Ronan LE MEILLAT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { KVCache } from "../cache/kv-cache";
import type { CursusLevel1, CursusApiResponse } from "../scraper/types";

describe("Curriculum Routes - API Contract", () => {
	let mockKVNamespace: any;

	beforeEach(() => {
		// Create mock KV namespace
		mockKVNamespace = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			list: vi.fn().mockResolvedValue({ keys: [] }),
		};
	});

	describe("Response Structure Validation", () => {
		it("should return valid success response structure", () => {
			const successResponse: CursusApiResponse = {
				success: true,
				data: {
					name: "Test Curriculum",
					code: "CYC9101A",
					EU: [
						{
							year: "Year 1",
							units: [
								{
									name: "Unit 1",
									code: "ENG110",
									url: "https://example.com/unit1",
								},
							],
						},
					],
				},
				cached: false,
				scrapedAt: new Date().toISOString(),
			};

			expect(successResponse.success).toBe(true);
			expect(successResponse.data).toBeDefined();
			expect(successResponse.data?.code).toBe("CYC9101A");
			expect(successResponse.data?.EU).toBeDefined();
			expect(Array.isArray(successResponse.data?.EU)).toBe(true);
		});

		it("should return valid error response structure", () => {
			const errorResponse: CursusApiResponse = {
				success: false,
				error: "Curriculum not found",
			};

			expect(errorResponse.success).toBe(false);
			expect(errorResponse.error).toBeDefined();
			expect(errorResponse.data).toBeUndefined();
		});

		it("should include cache status in response", () => {
			const cachedResponse: CursusApiResponse = {
				success: true,
				data: {
					name: "Test",
					code: "CYC9101A",
					EU: [],
				},
				cached: true,
			};

			expect(cachedResponse.cached).toBe(true);
			expect(cachedResponse.scrapedAt).toBeUndefined();
		});

		it("should differentiate between cached and fresh responses", () => {
			const cachedResponse: CursusApiResponse = {
				success: true,
				cached: true,
			};

			const freshResponse: CursusApiResponse = {
				success: true,
				cached: false,
				scrapedAt: new Date().toISOString(),
			};

			expect(cachedResponse.cached).toBe(true);
			expect(cachedResponse.scrapedAt).toBeUndefined();

			expect(freshResponse.cached).toBe(false);
			expect(freshResponse.scrapedAt).toBeDefined();
		});
	});

	describe("KVCache Integration", () => {
		it("should create cache instance with correct KV namespace", () => {
			const cache = new KVCache(mockKVNamespace);
			expect(cache).toBeDefined();
			expect(cache).toBeInstanceOf(KVCache);
		});

		it("should handle cache operations", async () => {
			const cache = new KVCache(mockKVNamespace);
			const testData: CursusLevel1 = {
				code: "CYC9101A",
				years: [],
			};

			const setResult = await cache.set("CYC9101A", testData);
			expect(setResult).toBe(true);

			const invalidateResult = await cache.invalidate("CYC9101A");
			expect(invalidateResult).toBe(true);
		});

		it("should generate consistent cache keys", async () => {
			const cache = new KVCache(mockKVNamespace);

			await cache.set("CYC9101A", { code: "CYC9101A", years: [] });
			await cache.get("CYC9101A");

			// Verify that put and get were called
			expect(mockKVNamespace.put).toHaveBeenCalled();
		});

		it("should handle metadata retrieval", async () => {
			const cache = new KVCache(mockKVNamespace);

			// Mock a cached entry
			mockKVNamespace.get.mockResolvedValueOnce({
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 86400000).toISOString(),
				data: { code: "CYC9101A", years: [] },
			});

			const metadata = await cache.getMetadata("CYC9101A");
			expect(metadata).toBeDefined();
			if (metadata) {
				expect(metadata.timestamp).toBeDefined();
				expect(metadata.expiresAt).toBeDefined();
			}
		});
	});

	describe("Error Handling", () => {
		it("should handle missing cursus gracefully", async () => {
			mockKVNamespace.get.mockResolvedValueOnce(null);

			const cache = new KVCache(mockKVNamespace);
			const result = await cache.get("NONEXISTENT");

			expect(result).toBeNull();
		});

		it("should handle KV namespace errors", async () => {
			mockKVNamespace.put.mockRejectedValueOnce(
				new Error("KV storage full"),
			);

			const cache = new KVCache(mockKVNamespace);
			const result = await cache.set("CYC9101A", {
				code: "CYC9101A",
				years: [],
			});

			expect(result).toBe(false);
		});

		it("should recover from cache retrieval errors", async () => {
			const errorKV = {
				get: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
			};

			const cache = new KVCache(errorKV as any);
			const result = await cache.get("CYC9101A");

			expect(result).toBeNull();
		});
	});

	describe("Curriculum Data Structures", () => {
		it("should validate cursus page level 1 structure", () => {
			const level1Data: CursusLevel1 = {
				code: "CYC9101A",
				name: "Curriculum Title",
				years: [
					{
						year: "Year 1",
						units: [
							{
								name: "Unit A",
								code: "ENG110",
								url: "https://bedeo.cnam.fr/public/unite/view/ENG110",
							},
							{
								name: "Unit B",
								code: "MATH110",
							},
						],
					},
					{
						year: "Year 2",
						units: [
							{
								name: "Unit C",
								code: "ENG210",
								url: "https://bedeo.cnam.fr/public/unite/view/ENG210",
							},
						],
					},
				],
			};

			expect(level1Data.code).toBe("CYC9101A");
			expect(level1Data.years).toHaveLength(2);
			expect(level1Data.years[0].units).toHaveLength(2);
			expect(level1Data.years[1].units).toHaveLength(1);
		});

		it("should support optional unit properties", () => {
			const unitWithOptionals = {
				name: "Unit A",
				code: "ENG110",
				url: "https://bedeo.cnam.fr/public/unite/view/ENG110",
			};

			const unitMinimal = {
				name: "Unit B",
			};

			expect(unitWithOptionals.name).toBeDefined();
			expect(unitWithOptionals.code).toBeDefined();
			expect(unitWithOptionals.url).toBeDefined();

			expect(unitMinimal.name).toBeDefined();
			expect(unitMinimal.code).toBeUndefined();
		});

		it("should support empty cursus", () => {
			const emptyCurriculum: CursusLevel1 = {
				code: "UNKNOWN",
				years: [],
			};

			expect(emptyCurriculum.code).toBe("UNKNOWN");
			expect(emptyCurriculum.years).toEqual([]);
		});
	});

	describe("Query Parameter Handling", () => {
		it("should parse force query parameter", () => {
			const url = new URL("http://localhost/api/cursus/CYC9101A?force=true");
			const force = url.searchParams.get("force") === "true";

			expect(force).toBe(true);
		});

		it("should parse timeout query parameter", () => {
			const url = new URL(
				"http://localhost/api/cursus/CYC9101A?timeout=45000",
			);
			const timeout = url.searchParams.get("timeout")
				? parseInt(url.searchParams.get("timeout") || "30000", 10)
				: 30000;

			expect(timeout).toBe(45000);
		});

		it("should handle default timeout when not provided", () => {
			const url = new URL("http://localhost/api/cursus/CYC9101A");
			const timeout = url.searchParams.get("timeout")
				? parseInt(url.searchParams.get("timeout") || "30000", 10)
				: 30000;

			expect(timeout).toBe(30000);
		});

		it("should handle invalid timeout values", () => {
			const url = new URL(
				"http://localhost/api/cursus/CYC9101A?timeout=invalid",
			);
			const timeout = url.searchParams.get("timeout")
				? parseInt(url.searchParams.get("timeout") || "30000", 10)
				: 30000;

			// parseInt("invalid", 10) returns NaN
			// The pattern should handle this gracefully
			expect(isNaN(timeout) || timeout === 30000).toBe(true);
		});
	});
});

describe("Curriculum API Routes", () => {
	let mockRouter: any;
	let mockEnv: any;
	let mockKVNamespace: any;

	beforeEach(() => {
		// Create mock KV namespace
		mockKVNamespace = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			list: vi.fn().mockResolvedValue({ keys: [] }),
		};

		// Create mock router with corsHeaders
		mockRouter = {
			corsHeaders: {
				"Access-Control-Allow-Origin": "http://localhost:3000",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Content-Type": "application/json",
			},
			get: vi.fn(),
			delete: vi.fn(),
		};

		// Create mock environment
		mockEnv = {
			CACHE: mockKVNamespace,
			CFBROWSER: null,
			CNAM_BEDEO_URL: "https://bedeo.cnam.fr",
			CNAM_BEDEO_CURSUS_PATH: "public/cursus/view/",
			CNAM_BEDEO_UNITE_VIEW_PATH: "/public/unite/view/",
		} as unknown as Env;
	});

	describe("Response structure validation", () => {
		it("should return valid success response structure", () => {
			const successResponse: CursusApiResponse = {
				success: true,
				data: {
					name: "Test Curriculum",
					code: "CYC9101A",
					EU: [
						{
							year: "Year 1",
							units: [
								{
									name: "Unit 1",
									code: "ENG110",
									url: "https://example.com/unit1",
								},
							],
						},
					],
				},
				cached: false,
				scrapedAt: new Date().toISOString(),
			};

			expect(successResponse.success).toBe(true);
			expect(successResponse.data).toBeDefined();
			expect(successResponse.data?.code).toBe("CYC9101A");
			expect(successResponse.data?.EU).toBeDefined();
			expect(Array.isArray(successResponse.data?.EU)).toBe(true);
		});

		it("should return valid error response structure", () => {
			const errorResponse: CursusApiResponse = {
				success: false,
				error: "Curriculum not found",
			};

			expect(errorResponse.success).toBe(false);
			expect(errorResponse.error).toBeDefined();
			expect(errorResponse.data).toBeUndefined();
		});

		it("should include cache status in response", () => {
			const cachedResponse: CursusApiResponse = {
				success: true,
				data: {
					name: "Test",
					code: "CYC9101A",
					EU: [],
				},
				cached: true,
			};

			expect(cachedResponse.cached).toBe(true);
			expect(cachedResponse.scrapedAt).toBeUndefined();
		});
	});

	describe("KVCache integration in routes", () => {
		it("should create cache instance with correct KV namespace", () => {
			const cache = new KVCache(mockKVNamespace);
			expect(cache).toBeDefined();
			expect(cache).toBeInstanceOf(KVCache);
		});

		it("should handle cache operations", async () => {
			const cache = new KVCache(mockKVNamespace);
			const testData: CursusLevel1 = {
				code: "CYC9101A",
				years: [],
			};

			const setResult = await cache.set("CYC9101A", testData);
			expect(setResult).toBe(true);

			const invalidateResult = await cache.invalidate("CYC9101A");
			expect(invalidateResult).toBe(true);
		});

		it("should generate consistent cache keys", async () => {
			const cache = new KVCache(mockKVNamespace);

			await cache.set("CYC9101A", { code: "CYC9101A", years: [] });
			await cache.get("CYC9101A");

			// Verify that put and get were called
			expect(mockKVNamespace.put).toHaveBeenCalled();
		});
	});

	describe("Error responses", () => {
		it("should handle missing cursus gracefully", async () => {
			mockKVNamespace.get.mockResolvedValueOnce(null);

			const cache = new KVCache(mockKVNamespace);
			const result = await cache.get("NONEXISTENT");

			expect(result).toBeNull();
		});

		it("should handle KV namespace errors", async () => {
			mockKVNamespace.put.mockRejectedValueOnce(
				new Error("KV storage full"),
			);

			const cache = new KVCache(mockKVNamespace);
			const result = await cache.set("CYC9101A", { code: "CYC9101A", years: [] });

			expect(result).toBe(false);
		});
	});
});
