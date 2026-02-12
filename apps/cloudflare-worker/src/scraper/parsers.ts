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

import type { Page } from "@cloudflare/playwright";
import type { CursusLevel1, Unit, Bibliography } from "./types";

/**
 * DOM Parser: Extract-Transform-Load Pattern
 * Converts unstructured HTML DOM into strongly-typed curriculum data structures
 * Implements resilient parsing with graceful degradation on missing elements
 */
export class CurriculumPageParser {
	/**
	 * Parse primary curriculum data: DOM traversal & data extraction
	 * Graceful degradation: Continues parsing even if optional sections missing
	 *
	 * @param page - Playwright page instance (provides DOM query interface)
	 * @param code - Curriculum identifier
	 * @returns Parsed structure with years and units
	 */
	static async parseCurriculumPage(
		page: Page,
		code: string,
	): Promise<CursusLevel1> {
		// eslint-disable-next-line no-console
		console.log(`[Parser] Parsing cursus page for code: ${code}`);

		const result: CursusLevel1 = {
			code,
			years: [],
		};

		try {
			// Graceful Degradation Pattern: Continue parsing even if optional sections fail
			try {
				result.audience_access =
					await this.getAudienceAccess(page);
				result.objectives = await this.getObjectives(page);
			} catch (error) {
				// eslint-disable-next-line no-console
				console.warn(
					`[Parser] Optional presentation data extraction failed:`,
					error,
				);
				// Continue parsing - presentation is optional
			}

			// Verify that the cursus_schema element exists
			const cursusSchemaExists = await page
				.locator('div[id="cursus_schema"]')
				.count()
				.then((count) => count > 0);

			if (!cursusSchemaExists) {
				// eslint-disable-next-line no-console
				console.warn(
					`[Parser] cursus_schema element not found for ${code}`,
				);
				return result;
			}

			// Get all year containers (div with class="schema-ensemble")
			const yearElements = await page
				.locator('div[id="cursus_schema"] div.schema-ensemble')
				.all();

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Found ${yearElements.length} year containers`,
			);

			for (let i = 0; i < yearElements.length; i++) {
				const yearElement = yearElements[i];

				try {
					const yearData = await this.parseYearSection(yearElement, i);
					if (yearData && yearData.units.length > 0) {
						result.years.push(yearData);
					}
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error(`[Parser] Error parsing year ${i}:`, error);
					// Continue with next year
				}
			}

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Successfully extracted ${result.years.length} years`,
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Parser] Error parsing cursus page for ${code}:`,
				error,
			);
		}

		return result;
	}

	/**
	 * Parse a single year section to extract units
	 *
	 * @param yearElement - Playwright locator for year container
	 * @param index - Index of year section (for fallback)
	 * @returns Parsed year data with units
	 */
	private static async parseYearSection(
		yearElement: any,
		index: number,
	): Promise<{
		year: string | number;
		units: { name: string; code?: string; url?: string }[];
	} | null> {
		try {
			// Extract year label from span with class="schema-ensemble-infos-label"
			let yearLabel = `Year ${index + 1}`;

			const yearLabelElement = yearElement
				.locator("span.schema-ensemble-infos-label")
				.first();

			const labelCount = await yearLabelElement.count();
			if (labelCount > 0) {
				yearLabel = await yearLabelElement.textContent();
				yearLabel = yearLabel?.trim() || `Year ${index + 1}`;
			}

			// Get all unit containers (div with class="schema-unite")
			const unitElements = await yearElement
				.locator("div.schema-unite")
				.all();

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Year "${yearLabel}" has ${unitElements.length} units`,
			);

			const units: { name: string; code?: string; url?: string }[] =
				[];

			for (const unitElement of unitElements) {
				try {
					const unit = await this.parseUnitSection(unitElement);
					if (unit && unit.name) {
						units.push(unit);
					}
				} catch (error) {
					// eslint-disable-next-line no-console
					console.warn(`[Parser] Error parsing unit:`, error);
					// Continue with next unit
				}
			}

			return {
				year: yearLabel,
				units,
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error parsing year section:`, error);
			return null;
		}
	}

	/**
	 * Parse a single unit (EU - Élément d'Unité) section
	 *
	 * @param unitElement - Playwright locator for unit container
	 * @returns Parsed unit data
	 */
	private static async parseUnitSection(unitElement: any): Promise<{
		name: string;
		code?: string;
		url?: string;
	} | null> {
		try {
			let unitName = "";
			let unitCode = "";
			let unitUrl = "";

			// Try to get the anchor element from schema-unite-content-code
			const codeElement = unitElement.locator(
				"div.schema-unite-content-code a",
			);

			const codeCount = await codeElement.count();
			if (codeCount > 0) {
				// Get the link text (unit name) and href (URL)
				unitName = await codeElement.textContent();
				unitName = unitName?.trim() || "";

				// Get the href attribute
				const href = await codeElement.getAttribute("href");
				unitUrl = href || "";

				// Extract code from text or URL
				// Sometimes the code is the text content, sometimes in the href
				if (unitName && unitName.match(/^[A-Z0-9]+$/)) {
					unitCode = unitName;
				} else if (unitUrl) {
					// Try to extract code from URL
					const codeMatch = unitUrl.match(
						/\/([A-Z0-9]+)(?:[/?]|$)/,
					);
					if (codeMatch) {
						unitCode = codeMatch[1];
					}
				}
			}

			// Fallback: if we still don't have a name, try other selectors
			if (!unitName) {
				const titleElement = unitElement.locator(
					"div.schema-unite-content-title",
				);
				const titleCount = await titleElement.count();
				if (titleCount > 0) {
					unitName = await titleElement.textContent();
					unitName = unitName?.trim() || "";
				}
			}

			if (!unitName) {
				return null;
			}

			return {
				name: unitName,
				code: unitCode || undefined,
				url: unitUrl || undefined,
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error parsing unit section:`, error);
			return null;
		}
	}

	/**
	 * Get the cursus title/name from the page
	 *
	 * @param page - Playwright page instance
	 * @returns Curriculum name or null if not found
	 */
	static async getCurriculumTitle(page: Page): Promise<string | null> {
		try {
			// Try common selectors for cursus title
			const selectors = [
				"h1",
				"h2",
				'div[id="cursus_schema"] ~ h1',
				".cursus-title",
				".page-title",
			];

			for (const selector of selectors) {
				const element = page.locator(selector).first();
				const count = await element.count();

				if (count > 0) {
					const text = await element.textContent();
					if (text && text.trim().length > 0) {
						return text.trim();
					}
				}
			}

			return null;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error getting cursus title:`, error);
			return null;
		}
	}

	/**
	 * Extract audience_access from the presentation section
	 *
	 * @param page - Playwright page instance
	 * @returns Audience access text or null if not found
	 */
	private static async getAudienceAccess(page: Page): Promise<string | null> {
		try {
			// XPath: //*[@id="presentation"]/div[1]/div
			const element = page.locator(
				'//*[@id="presentation"]/div[1]/div',
			);
			const count = await element.count();

			if (count > 0) {
				const text = await element.textContent();
				if (text && text.trim().length > 0) {
					// eslint-disable-next-line no-console
					console.log(
						`[Parser] Extracted audience_access: ${text.substring(0, 50)}...`,
					);
					return text.trim();
				}
			}

			return null;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error extracting audience_access:`, error);
			return null;
		}
	}

	/**
	 * Extract objectives from the presentation section
	 *
	 * @param page - Playwright page instance
	 * @returns Objectives text or null if not found
	 */
	private static async getObjectives(page: Page): Promise<string | null> {
		try {
			// XPath: //*[@id="presentation"]/div[2]/div/p
			const locator = page.locator(
				'//*[@id="presentation"]/div[2]/div/p',
			);
			const count = await locator.count();

			if (count > 0) {
				// Collect all paragraph texts and join non-empty ones
				const texts = await locator.allTextContents();
				const nonEmpty = texts.map((t) => t?.trim()).filter(Boolean);
				if (nonEmpty.length > 0) {
					const text = nonEmpty.join("\n\n");
					// eslint-disable-next-line no-console
					console.log(
						`[Parser] Extracted objectives: ${text.substring(0, 50)}...`,
					);
					return text;
				}
			}

			return null;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error extracting objectives:`, error);
			return null;
		}
	}

	/**
	 * Parse a unit detail page to extract full unit information
	 *
	 * @param page - Playwright page instance
	 * @param unitCode - Unit code for logging
	 * @returns Unit details with all available fields
	 */
	static async parseUnitDetailPage(page: Page, unitCode: string): Promise<Unit> {
		// eslint-disable-next-line no-console
		console.log(`[Parser] Parsing unit detail page for code: ${unitCode}`);

		const unit: Unit = {
			name: unitCode,
			code: unitCode,
		};

		try {
			// Extract presentation section (audience_access, objectives)
			const presentationData = await this.extractPresentationData(page);
			if (presentationData.audience_access) {
				unit.audience_access = presentationData.audience_access;
			}
			if (presentationData.objectives) {
				unit.objectives = presentationData.objectives;
			}

			// Extract content section
			const content = await this.extractContentData(page);
			if (content) {
				unit.content = content;
			}

			// Extract bibliography
			const bibliography = await this.extractBibliography(page);
			if (bibliography && bibliography.length > 0) {
				unit.bibliography = bibliography;
			}

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Successfully parsed unit ${unitCode} with all details`,
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Parser] Error parsing unit detail page for ${unitCode}:`,
				error,
			);
			// Return partial data on error
		}

		return unit;
	}

	/**
	 * Extract presentation section data (audience_access, objectives)
	 *
	 * @param page - Playwright page instance
	 * @returns Object with audience_access and objectives
	 */
	private static async extractPresentationData(page: Page): Promise<{
		audience_access?: string;
		objectives?: string;
	}> {
		const result: {
			audience_access?: string;
			objectives?: string;
		} = {};

		try {
			// Check if presentation section exists
			const presentationCount = await page
				.locator('//*[@id="presentation"]')
				.count();
			if (presentationCount === 0) {
				// eslint-disable-next-line no-console
				console.warn(
					`[Parser] Presentation section not found on unit detail page`,
				);
				return result;
			}

			// Extract audience_access from //*[@id="presentation"]/div[1]/div
			try {
				const audienceElement = page.locator(
					'//*[@id="presentation"]/div[1]/div',
				);
				if ((await audienceElement.count()) > 0) {
					const texts = await audienceElement.allTextContents();
					const nonEmpty = texts.map((t) => t?.trim()).filter(Boolean);
					if (nonEmpty.length > 0) {
						result.audience_access = nonEmpty.join("\n\n");
					}
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.warn(
					`[Parser] Error extracting audience_access:`,
					error,
				);
			}

			// Extract objectives from //*[@id="presentation"]/div[2]/div/p
			try {
				const objectivesElement = page.locator(
					'//*[@id="presentation"]/div[2]/div/p',
				);
				if ((await objectivesElement.count()) > 0) {
					const texts = await objectivesElement.allTextContents();
					const nonEmpty = texts.map((t) => t?.trim()).filter(Boolean);
					if (nonEmpty.length > 0) {
						result.objectives = nonEmpty.join("\n\n");
					}
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.warn(`[Parser] Error extracting objectives:`, error);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Parser] Error extracting presentation data:`,
				error,
			);
		}

		return result;
	}

	/**
	 * Extract content section from unit detail page
	 *
	 * @param page - Playwright page instance
	 * @returns Content as concatenated text from all paragraphs
	 */
	private static async extractContentData(page: Page): Promise<string | null> {
		try {
			// Check if content section exists
			const contentCount = await page
				.locator('//*[@id="contenu"]')
				.count();
			if (contentCount === 0) {
				// eslint-disable-next-line no-console
				console.warn(
					`[Parser] Content section not found on unit detail page`,
				);
				return null;
			}

			// Extract content from //*[@id="contenu"]/div[1]/div
			const contentElement = page.locator(
				'//*[@id="contenu"]/div[1]/div',
			);
			if ((await contentElement.count()) > 0) {
				const texts = await contentElement.allTextContents();
				const nonEmpty = texts.map((t) => t?.trim()).filter(Boolean);
				if (nonEmpty.length > 0) {
					const text = nonEmpty.join("\n\n");
					// eslint-disable-next-line no-console
					console.log(
						`[Parser] Extracted content: ${text.substring(0, 50)}...`,
					);
					return text;
				}
			}

			return null;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[Parser] Error extracting content data:`, error);
			return null;
		}
	}

	/**
	 * Extract bibliography from unit detail page
	 * Parses table with title and author columns
	 *
	 * @param page - Playwright page instance
	 * @returns Array of bibliography entries
	 */
	private static async extractBibliography(page: Page): Promise<Bibliography[]> {
		const bibliography: Bibliography[] = [];

		try {
			// Check if content section exists
			const contentCount = await page
				.locator('//*[@id="contenu"]')
				.count();
			if (contentCount === 0) {
				return bibliography;
			}

			// Look for table in //*[@id="contenu"]/div[2]/div/table
			const tableElement = page.locator(
				'//*[@id="contenu"]/div[2]/div/table',
			);
			if ((await tableElement.count()) === 0) {
				// eslint-disable-next-line no-console
				console.log(
					`[Parser] No bibliography table found on unit detail page`,
				);
				return bibliography;
			}

			// Extract all rows from the table body
			const rows = await tableElement.locator("tbody tr").all();

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Found ${rows.length} bibliography entries`,
			);

			for (const row of rows) {
				try {
					// Extract cells (typically 2 columns: title, author)
					const cells = await row.locator("td").all();

					if (cells.length >= 2) {
						const titleText = await cells[0].textContent();
						const authorText = await cells[1].textContent();

						const entry: Bibliography = {
							title: titleText?.trim() || "",
							author: authorText?.trim() || "",
						};

						if (entry.title || entry.author) {
							bibliography.push(entry);
						}
					}
				} catch (error) {
					// eslint-disable-next-line no-console
					console.warn(
						`[Parser] Error parsing bibliography row:`,
						error,
					);
					// Continue with next row
				}
			}

			// eslint-disable-next-line no-console
			console.log(
				`[Parser] Successfully extracted ${bibliography.length} bibliography entries`,
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Parser] Error extracting bibliography:`,
				error,
			);
		}

		return bibliography;
	}
}
