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

import { launch } from "@cloudflare/playwright";
import type { Browser, Page } from "@cloudflare/playwright";
import { CurriculumPageParser as CursusPageParser } from "./parsers";
import type { CursusLevel1, ScraperOptions } from "./types";
import { KVCache } from "../cache/kv-cache";
import { CloudflareSessionPool } from "./session-pool";

/**
 * CNAM Curriculum Web Scraper: Template Method Pattern
 * Encapsulates browser automation with page parsing and error handling
 * Integrates with KVCache for intelligent caching strategy
 */
export class CNAMScraper {
	private bedeoCnamUrl: string;
	private bedeoUniteViewPath: string;
	private bedeoFormationPath: string;
	private checkpointSize: number;

	constructor(env: Env) {
		this.bedeoCnamUrl =
			(env.CNAM_BEDEO_URL as string) || "https://bedeo.cnam.fr";
		this.bedeoFormationPath =
			(env.CNAM_BEDEO_CURSUS_PATH as string) ||
			"public/cursus/view/";
		this.bedeoUniteViewPath =
			(env.CNAM_BEDEO_UNITE_VIEW_PATH as string) ||
			"/public/unite/view/";

		// Number of units processed between checkpoints
		this.checkpointSize = parseInt((env.SCRAPPER_LEVEL_2_CHECKPOINT as string) || "25", 10);
	}

	/**
	 * Scrape level 1 curriculum structure: Strategy Pattern
	 * Extracts hierarchical year and unit structure from web page
	 * Manages its own browser instance with session pooling
	 *
	 * @param code - Curriculum code (e.g., CYC9101A) - validated before processing
	 * @param options - Scraper options for timeout and retry behavior
	 * @param env - Environment with CFBROWSER binding for launching browser
	 * @returns Parsed curriculum structure with type safety
	 */
	async scrapeCurriculumLevel1(
		code: string,
		options: ScraperOptions = {},
		env: Env,
	): Promise<CursusLevel1> {
		// eslint-disable-next-line no-console
		console.log(`[Scraper] Starting Level 1 scrape for code: ${code}`);

		const timeout = options.timeout || 60000; // Default 60 seconds
		const browserInstance = await launch(env.CFBROWSER);
		const sessionPool = new CloudflareSessionPool(browserInstance, { maxSessions: 1 });
		let page: Page | null = null;

		try {
			// Input Validation Pattern: Reject invalid data early
			if (!this.isValidCurriculumCode(code)) {
				throw new Error(`Invalid curriculum code format: ${code}`);
			}

			// Create page with pooled session
			page = await sessionPool.createPage({ locale: "fr-FR" });

			// Set a reasonable timeout
			page.setDefaultTimeout(timeout);
			page.setDefaultNavigationTimeout(timeout);

			// Configure User-Agent and headers for Cloudflare Playwright
			await page.route("**/*", (route: any) =>
				route.continue({
					headers: {
						...route.request().headers(),
						"User-Agent":
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15",
					},
				}),
			);

			// Build the cursus URL
			const curriculumUrl = this.buildCurriculumUrl(code);
			// eslint-disable-next-line no-console
			console.log(`[Scraper] Navigating to: ${curriculumUrl}`);

			// Navigate to the cursus page
			await page.goto(curriculumUrl, {
				waitUntil: "networkidle",
				timeout,
			});

			// Wait for the cursus_schema to be present
			await page.waitForSelector('div[id="cursus_schema"]', {
				timeout: 10000,
			});

			// eslint-disable-next-line no-console
			console.log(
				`[Scraper] Page loaded successfully for code: ${code}`,
			);

			// Parse the cursus page
			const curriculumData =
				await CursusPageParser.parseCurriculumPage(page, code);

			// Try to get cursus title
			const title = await CursusPageParser.getCurriculumTitle(page);
			if (title) {
				curriculumData.name = title;
			}

			// eslint-disable-next-line no-console
			console.log(
				`[Scraper] Level 1 scraping completed for code: ${code}`,
			);

			return curriculumData;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Scraper] Error during Level 1 scraping for ${code}:`,
				error,
			);

			// Return partial data on error
			return {
				code,
				years: [],
			};
		} finally {
			// Cleanup: close page and release session back to pool
			if (page) {
				await sessionPool.closePage(page as any);
			}
			await sessionPool.clear();
			// Close browser instance
			if (browserInstance) {
				await browserInstance.close().catch((err: any) => {
					// eslint-disable-next-line no-console
					console.warn(`[Scraper] Error closing browser:`, err);
				});
			}
		}
	}

	/**
	 * Validate cursus code format
	 * Expected format: 3-8 characters, alphanumeric
	 *
	 * @param code - Curriculum code to validate
	 * @returns True if valid
	 */
	private isValidCurriculumCode(code: string): boolean {
		const pattern = /^[A-Z0-9]{3,8}$/i;
		return pattern.test(code);
	}

	/**
	 * Build the full URL for a cursus
	 *
	 * @param code - Curriculum code
	 * @returns Full URL
	 */
	private buildCurriculumUrl(code: string): string {
		const baseUrl = `${this.bedeoCnamUrl}/${this.bedeoFormationPath}`;
		return `${baseUrl}${code}`;
	}

	/**
	 * Build the full URL for a unit/EU
	 *
	 * @param code - Unit code
	 * @returns Full URL
	 */
	buildUnitUrl(code: string): string {
		const baseUrl = `${this.bedeoCnamUrl}${this.bedeoUniteViewPath}`;
		return `${baseUrl}${code}`;
	}

	/**
	 * Scrape level 2 (unit detail pages)
	 * Extracts full unit information including content and bibliography
	 * Manages its own browser instance with session pooling
	 *
	 * @param unitUrls - Array of unit URLs to scrape
	 * @param options - Scraper options including cache and cursusCode
	 * @param env - Environment with CFBROWSER binding for launching browser
	 * @returns Array of enriched unit data
	 */
	async scrapeCurriculumLevel2(
		unitUrls: Array<{ code: string; url: string }>,
		options: ScraperOptions & { cache?: KVCache; cursusCode?: string } = {},
		env: Env,
	): Promise<any[]> {
		const cache: KVCache | undefined = (options as any).cache;
		const cursusCode: string | undefined = (options as any).cursusCode;
		// eslint-disable-next-line no-console
		console.log(
			`[Scraper] Starting Level 2 scrape for ${unitUrls.length} units`,
		);

		const timeout = options.timeout || 30000;
		const concurrencyLimit = 1; // Maximum 2 concurrent requests to avoid overwhelming server
		const results: any[] = [];

		// Launch browser instance for this scraping session
		const browserInstance = await launch(env.CFBROWSER);
		// Create session pool for reusable sessions
		const sessionPool = new CloudflareSessionPool(browserInstance, {
			maxSessions: Math.max(2, concurrencyLimit),
		});

		// Helper to sleep
		const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

		// Per-checkpoint tracking
		const enrichedMap: Record<string, any> = {};
		let processedSinceLastCheckpoint: string[] = [];
		let processedCount = 0;

		try {
			try {
				// Process units with concurrency limit
				for (let i = 0; i < unitUrls.length; i += concurrencyLimit) {
					const batch = unitUrls.slice(i, i + concurrencyLimit);

					// Process batch in parallel
					const batchResults = await Promise.allSettled(
						batch.map((unit) =>
							this.scrapeSingleUnit(unit, timeout, sessionPool),
						),
					);

					// Collect results and update processed count
					for (let bi = 0; bi < batchResults.length; bi++) {
						const result = batchResults[bi];
						const originalUnit = batch[bi];
						if (result.status === "fulfilled") {
							const unitData = result.value;
							results.push(unitData);
							if (unitData && unitData.code) {
								enrichedMap[unitData.code] = unitData;
								processedSinceLastCheckpoint.push(unitData.code);
							}
						} else {
							// eslint-disable-next-line no-console
							console.error(`[Scraper] Failed to scrape unit:`, result.reason);
						}

						processedCount++;

						// Checkpoint when reaching configured size
						if (cache && cursusCode && processedSinceLastCheckpoint.length >= this.checkpointSize) {
							console.log(`[Scraper Checkpoint] Checkpointing after processing ${processedCount} units...`);
							try {
								const lockToken = await cache.tryAcquireLock(cursusCode, 60);
								if (!lockToken) {
									// eslint-disable-next-line no-console
									console.warn(`[Scraper Checkpoint] Could not acquire lock for checkpointing ${cursusCode}, will retry on next checkpoint`);
								} else {
									// Read base and rich caches
									const base = (await cache.get<CursusLevel1>(cursusCode)) || { code: cursusCode, years: [] };
									const rich = (await cache.get<any>(cursusCode, "rich")) || { code: cursusCode, years: JSON.parse(JSON.stringify(base.years || [])) };

									// Mark units in base as rich = true
									for (const year of base.years || []) {
										for (const unit of year.units) {
											if (unit.code && enrichedMap[unit.code]) {
												unit.rich = true;
											}
										}
									}

									// Merge enriched units into rich structure (replace or append)
									for (const code of processedSinceLastCheckpoint) {
										const enriched = enrichedMap[code];
										let inserted = false;
										for (const year of rich.years || []) {
											for (let u = 0; u < (year.units || []).length; u++) {
												if (year.units[u].code === code) {
													year.units[u] = enriched;
													inserted = true;
													break;
												}
											}
											if (inserted) break;
										}
										if (!inserted) {
											if (!rich.years) rich.years = [];
											rich.years[0] = rich.years[0] || { year: "", units: [] };
											rich.years[0].units.push(enriched);
										}
									}

									// Write back base and rich caches
									const ttl = Number(process.env.SCRAPER_CACHE_TTL) || 2592000;
									await cache.set(cursusCode, base, ttl);
									// Respect one-write-per-second restriction on the same key
									await sleep(1100);
									await cache.set(cursusCode, rich, ttl, "rich");
									await cache.setMetadata(cursusCode, { lastCheckpoint: processedCount, lastWriteAt: new Date().toISOString() }, 86400, "rich");
									processedSinceLastCheckpoint = [];
									// Release lock
									await cache.releaseLock(cursusCode, lockToken);
									console.log(`[Scraper Checkpoint] Checkpoint completed for ${cursusCode} at ${processedCount} units processed.`);
								}
							} catch (err) {
								// eslint-disable-next-line no-console
								console.error(`[Scraper] Error during checkpoint for ${cursusCode}:`, err);
							}
						}
					}

					// Add small delay between batches to be respectful
					if (i + concurrencyLimit < unitUrls.length) {
						await sleep(1000);
					}
				}
			} finally {
				// Clear session pool
				await sessionPool.clear();
			}

			// eslint-disable-next-line no-console
			console.log(
				`[Scraper] Level 2 scraping completed for ${results.length} units`,
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Scraper] Error during Level 2 scraping:`,
				error,
			);
		} finally {
			// Close browser instance
			if (browserInstance) {
				await browserInstance.close().catch((err: any) => {
					// eslint-disable-next-line no-console
					console.warn(`[Scraper] Error closing browser:`, err);
				});
			}
		}

		return results;
	}

	/**
	 * Scrape a single unit detail page using session pooling
	 * Acquires a session from the pool, uses it, and releases it back for reuse
	 *
	 * @param unit - Unit with code and URL
	 * @param timeout - Request timeout in milliseconds
	 * @param sessionPool - Cloudflare session pool for reusable sessions
	 * @returns Enriched unit object
	 */
	private async scrapeSingleUnit(
		unit: { code: string; url: string },
		timeout: number,
		sessionPool: CloudflareSessionPool,
	): Promise<any> {
		let page: Page & { sessionName?: string } | null = null;

		try {
			// Create page with pooled session
			page = await sessionPool.createPage({ locale: "fr-FR" });
			if (!page) {
				throw new Error("Failed to create page for unit: " + unit.code);
			}
			page.setDefaultTimeout(timeout);
			page.setDefaultNavigationTimeout(timeout);

			// Configure User-Agent
			await page.route("**/*", (route: any) =>
				route.continue({
					headers: {
						...route.request().headers(),
						"User-Agent":
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15",
					},
				}),
			);

			// eslint-disable-next-line no-console
			console.log(
				`[Scraper] Fetching unit details for ${unit.code}...`,
			);

			// Navigate to unit page
			await page.goto(unit.url, {
				waitUntil: "networkidle",
				timeout,
			});

			// Wait for presentation section to be ready
			await page.waitForSelector(
				'//*[@id="presentation"]',
				{
					timeout: 5000,
				},
			).catch(() => {
				// Presentation section might not exist, continue anyway
				// eslint-disable-next-line no-console
				console.warn(
					`[Scraper] Presentation section not found for ${unit.code}`,
				);
			});

			// Parse the unit detail page
			const enrichedUnit =
				await CursusPageParser.parseUnitDetailPage(
					page,
					unit.code,
				);

			return enrichedUnit;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[Scraper] Error scraping unit ${unit.code}:`,
				error,
			);
			// Return unit with just the code on error
			return { code: unit.code, name: unit.code };
		} finally {
			// Close page and release session back to pool for reuse
			if (page) {
				await sessionPool.closePage(page);
			}
		}
	}
}
