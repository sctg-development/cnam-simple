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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CurriculumPageParser } from "../scraper/parsers";
import type { Unit, Bibliography } from "../scraper/types";

describe("Unit Detail Page Parser (Level 2)", () => {
	let mockPage: any;

	beforeEach(() => {
		// Create a comprehensive mock page object with all necessary methods
		mockPage = {
			locator: vi.fn((selector: string) => ({
				count: vi.fn().mockResolvedValue(1),
				textContent: vi.fn().mockResolvedValue("Sample text"),
				all: vi.fn().mockResolvedValue([]),
			})),
			waitForSelector: vi.fn().mockResolvedValue(undefined),
		};
	});

	describe("parseUnitDetailPage", () => {
		it("should return unit object with code", async () => {
			mockPage.locator.mockImplementation(() => ({
				count: vi.fn().mockResolvedValue(0),
				textContent: vi.fn().mockResolvedValue(null),
				all: vi.fn().mockResolvedValue([]),
			}));

			const result = await CurriculumPageParser.parseUnitDetailPage(
				mockPage,
				"UTC501",
			);

			expect(result).toBeDefined();
			expect(result.code).toBe("UTC501");
			expect(result.name).toBe("UTC501");
		});

		it("should handle missing presentation section gracefully", async () => {
			mockPage.locator.mockImplementation((selector: string) => ({
				count: vi.fn().mockResolvedValue(0),
				textContent: vi.fn().mockResolvedValue(null),
				all: vi.fn().mockResolvedValue([]),
			}));

			const result = await CurriculumPageParser.parseUnitDetailPage(
				mockPage,
				"UTC502",
			);

			expect(result).toBeDefined();
			expect(result.code).toBe("UTC502");
			expect(result.audience_access).toBeUndefined();
			expect(result.objectives).toBeUndefined();
		});

		it("should handle parsing errors gracefully", async () => {
			mockPage.locator.mockImplementation(() => {
				throw new Error("Mock locator error");
			});

			const result = await CurriculumPageParser.parseUnitDetailPage(
				mockPage,
				"UTC504",
			);

			expect(result).toBeDefined();
			expect(result.code).toBe("UTC504");
			expect(result.name).toBe("UTC504");
		});
	});

	describe("Unit Detail Page - Structure Validation", () => {
		it("should have all required Unit interface fields", async () => {
			mockPage.locator.mockImplementation(() => ({
				count: vi.fn().mockResolvedValue(0),
				textContent: vi.fn().mockResolvedValue(null),
				all: vi.fn().mockResolvedValue([]),
			}));

			const result = await CurriculumPageParser.parseUnitDetailPage(
				mockPage,
				"UTC505",
			);

			// Verify object has required properties (optional fields can be undefined)
			expect(result).toHaveProperty("code");
			expect(result).toHaveProperty("name");
			expect(typeof result.code).toBe("string");
			expect(typeof result.name).toBe("string");
		});

		it("should support all Unit fields for enrichment", () => {
			const unit: Unit = {
				name: "Course Name",
				code: "CRS101",
				url: "https://example.com/unit",
				audience_access: "Master students",
				objectives: "Learn objectives",
				content: "Course content",
				bibliography: [
					{
						title: "Book Title",
						author: "Author Name",
					},
				],
			};

			expect(unit.name).toBeDefined();
			expect(unit.code).toBeDefined();
			expect(unit.url).toBeDefined();
			expect(unit.audience_access).toBeDefined();
			expect(unit.objectives).toBeDefined();
			expect(unit.content).toBeDefined();
			expect(unit.bibliography).toBeDefined();
			expect(unit.bibliography?.length).toBe(1);
		});
	});

	describe("Bibliography Data Structure", () => {
		it("should have correct Bibliography interface structure", () => {
			const bibEntry: Bibliography = {
				title: "Design Patterns",
				author: "Gang of Four",
			};

			expect(bibEntry.title).toBe("Design Patterns");
			expect(bibEntry.author).toBe("Gang of Four");
		});

		it("should handle multiple bibliography entries", () => {
			const bibEntries: Bibliography[] = [
				{ title: "Book 1", author: "Author 1" },
				{ title: "Book 2", author: "Author 2" },
				{ title: "Book 3", author: "Author 3" },
			];

			expect(bibEntries.length).toBe(3);
			expect(bibEntries[0].title).toBe("Book 1");
			expect(bibEntries[2].author).toBe("Author 3");
		});
	});
});
