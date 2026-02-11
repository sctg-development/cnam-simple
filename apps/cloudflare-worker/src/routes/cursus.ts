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

import { Router } from "./router";
import { launch as browserLaunch } from "@cloudflare/playwright";
import type { Browser } from "@cloudflare/playwright";
import { CNAMScraper } from "../scraper/cnam-scraper";
import { KVCache } from "../cache/kv-cache";
import type { CursusLevel1, CursusApiResponse } from "../scraper/types";
import { validateScraperPassword } from "../utils/password-validator";

/**
 * Setup cursus routes
 * Handles API endpoints for cursus data
 */
export const setupCurriculumRoutes = (router: Router, env: Env): void => {
	/**
	 * GET /api/cursus/<code>
	 * Retrieve cursus data (Level 1: years and units)
	 *
	 * Query parameters:
	 * - force: boolean (force scrape even if cached)
	 * - timeout: number (custom timeout in milliseconds)
	 * - enrich: boolean (fetch Level 2 unit details)
	 * - api-key: string (SHA512-crypt password to allow cache invalidation)
	 */
	router.get(
		"/api/cursus/<code>",
		async (req: any, env: Env): Promise<Response> => {
			try {
				const { code } = req.params as { code: string };
				const url = new URL(req.url);

				// Parse query parameters
				let force = url.searchParams.get("force") === "true";
				const timeout = url.searchParams.get("timeout")
					? parseInt(url.searchParams.get("timeout") || "30000", 10)
					: 30000;
				const enrich = url.searchParams.get("enrich") === "true";
				const apiKey = url.searchParams.get("api-key");

				// If force is requested but no api-key was provided, ignore the force to avoid
				// accidental cache invalidation. A valid api-key is required to override cache.
				if (force && !apiKey) {
					// eslint-disable-next-line no-console
					console.warn(
						`[Route] Force requested for ${code} but no api-key provided; ignoring force parameter to preserve cache.`,
					);
					force = false;
				}
				// eslint-disable-next-line no-console
				console.log(
					`[Route] GET /api/cursus/${code} (force: ${force}, timeout: ${timeout}ms, enrich: ${enrich})`,
				);

				// Handle cache override with password if api-key is provided and force is true
				let forcedByOverride = false;
				if (apiKey && force) {
					const passwordHash = env.SCRAPER_CACHE_OVERRIDE as string;
					if (passwordHash && validateScraperPassword(apiKey, passwordHash)) {
						// eslint-disable-next-line no-console
						console.log(`[Route] Cache override validated for ${code}`);
						forcedByOverride = true;
					} else {
						// eslint-disable-next-line no-console
						console.warn(`[Route] Invalid cache override password attempt for ${code}`);
						return new Response(JSON.stringify({ success: false, error: "Invalid password" }), {
							status: 403,
							headers: {
								...router.corsHeaders,
								"Content-Type": "application/json",
							},
						});
					}
				}

				// Initialize services
				const cache = new KVCache(env.CACHE as KVNamespace);
				let browserInstance: Browser | null = null; // Reusable browser instance
				// Create browser instance once
    			browserInstance = await browserLaunch(env.CFBROWSER);

				const scraper = new CNAMScraper(env);

				// Check cache if not forcing fresh data
				if (!force && !forcedByOverride) {
					const cachedData = await cache.get<CursusLevel1>(
						code,
					);

					if (cachedData) {
						// eslint-disable-next-line no-console
						console.log(`[Route] Cache hit for ${code}`);

						const response: CursusApiResponse = {
							success: true,
							data: {
								name: cachedData.name || code,
								code: cachedData.code,
								audience_access: cachedData.audience_access,
								objectives: cachedData.objectives,
								EU: cachedData.years,
							},
							cached: true,
						};

						return new Response(JSON.stringify(response), {
							status: 200,
							headers: {
								...router.corsHeaders,
								"X-Cache": "HIT",
								"Content-Type": "application/json",
							},
						});
					}
				} else if (forcedByOverride) {
					// Invalidate cache on successful password override
					await cache.invalidate(code);
					// eslint-disable-next-line no-console
					console.log(`[Route] Cache invalidated by password override for ${code}`);
				}

				// eslint-disable-next-line no-console
				console.log(`[Route] Cache miss or forced refresh for ${code}`);

				// Scrape fresh data
				const scrapedData = await scraper.scrapeCurriculumLevel1(
					code,
					{ timeout },
					browserInstance,
				);

				// Validate we got meaningful data
				if (!scrapedData || scrapedData.years.length === 0) {
					const errorResponse: CursusApiResponse = {
						success: false,
						error: `No cursus data found for code: ${code}`,
					};

					return new Response(JSON.stringify(errorResponse), {
						status: 404,
						headers: {
							...router.corsHeaders,
							"Content-Type": "application/json",
						},
					});
				}

				// Cache the result (30 days default)
				const ttl = Number(env.SCRAPER_CACHE_TTL) || 2592000; // 30 days in seconds
				await cache.set(code, scrapedData, ttl);

				// Enrich with Level 2 unit details if requested
				if (enrich) {
					// eslint-disable-next-line no-console
					console.log(`[Route] Enriching cursus ${code} with Level 2 unit details`);

					// Build unit URLs from the scraped data
					// Prefer the URL extracted from the Level 1 page if available.
					// Skip units with neither a URL nor a code to avoid invalid requests.
					const unitUrls = scrapedData.years.flatMap((year) =>
						year.units
							.map((unit) => {
								const url =
									unit.url ||
									(unit.code ? `${env.CNAM_BEDEO_URL}${env.CNAM_BEDEO_UNITE_VIEW_PATH}${unit.code}` : undefined);
								if (!url) return null;
								return {
									...unit,
									url,
								};
							})
							.filter((u) => u !== null) as Array<{ code?: string; url: string }>,)

					// Scrape Level 2 details (with concurrency limits due to timeout constraints)
					try {
						// Ensure unitUrls[].code is defined for all units for matching type {code: string; url: string}
						const unitUrlsWithCodes = unitUrls.map((unit) => {
							if (!unit.code) {
								// Extract code from URL as fallback (assuming it's the last part of the URL)
								const extractedCode = unit.url.split("/").filter(Boolean).pop() || "";
								return { ...unit, code: extractedCode };
							}
							return unit as { code: string; url: string };
						});
						
						const enrichedUnits = await scraper.scrapeCurriculumLevel2(
							unitUrlsWithCodes,
							{ timeout },
							browserInstance,
						);

						// Merge enriched units back into years
						scrapedData.years = scrapedData.years.map((year) => ({
							...year,
							units: year.units.map(
								(unit) =>
									enrichedUnits.find((eu) => eu.code === unit.code) ||
									unit,
							),
						}));

						// eslint-disable-next-line no-console
						console.log(`[Route] Enrichment complete for ${code}`);
						// update cache with enriched data
						await cache.set(code, scrapedData, ttl);
					} catch (enrichError) {
						// eslint-disable-next-line no-console
						console.warn(
							`[Route] Enrichment failed for ${code}, returning Level 1 data:`,
							enrichError,
						);
						// Continue with Level 1 data only
					}
				}

				const response: CursusApiResponse = {
					success: true,
					data: {
						name: scrapedData.name || code,
						code: scrapedData.code,
						audience_access: scrapedData.audience_access,
						objectives: scrapedData.objectives,
						EU: scrapedData.years,
					},
					cached: false,
					scrapedAt: new Date().toISOString(),
				};

				return new Response(JSON.stringify(response), {
					status: 200,
					headers: {
						...router.corsHeaders,
						"X-Cache": "MISS",
						"Content-Type": "application/json",
					},
				});
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error("[Route] Error in cursus handler:", error);

				const errorResponse: CursusApiResponse = {
					success: false,
					error: `Error retrieving cursus: ${error instanceof Error ? error.message : "Unknown error"}`,
				};

				return new Response(JSON.stringify(errorResponse), {
					status: 500,
					headers: {
						...router.corsHeaders,
						"Content-Type": "application/json",
					},
				});
			}
		},
	);

	/**
	 * DELETE /api/cursus/<code>/cache
	 * Invalidate cursus cache (admin only)
	 */
	router.delete(
		"/api/cursus/<code>/cache",
		async (req: any, env: Env): Promise<Response> => {
			try {
				const { code } = req.params as { code: string };

				// eslint-disable-next-line no-console
				console.log(`[Route] DELETE /api/cursus/${code}/cache`);

				const cache = new KVCache(env.CACHE as KVNamespace);
				const success = await cache.invalidateAll(code);

				if (success) {
					return new Response(
						JSON.stringify({
							success: true,
							message: `Cache invalidated for ${code}`,
						}),
						{
							status: 200,
							headers: {
								...router.corsHeaders,
								"Content-Type": "application/json",
							},
						},
					);
				} else {
					return new Response(
						JSON.stringify({
							success: false,
							error: `Failed to invalidate cache for ${code}`,
						}),
						{
							status: 500,
							headers: {
								...router.corsHeaders,
								"Content-Type": "application/json",
							},
						},
					);
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error("[Route] Error in cache invalidation handler:", error);

				return new Response(
					JSON.stringify({
						success: false,
						error: `Error invalidating cache: ${error instanceof Error ? error.message : "Unknown error"}`,
					}),
					{
						status: 500,
						headers: {
							...router.corsHeaders,
							"Content-Type": "application/json",
						},
					},
				);
			}
		},
	);
};
