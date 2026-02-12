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
import { setupCurriculumRoutes } from "./cursus";

// Route Registry Pattern: Centralized route registration through modular setup functions
export const setupRoutes = (router: Router, env: Env) => {
	// Composition of route modules: Each domain has its own setup function
	router.get("/", async () => {
		return new Response("Welcome to the CNAM-SIMPLE API - see https://github.com/sctg-development/cnam-simple", {
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});
	});

	// Simple health check (public)
	router.get("/health", async () => {
		return new Response(JSON.stringify({ success: true, status: "ok" }), {
			status: 200,
			headers: { ...router.corsHeaders, "Content-Type": "application/json" },
		});
	});

	// Setup cursus routes: Modular route composition
	setupCurriculumRoutes(router, env);
};
