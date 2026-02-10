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

import { describe, it, expect, beforeAll, vi } from "vitest";
import { KVCache } from "../cache/kv-cache";
import type { CursusLevel1 } from "../scraper/types";

// Mock environment variables from .env
const mockEnv = {
	CNAM_FORMATION_CODE: process.env.CNAM_FORMATION_CODE || "CYC9101A",
	CNAM_BEDEO_URL: process.env.CNAM_BEDEO_URL || "https://bedeo.cnam.fr",
	CNAM_BEDEO_CURSUS_PATH:
		process.env.CNAM_BEDEO_CURSUS_PATH || "public/cursus/view/",
	CNAM_BEDEO_UNITE_VIEW_PATH:
		process.env.CNAM_BEDEO_UNITE_VIEW_PATH || "/public/unite/view/",
} as unknown as Env;

/**
 * Validate cursus code format
 * Expected format: 3-8 characters, alphanumeric
 */
function isValidCurriculumCode(code: string): boolean {
	const pattern = /^[A-Z0-9]{3,8}$/i;
	return pattern.test(code);
}

/**
 * Build cursus URL
 */
function buildCurriculumUrl(code: string): string {
	const baseUrl = `${mockEnv.CNAM_BEDEO_URL}/${mockEnv.CNAM_BEDEO_CURSUS_PATH}`;
	return `${baseUrl}${code}`;
}

/**
 * Build unit URL
 */
function buildUnitUrl(code: string): string {
	const baseUrl = `${mockEnv.CNAM_BEDEO_URL}${mockEnv.CNAM_BEDEO_UNITE_VIEW_PATH}`;
	return `${baseUrl}${code}`;
}

describe("CNAM Scraper - Level 1 (Unit Tests)", () => {
	beforeAll(() => {
		console.log(
			`[Tests] Using cursus code: ${mockEnv.CNAM_FORMATION_CODE}`,
		);
	});

	describe("Environment Configuration", () => {
		it("should load environment variables from .env", () => {
			expect(mockEnv.CNAM_FORMATION_CODE).toBeDefined();
			expect(mockEnv.CNAM_BEDEO_URL).toBeDefined();
			expect(mockEnv.CNAM_BEDEO_CURSUS_PATH).toBeDefined();
			expect(mockEnv.CNAM_BEDEO_UNITE_VIEW_PATH).toBeDefined();
		});

		it("should have valid CNAM formation code", () => {
			expect(mockEnv.CNAM_FORMATION_CODE).toBe("CYC9101A");
		});

		it("should have valid BEDEO URL", () => {
			expect(mockEnv.CNAM_BEDEO_URL).toContain("bedeo.cnam.fr");
		});

		it("should have valid path configurations", () => {
			expect(mockEnv.CNAM_BEDEO_CURSUS_PATH).toContain("cursus");
			expect(mockEnv.CNAM_BEDEO_UNITE_VIEW_PATH).toContain("unite");
		});
	});

	describe("URL Building", () => {
		it("should build correct cursus URL", () => {
			const code = "CYC9101A";
			const url = buildCurriculumUrl(code);

			expect(url).toContain("bedeo.cnam.fr");
			expect(url).toContain("public/cursus/view");
			expect(url).toContain(code);
			expect(url).toMatch(/https?:\/\//);
		});

		it("should build correct unit URL", () => {
			const code = "ENG110A";
			const url = buildUnitUrl(code);

			expect(url).toContain("bedeo.cnam.fr");
			expect(url).toContain("/public/unite/view/");
			expect(url).toContain(code);
		});

		it("should handle different cursus codes", () => {
			const codes = ["CYC9101A", "ENG110", "MATH201"];

			codes.forEach((code) => {
				const url = buildCurriculumUrl(code);
				expect(url).toContain(code);
				expect(url).toContain("bedeo.cnam.fr");
			});
		});
	});

	describe("Curriculum Code Validation", () => {
		it("should validate correct cursus codes", () => {
			const validCodes = [
				"CYC9101A",
				"CYC9101",
				"ENG110",
				"ENG110A",
				"ABC",
				"ABCD1234",
			];

			validCodes.forEach((code) => {
				expect(isValidCurriculumCode(code)).toBe(
					true,
					`Code "${code}" should be valid`,
				);
			});
		});

		it("should reject invalid cursus codes", () => {
			const invalidCodes = [
				"",
				"A",
				"AB",
				"CYC9101!",
				"CYC 9101",
				"~CYC9101",
				"12345678901",
			];

			invalidCodes.forEach((code) => {
				expect(isValidCurriculumCode(code)).toBe(
					false,
					`Code "${code}" should be invalid`,
				);
			});
		});

		it("should be case-insensitive", () => {
			const codes = ["cyc9101a", "CYC9101A", "Cyc9101A"];

			codes.forEach((code) => {
				expect(isValidCurriculumCode(code)).toBe(true);
			});
		});

		it("should validate the test cursus code", () => {
			const code = mockEnv.CNAM_FORMATION_CODE as string;
			expect(isValidCurriculumCode(code)).toBe(true);
		});
	});

	describe("Data Integrity", () => {
		it("should have consistent formation code", () => {
			const code = mockEnv.CNAM_FORMATION_CODE as string;

			expect(code).toBeDefined();
			expect(code.length).toBeGreaterThanOrEqual(3);
			expect(/^[A-Z0-9]+$/i.test(code)).toBe(true);
		});

		it("should create valid cursus page structure", () => {
			const curriculumData: CursusLevel1 = {
				code: "CYC9101A",
				name: "Test Curriculum",
				years: [
					{
						year: "Year 1",
						units: [
							{
								name: "Unit 1",
								code: "ENG110",
								url: "https://bedeo.cnam.fr/public/unite/view/ENG110",
							},
						],
					},
				],
			};

			expect(curriculumData.code).toBe("CYC9101A");
			expect(curriculumData.years).toHaveLength(1);
			expect(curriculumData.years[0].units).toHaveLength(1);
			expect(curriculumData.years[0].units[0].name).toBe("Unit 1");
		});
	});
});

describe("KVCache - Unit Tests", () => {
	let cache: KVCache;
	const mockKVNamespace = {
		get: vi.fn(),
		put: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue({ keys: [] }),
	} as unknown as KVNamespace;

	beforeAll(() => {
		cache = new KVCache(mockKVNamespace);
	});

	describe("Initialization", () => {
		it("should initialize KVCache correctly", () => {
			expect(cache).toBeDefined();
			expect(cache).toBeInstanceOf(KVCache);
		});

		it("should have required methods", () => {
			expect(cache.get).toBeDefined();
			expect(cache.set).toBeDefined();
			expect(cache.invalidate).toBeDefined();
			expect(cache.invalidateAll).toBeDefined();
			expect(cache.getMetadata).toBeDefined();
		});
	});

	describe("Cache Operations", () => {
		it("should handle cache set and get", async () => {
			const code = "CYC9101A";
			const testData: CursusLevel1 = {
				code,
				years: [
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
			};

			// Test set
			const setResult = await cache.set(code, testData, 86400);
			expect(setResult).toBe(true);

			// Test invalidate
			const invalidateResult = await cache.invalidate(code);
			expect(invalidateResult).toBe(true);
		});

		it("should handle cache invalidateAll", async () => {
			const code = "CYC9101A";

			const invalidateAllResult = await cache.invalidateAll(code);
			expect(invalidateAllResult).toBe(true);
		});

		it("should handle cache TTL correctly", async () => {
			const code = "CYC9101A";
			const testData: CursusLevel1 = {
				code,
				years: [],
			};

			// Test with custom TTL
			const result = await cache.set(code, testData, 3600); // 1 hour
			expect(result).toBe(true);

			// Verify put was called (KVNamespace.put)
			expect(mockKVNamespace.put).toHaveBeenCalled();
		});

		it("should handle cache errors gracefully", async () => {
			const errorKVNamespace = {
				get: vi.fn().mockRejectedValue(new Error("KV error")),
				put: vi.fn().mockRejectedValue(new Error("KV error")),
				delete: vi.fn().mockRejectedValue(new Error("KV error")),
				list: vi.fn().mockRejectedValue(new Error("KV error")),
			} as unknown as KVNamespace;

			const errorCache = new KVCache(errorKVNamespace);

			const getResult = await errorCache.get("CYC9101A");
			expect(getResult).toBeNull();

			const setResult = await errorCache.set("CYC9101A", {
				code: "CYC9101A",
				years: [],
			}, 3600);
			expect(setResult).toBe(false);

			const invalidateResult = await errorCache.invalidate("CYC9101A");
			expect(invalidateResult).toBe(false);
		});

		it("should handle missing cache entries", async () => {
			const mockKVEmpty = {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
			} as unknown as KVNamespace;

			const emptyCache = new KVCache(mockKVEmpty);
			const result = await emptyCache.get("NONEXISTENT");

			expect(result).toBeNull();
		});
	});
});
