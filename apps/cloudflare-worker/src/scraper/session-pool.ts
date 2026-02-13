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

import type { Browser, Page } from "@cloudflare/playwright";

/**
 * Cloudflare Session Pool: Object Pool Pattern
 * Manages reusable browser sessions as recommended by Cloudflare
 * https://developers.cloudflare.com/browser-rendering/playwright/#session-reuse
 *
 * Reduces cost and improves performance by reusing sessions across multiple pages
 * Sessions persist cookies, cache, and other state on Cloudflare's servers
 */
export class CloudflareSessionPool {
	private browser: Browser;
	private maxSessions: number;
	private sessionTimeout: number; // ms
	private sessions: Map<string, { createdAt: number; inUse: boolean }> = new Map();

	constructor(
		browser: Browser,
		options: { maxSessions?: number; sessionTimeout?: number } = {},
	) {
		this.browser = browser;
		this.maxSessions = options.maxSessions || 3;
		this.sessionTimeout = options.sessionTimeout || 300000; // 5 minutes default
	}

	/**
	 * Acquire a session for page creation
	 * Returns session name to be used with browser.newPage({ sessionName })
	 * Reuses existing sessions or creates new ones up to maxSessions limit
	 *
	 * @returns Session name for use with newPage()
	 */
	async acquireSession(): Promise<string> {
		// Try to find an available session
		for (const [sessionName, sessionInfo] of this.sessions.entries()) {
			if (!sessionInfo.inUse) {
				// Check if session hasn't timed out
				if (Date.now() - sessionInfo.createdAt < this.sessionTimeout) {
					sessionInfo.inUse = true;
					// eslint-disable-next-line no-console
					console.log(
						`[SessionPool] Reusing session: ${sessionName}`,
					);
					return sessionName;
				} else {
					// Session too old, remove it
					this.sessions.delete(sessionName);
				}
			}
		}

		// If we can create new sessions, do so
		if (this.sessions.size < this.maxSessions) {
			const sessionName = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			this.sessions.set(sessionName, {
				createdAt: Date.now(),
				inUse: true,
			});
			// eslint-disable-next-line no-console
			console.log(
				`[SessionPool] Created new session: ${sessionName} (${this.sessions.size}/${this.maxSessions})`,
			);
			return sessionName;
		}

		// Wait for a session to become available
		// eslint-disable-next-line no-console
		console.log(
			`[SessionPool] No sessions available, waiting for release...`,
		);
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				const availableSession = Array.from(this.sessions.entries()).find(
					([_, info]) =>
						!info.inUse &&
						Date.now() - info.createdAt < this.sessionTimeout,
				);

				if (availableSession) {
					clearInterval(checkInterval);
					availableSession[1].inUse = true;
					// eslint-disable-next-line no-console
					console.log(
						`[SessionPool] Acquired session after waiting: ${availableSession[0]}`,
					);
					resolve(availableSession[0]);
				}
			}, 100);

			// Timeout after 30 seconds
			setTimeout(() => {
				clearInterval(checkInterval);
				// Create new session as fallback
				const sessionName = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				this.sessions.set(sessionName, {
					createdAt: Date.now(),
					inUse: true,
				});
				// eslint-disable-next-line no-console
				console.warn(
					`[SessionPool] Session acquisition timeout, creating new session: ${sessionName}`,
				);
				resolve(sessionName);
			}, 30000);
		});
	}

	/**
	 * Release a session back to the pool for reuse
	 * Should be called when page using this session is closed
	 *
	 * @param sessionName - Session name returned by acquireSession()
	 */
	releaseSession(sessionName: string): void {
		const sessionInfo = this.sessions.get(sessionName);
		if (sessionInfo) {
			sessionInfo.inUse = false;
			// eslint-disable-next-line no-console
			console.log(`[SessionPool] Released session: ${sessionName}`);
		}
	}

	/**
	 * Create a new page using a pooled session
	 * Handles session acquisition and configuration in one call
	 *
	 * @param options - Page creation options
	 * @returns Page instance with session tracking
	 */
	async createPage(options: any = {}): Promise<Page & { sessionName?: string }> {
		const sessionName = await this.acquireSession();
		const page = (await this.browser.newPage({
			...options,
			sessionName,
		})) as Page & { sessionName?: string };
		page.sessionName = sessionName;
		return page;
	}

	/**
	 * Close a page and release its session
	 *
	 * @param page - Page instance with sessionName property
	 */
	async closePage(page: Page & { sessionName?: string }): Promise<void> {
		if (page.sessionName) {
			this.releaseSession(page.sessionName);
		}
		await page.close().catch((err: any) => {
			// eslint-disable-next-line no-console
			console.warn(`[SessionPool] Error closing page:`, err);
		});
	}

	/**
	 * Get pool statistics for monitoring
	 */
	getStats(): {
		totalSessions: number;
		activeSessions: number;
		availableSessions: number;
		maxSessions: number;
	} {
		let activeSessions = 0;
		let availableSessions = 0;

		for (const info of this.sessions.values()) {
			if (info.inUse) {
				activeSessions++;
			} else {
				availableSessions++;
			}
		}

		return {
			totalSessions: this.sessions.size,
			activeSessions,
			availableSessions,
			maxSessions: this.maxSessions,
		};
	}

	/**
	 * Clear all sessions (graceful shutdown)
	 */
	async clear(): Promise<void> {
		// eslint-disable-next-line no-console
		console.log(`[SessionPool] Clearing all sessions`);
		this.sessions.clear();
	}
}
