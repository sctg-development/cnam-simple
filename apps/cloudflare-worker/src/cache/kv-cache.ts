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

import type { Cursus, CursusLevel1 } from "../scraper/types";

export interface CacheEntry<T> {
	data: T;
	timestamp: string;
	expiresAt?: string;
}

/**
 * KV Cache Manager for Cloudflare Workers
 * Handles caching of cursus data with TTL support
 */
export class KVCache {
	private kvNamespace: KVNamespace;

	constructor(kvNamespace: KVNamespace) {
		this.kvNamespace = kvNamespace;
	}

	/**
	 * Generate a cache key for a cursus code.
	 * If a suffix is provided it will be placed before the code, e.g.:
	 *  - generateKey('CYC9101A') -> 'cnam:cursus:CYC9101A'
	 *  - generateKey('CYC9101A', 'rich') -> 'cnam:cursus:rich:CYC9101A'
	 */
	private generateKey(code: string, suffix?: string): string {
		const codeUpper = code.toUpperCase();
		if (suffix) {
			// Place the suffix before the code to keep namespace-style keys
			return `cnam:cursus:${suffix}:${codeUpper}`;
		}
		return `cnam:cursus:${codeUpper}`;
	}

	/**
	 * Get cached cursus data
	 */
	async get<T>(code: string, suffix?: string): Promise<T | null> {
		try {
			const key = this.generateKey(code, suffix);
			const cached = await this.kvNamespace.get(key, "json");

			if (!cached) {
				return null;
			}

			const entry = cached as CacheEntry<T>;

			// Check if entry has expired
			if (entry.expiresAt) {
				const now = new Date();
				const expiresAt = new Date(entry.expiresAt);

				if (now > expiresAt) {
					// Entry has expired, delete it
					await this.kvNamespace.delete(key);
					return null;
				}
			}

			return entry.data;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error retrieving cache for ${code}:`, error);
			return null;
		}
	}

	/**
	 * Set cached cursus data with TTL (in seconds)
	 * Default TTL: 24 hours (86400 seconds)
	 */
	async set<T>(
		code: string,
		data: T,
		ttlSeconds: number = 86400,
		suffix?: string,
	): Promise<boolean> {
		try {
			const key = this.generateKey(code, suffix);
			const now = new Date();
			const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

			const entry: CacheEntry<T> = {
				data,
				timestamp: now.toISOString(),
				expiresAt: expiresAt.toISOString(),
			};

			await this.kvNamespace.put(key, JSON.stringify(entry), {
				expirationTtl: ttlSeconds,
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error setting cache for ${code}:`, error);
			return false;
		}
	}

	/**
	 * Invalidate cache for a cursus code
	 */
	async invalidate(code: string, suffix?: string): Promise<boolean> {
		try {
			const key = this.generateKey(code, suffix);
			await this.kvNamespace.delete(key);
			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error invalidating cache for ${code}:`, error);
			return false;
		}
	}

	/**
	 * Invalidate all cache for a cursus code (all suffixes).
	 * Removes the base key and any suffixed keys related to the code (e.g. 'cnam:cursus:rich:<CODE>').
	 */
	async invalidateAll(code: string): Promise<boolean> {
		try {
			const codeUpper = code.toUpperCase();
			// List all keys under the cursus namespace and filter those related to the code
			const { keys } = await this.kvNamespace.list({
				prefix: "cnam:cursus:",
			});

			const matching = keys.filter((k) => {
				return k.name === `cnam:cursus:${codeUpper}` || k.name.endsWith(`:${codeUpper}`);
			});

			// Delete all matching keys
			const deletePromises = matching.map((key) => this.kvNamespace.delete(key.name));

			await Promise.all(deletePromises);
			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error invalidating all cache for ${code}:`, error);
			return false;
		}
	}

	/**
	 * Get cache metadata (for debugging)
	 */
	async getMetadata(code: string, suffix?: string): Promise<Omit<CacheEntry<unknown>, 'data'> | null> {
		try {
			const key = this.generateKey(code, suffix);
			const cached = await this.kvNamespace.get(key, "json");

			if (!cached) {
				return null;
			}

			const entry = cached as CacheEntry<unknown>;
			const { data, ...metadata } = entry;

			return metadata;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error retrieving cache metadata for ${code}:`, error);
			return null;
		}
	}
}
