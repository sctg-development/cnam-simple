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
 * Year section in a curriculum
 */
export interface Year {
	year: number | string;
	units: Unit[];
}

/**
 * Complete curriculum structure
 */
export interface Curriculum {
	name: string;
	code: string;
	audience_access?: string;
	objectives?: string;
	EU: Year[];
}

/**
 * API Response for curriculum endpoint
 */
export interface CurriculumResponse {
	success: boolean;
	data?: Curriculum;
	cached?: boolean;
	scrapedAt?: string;
	error?: string;
}

/**
 * Level 1 parsing result (main curriculum page)
 */
export interface CurriculumPageLevel1 {
	code: string;
	name?: string;
	audience_access?: string;
	objectives?: string;
	years: {
		year: string | number;
		units: {
			name: string;
			code?: string;
			url?: string;
		}[];
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
