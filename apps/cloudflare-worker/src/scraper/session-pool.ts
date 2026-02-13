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
import { acquire, connect } from "@cloudflare/playwright";

/**
 * Cloudflare Persistent Session Pool: Object Pool Pattern
 * Manages long-lived browser sessions using Cloudflare's acquire/connect pattern
 * https://developers.cloudflare.com/browser-rendering/playwright/#session-reuse
 *
 * Dramatically reduces cost and improves performance by:
 * - Acquiring a session once at worker startup (via acquire())
 * - Reconnecting to it for each request (via connect())
 * - Keeping state (cookies, cache) server-side between requests
 *
 * No local page/session tracking needed - Cloudflare manages the session lifecycle
 */
export class CloudflareSessionPool {
	private env: Env;
	private sessionId: string | null = null;
	private initializationPromise: Promise<string> | null = null;

	constructor(env: Env) {
		this.env = env;
	}

	/**
	 * Initialize the persistent session (acquire once at startup)
	 * This should be called once when the Worker starts, not for each request
	 * The session will be reused across all subsequent requests
	 *
	 * @returns Session ID for logging/debugging
	 */
	async initialize(): Promise<string> {
		// Avoid multiple concurrent initializations
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		if (this.sessionId) {
			return this.sessionId;
		}

		this.initializationPromise = (async () => {
			try {
				// Acquire a new persistent session (one-time cost)
				const { sessionId } = await acquire(this.env.CFBROWSER);
				this.sessionId = sessionId;
				// eslint-disable-next-line no-console
				console.log(
					`[SessionPool] Persistent session acquired: ${this.sessionId}`,
				);
				return this.sessionId;
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error("[SessionPool] Failed to acquire session:", error);
				throw new Error(
					`Failed to acquire persistent session: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		})();

		return this.initializationPromise;
	}

	/**
	 * Create a new page by connecting to the persistent session
	 * Each request reconnects to the same session (keeping cookies, cache, etc.)
	 * The browser will be disconnected (not closed) when the page is closed
	 *
	 * @param options - Page creation options (locale, etc.)
	 * @returns Page instance with attached browser reference for cleanup
	 */
	async createPage(
		options: any = {},
	): Promise<Page & { __browser?: any }> {
		// Ensure session is initialized
		await this.initialize();

		if (!this.sessionId) {
			throw new Error(
				"Session not initialized - initialize() must be called first",
			);
		}

		try {
			// Connect to the persistent session (no cost for reconnection)
			const browser = await connect(
				this.env.CFBROWSER,
				this.sessionId,
			);
			// eslint-disable-next-line no-console
			console.log(
				`[SessionPool] Connected to session ${this.sessionId}`,
			);

			// Create a new page in the connected session
			const page = (await browser.newPage(options)) as Page & {
				__browser?: any;
			};

			// Attach browser reference for cleanup
			page.__browser = browser;

			return page;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				`[SessionPool] Failed to create page in session ${this.sessionId}:`,
				error,
			);
			throw new Error(
				`Failed to create page: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Close a page and disconnect its browser
	 * This disconnects from the session (not closes it)
	 * The session remains alive on Cloudflare's servers for reuse
	 *
	 * @param page - Page instance with __browser reference
	 */
	async closePage(page: Page & { __browser?: any }): Promise<void> {
		const browser = page.__browser;

		try {
			// Close the page first
			await page.close().catch((err: any) => {
				// eslint-disable-next-line no-console
				console.warn(`[SessionPool] Error closing page:`, err);
			});

			// Disconnect from the session (session persists on Cloudflare)
			if (browser) {
				await browser.close().catch((err: any) => {
					// eslint-disable-next-line no-console
					console.warn(
						`[SessionPool] Error disconnecting browser:`,
						err,
					);
				});
				// eslint-disable-next-line no-console
				console.log(
					`[SessionPool] Disconnected from session ${this.sessionId}`,
				);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`[SessionPool] Error closing page:`, error);
		}
	}
}
