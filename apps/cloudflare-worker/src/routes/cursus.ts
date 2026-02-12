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
import type { CursusLevel1, CursusApiResponse, Unit } from "../scraper/types";
import { validateScraperPassword } from "../utils/password-validator";

/**
 * Utility: Find units that haven't been enriched yet (rich !== true)
 * Traverses all years and identifies units with rich flag missing or false
 */
function findUnfinishedUnits(cursusData: CursusLevel1): Unit[] {
	const unfinished: Unit[] = [];
	for (const year of cursusData.years || []) {
		for (const unit of year.units || []) {
			if (!unit.rich) {
				unfinished.push(unit);
			}
		}
	}
	return unfinished;
}

/**
 * Utility: Build unit URLs for scraping from a list of units
 * Constructs URLs from existing unit.url or generates from unit.code
 */
function buildUnitUrlsForUnits(
	units: Unit[],
	cnamBedeoUrl: string,
	cnamBedeoUnitePath: string,
): Array<{ code: string; url: string }> {
	return units
		.map((unit) => {
			if (!unit.code) return null;

			const url =
				unit.url ||
				(unit.code ? `${cnamBedeoUrl}${cnamBedeoUnitePath}${unit.code}` : undefined);

			if (!url) return null;

			return {
				code: unit.code,
				url,
			};
		})
		.filter((u) => u !== null) as Array<{ code: string; url: string }>;
}

/**
 * Utility: Merge enriched units into an existing cursus structure
 * Replaces units with their enriched versions from the enriched array
 */
function mergeEnrichedUnits(cursusData: CursusLevel1, enrichedUnits: any[]): CursusLevel1 {
	const enrichedMap = new Map(enrichedUnits.map((u) => [u.code, u]));

	return {
		...cursusData,
		years: cursusData.years.map((year) => ({
			...year,
			units: year.units.map((unit) => enrichedMap.get(unit.code) || unit),
		})),
	};
}

/**
 * Utility: Apply rich flags from base cache to rich cache
 * Ensures that units marked as rich in base are also marked in the data structure
 * This synchronizes the state after checkpoints which update the base cache
 */
function applyCachedRichFlags(dataToEnrich: CursusLevel1, baseCache: CursusLevel1 | null): CursusLevel1 {
	if (!baseCache) return dataToEnrich;

	// Build a map of codes -> rich flag from base cache
	const richFlagsFromBase = new Map<string, boolean>();
	for (const year of baseCache.years || []) {
		for (const unit of year.units || []) {
			if (unit.code) {
				richFlagsFromBase.set(unit.code, unit.rich === true);
			}
		}
	}

	// Apply these flags to the data structure
	return {
		...dataToEnrich,
		years: dataToEnrich.years.map((year) => ({
			...year,
			units: year.units.map((unit) => {
				const richFromBase = richFlagsFromBase.get(unit.code || "");
				if (richFromBase !== undefined && richFromBase === true) {
					return { ...unit, rich: true };
				}
				return unit;
			}),
		})),
	};
}

/**
 * Utility: Calculate enrichment completion percentage
 * Returns 0-100 indicating how many units have been enriched
 */
function calculateEnrichmentPercent(cursusData: CursusLevel1): number {
	const allUnits = cursusData.years.flatMap((y) => y.units);
	if (allUnits.length === 0) return 100;

	const richCount = allUnits.filter((u) => u.rich).length;
	return Math.round((richCount / allUnits.length) * 100);
}

/**
 * Setup cursus routes
 * Handles API endpoints for curriculum data with caching and scraping strategies
 */
export const setupCurriculumRoutes = (router: Router, env: Env): void => {
	/**
	 * GET /api/cursus/<code>
	 * Retrieve curriculum data with optional enrichment
	 * Cache & Security Pattern: Validates credentials before allowing cache override
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
				if (apiKey && force) {				// Password Validation Pattern: Validate credentials for privileged operations					
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
				// Resource Pool Management Pattern: Reusable browser instance for multiple scraping operations
				let browserInstance: Browser | null = null;
				// Create browser instance once
    			browserInstance = await browserLaunch(env.CFBROWSER);

				const scraper = new CNAMScraper(env);

				// Load cache upfront if not forcing
				const cachedRich = !force && !forcedByOverride ? await cache.get<any>(code, "rich") : null;
				const cachedData = !force && !forcedByOverride ? await cache.get<CursusLevel1>(code) : null;

				// If forced override, invalidate cache
				if (forcedByOverride) {
					await cache.invalidate(code);
					// eslint-disable-next-line no-console
					console.log(`[Route] Cache invalidated by password override for ${code}`);
				}

				// If rich cache complete, return it immediately
				if (cachedRich) {
					const enrichPercent = calculateEnrichmentPercent(cachedRich);
					// eslint-disable-next-line no-console
					console.log(`[Route] Cache hit for ${code} (rich, ${enrichPercent}% enriched)`);

					// Return if not requesting enrichment OR if enrichment is complete
					if (!enrich || enrichPercent === 100) {
						const response: CursusApiResponse = {
							success: true,
							data: {
								name: cachedRich.name || code,
								code: cachedRich.code,
								audience_access: cachedRich.audience_access,
								objectives: cachedRich.objectives,
								EU: cachedRich.years,
							},
							cached: true,
							enrichedPercent: enrichPercent,
						};

						return new Response(JSON.stringify(response), {
							status: 200,
							headers: {
								...router.corsHeaders,
								"X-Cache": enrichPercent === 100 ? "HIT-RICH-COMPLETE" : "HIT-RICH-PARTIAL",
								"Content-Type": "application/json",
							},
						});
					}
					// If enrich=true and incomplete, continue below with cachedRich as base
					// eslint-disable-next-line no-console
					console.log(
						`[Route] Cache hit but incomplete (${enrichPercent}%). Continuing enrichment for ${code}`,
					);
				}
				// If base cache exists and no enrichment requested, return it
				else if (cachedData && !enrich) {
					// eslint-disable-next-line no-console
					console.log(`[Route] Cache hit for ${code} (base only)`);

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

				// Determine if we need to scrape Level 1
				// Skip Level 1 if we have base cache (with or without enrichment request)
				let baseData = cachedData;
				const ttl = Number(env.SCRAPER_CACHE_TTL) || 2592000; // 30 days in seconds

				if (!baseData) {
					// eslint-disable-next-line no-console
					console.log(`[Route] Cache miss or forced refresh for ${code}`);

					// Scrape fresh Level 1 data
					baseData = await scraper.scrapeCurriculumLevel1(
						code,
						{ timeout },
						browserInstance,
					);

					// Validate we got meaningful data
					if (!baseData || baseData.years.length === 0) {
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

					// Cache the base result
					await cache.set(code, baseData, ttl);
				} else {
					// eslint-disable-next-line no-console
					console.log(`[Route] Using cached base data for ${code}`);
				}

				// Prepare data for enrichment or response
				let dataToReturn = baseData;

				// Enrich with Level 2 unit details if requested
				if (enrich) {
					// eslint-disable-next-line no-console
					console.log(`[Route] Enriching cursus ${code} with Level 2 unit details`);

					// Use cached rich as base for continuation if available, otherwise use base data
					let dataToEnrich = cachedRich || baseData;

					// If we have both cachedRich and baseData, apply rich flags from base to enrich
					// This ensures we respect checkpoints that updated the base cache
					if (cachedRich && baseData) {
						dataToEnrich = applyCachedRichFlags(cachedRich, baseData);
						// eslint-disable-next-line no-console
						console.log(`[Route] Applied rich flags from base cache to enrich data`);
					}

					// Find unfinished units
					const unfinishedUnits = findUnfinishedUnits(dataToEnrich);

					if (unfinishedUnits.length === 0) {
						// eslint-disable-next-line no-console
						console.log(`[Route] All units already enriched for ${code}`);
						dataToReturn = dataToEnrich;
					} else {
						// eslint-disable-next-line no-console
						console.log(
							`[Scrapper Restarting] Found ${unfinishedUnits.length} unfinished units for ${code}`,
						);

						// Build unit URLs for the unfinished units
						const unitUrlsToScrape = buildUnitUrlsForUnits(
							unfinishedUnits,
							env.CNAM_BEDEO_URL as string,
							env.CNAM_BEDEO_UNITE_VIEW_PATH as string,
						);

						if (unitUrlsToScrape.length > 0) {
							// Scrape Level 2 details (with concurrency limits due to timeout constraints, cache & cursusCode for checkpointing)
							try {
								const enrichedUnits = await scraper.scrapeCurriculumLevel2(
									unitUrlsToScrape,
									{ timeout, cache, cursusCode: code },
									browserInstance,
								);

								// Merge enriched units into the data structure
								dataToEnrich = mergeEnrichedUnits(dataToEnrich, enrichedUnits);

								// eslint-disable-next-line no-console
								console.log(`[Route] Enrichment complete for ${code}`);

								// Update cache with enriched data (stored under 'rich' suffix)
								await cache.set(code, dataToEnrich, ttl, "rich");
							} catch (enrichError) {
								// eslint-disable-next-line no-console
								console.warn(
									`[Route] Enrichment failed for ${code}, returning partially enriched data:`,
									enrichError,
								);
								// Continue with partially enriched data
							}
						}

						dataToReturn = dataToEnrich;
					}
				}

				const finalEnrichPercent = enrich ? calculateEnrichmentPercent(dataToReturn) : 0;

				const response: CursusApiResponse = {
					success: true,
					data: {
						name: dataToReturn.name || code,
						code: dataToReturn.code,
						audience_access: dataToReturn.audience_access,
						objectives: dataToReturn.objectives,
						EU: dataToReturn.years,
					},
					cached: !baseData || enrich,
					scrapedAt: !baseData ? new Date().toISOString() : undefined,
					enrichedPercent: finalEnrichPercent,
				};

				return new Response(JSON.stringify(response), {
					status: 200,
					headers: {
						...router.corsHeaders,
						"X-Cache": cachedRich ? "PARTIAL-ENRICHED" : "FRESH",
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
