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

import { B } from "vitest/dist/chunks/worker.d.1GmBbd7G.js";

/**
 * Bibliography entry for a unit
 */
export interface Bibliography {
	title: string;
	author: string;
}

/**
 * Unit (EU - Élément d'Unité) details
 */
export interface Unit {
	name: string;
	code?: string;
	url?: string;
	audience_access?: string;
	objectives?: string;
	content?: string;
	bibliography?: Bibliography[];
}

/**
 * Year section in a cursus
 */
export interface Year {
	year: number | string;
	units: Unit[];
}

/**
 * Complete cursus structure
 */
export interface Cursus {
	name: string;
	code: string;
	audience_access?: string;
	objectives?: string;
	EU: Year[];
}

/**
 * API Response for cursus endpoint
 */
export interface CursusApiResponse {
	success: boolean;
	data?: Cursus;
	cached?: boolean;
	scrapedAt?: string;
	error?: string;
}

/**
 * Cursus parsing result
 */
export interface CursusLevel1 {
	code: string;
	name?: string;
	audience_access?: string;
	objectives?: string;
	years: {
		year: string | number;
		units: Unit[];
	}[];
}

/**
 * Scraper options
 */
export interface ScraperOptions {
	timeout?: number;
	force?: boolean;
	parallel?: boolean;
}
