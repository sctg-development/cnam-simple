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
 * KV Cache Manager: Abstraction Layer for Cloudflare KV Storage
 * Implements TTL-based expiration with namespace-based key generation
 * Provides transparent caching for expensive web scraping operations
 */
export class KVCache {
	private kvNamespace: KVNamespace;

	constructor(kvNamespace: KVNamespace) {
		this.kvNamespace = kvNamespace;
	}

	/**
	 * Key Namespacing Strategy: Hierarchical key structure for organizational clarity
	 * Example: 'cnam:cursus:CYC9101A' or 'cnam:cursus:rich:CYC9101A'
	 * This enables efficient batch operations and key-space organization
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
	 * Retrieve cached entry with automatic TTL validation
	 * Time-to-Live Pattern: Transparently handles expired entries
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

	/**
	 * Set metadata related to a cache entry (stored under suffix 'meta', e.g. 'rich-meta').
	 */
	async setMetadata(code: string, meta: Record<string, unknown>, ttlSeconds: number = 86400, suffix?: string): Promise<boolean> {
		try {
			const metaSuffix = suffix ? `${suffix}-meta` : "meta";
			return await this.set(code, meta as unknown, ttlSeconds, metaSuffix);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error setting metadata for ${code}:`, error);
			return false;
		}
	}

	/**
	 * Try to acquire a short-lived advisory lock for a cursus.
	 * Note: Cloudflare KV does not provide atomic compare-and-set, so this is a best-effort
	 * advisory lock using existence checks and TTL. For full serialization use Durable Objects.
	 * Returns a token string when lock is acquired, or null otherwise.
	 */
	async tryAcquireLock(code: string, ttlSeconds: number = 30): Promise<string | null> {
		const lockKey = `cnam:cursus:rich-lock:${code.toUpperCase()}`;
		try {
			const existing = await this.kvNamespace.get(lockKey);
			if (existing) return null;

			const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
			await this.kvNamespace.put(lockKey, token, { expirationTtl: ttlSeconds });
			// Return the token so the caller can verify ownership when releasing
			return token;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error acquiring lock for ${code}:`, error);
			return null;
		}
	}

	/**
	 * Release the advisory lock if the token still matches. Best-effort.
	 */
	async releaseLock(code: string, token: string): Promise<boolean> {
		const lockKey = `cnam:cursus:rich-lock:${code.toUpperCase()}`;
		try {
			const current = await this.kvNamespace.get(lockKey);
			if (current && current === token) {
				await this.kvNamespace.delete(lockKey);
				return true;
			}
			return false;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error releasing lock for ${code}:`, error);
			return false;
		}
	}
}
