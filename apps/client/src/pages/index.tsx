/**
 * Copyright (c) 2024-2026 Ronan LE MEILLAT
 * License: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import type { CursusApiResponse, Cursus } from "@/types";

import { button as buttonStyles } from "@heroui/theme";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import CnamMarkdownViewer from "@/components/cnam-markdown-viewer.tsx";
import PdfTransformer from "@/components/pdf-transformer";
import SearchControl from "@/components/search-control";
import { title, subtitle } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

/**
 * SearchBar Component: API Integration & Data Orchestration
 * - Client-side orchestrator pattern: Manages API calls, response parsing, and component communication
 * - Separation of concerns: Delegates markdown/PDF generation to specialized child components
 * - Manages search input and request state
 * - Calls the backend and receives cursus JSON
 * - Converts JSON into markdown and prepares download blobs
 */
function SearchBar() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentStatus, setEnrichmentStatus] = useState<string | null>(null);
  // Keep the API data (JSON) and let the viewer component generate markdown
  // and the download blobs. The SearchBar will render download links when
  // the viewer exposes them through `onGenerated`.
  const [data, setData] = useState<Cursus | null>(null);
  const [mdUrl, setMdUrl] = useState<string | null>(null);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);

  // Accept an optional `codeToSearch` param so parents (e.g. Navbar)
  // can request a search programmatically.
  const navigate = useNavigate();
  const location = useLocation();

  // Callback Memoization Pattern: Prevents unnecessary re-renders of dependent children
  const handleSearch = useCallback(
    async (codeToSearch?: string) => {
      setError(null);
      setEnrichmentStatus(null);
      setData(null);

      const trimmed = (codeToSearch ?? code).trim();

      if (!trimmed) return setError(t("search_error"));

      // Async Error Handling: Try-catch wrapper for API calls
      setLoading(true);
      try {
        // Environment-aware Configuration: Backend URL from build environment
        const base = (import.meta.env as any).CLOUDFLARE_BACKEND || "";

        // eslint-disable-next-line no-console
        console.log("Fetching data for code:", trimmed, "from backend:", base);
        const res = await fetch(
          `${base}/api/cursus/${encodeURIComponent(trimmed)}?enrich=true`,
        );
        const json = (await res.json()) as CursusApiResponse;

        if (!json || !json.success || !json.data) {
          setError(t("no_results"));
          setLoading(false);

          return;
        }

        // Check if enrichment was interrupted (less than 100% enriched)
        if (json.enrichedPercent !== undefined && json.enrichedPercent < 100) {
          setEnrichmentStatus(
            `⚠️ ${t("scraping_interrupted", {
              defaultValue: `Scraping interrupted at {{percent}}%`,
            }).replace("{{percent}}", String(json.enrichedPercent))}`,
          );
        }

        // Keep the raw JSON and let the viewer generate markdown + blobs
        setData(json.data);

        // Update browser URL if it does not already reflect the current query
        try {
          const currentQ = new URLSearchParams(location.search).get("q");

          if (currentQ !== trimmed) {
            // If we're already on the home page, push a new entry; otherwise
            // navigate to the home page with the query param.
            if (location.pathname === "/") {
              navigate(`/?q=${encodeURIComponent(trimmed)}`);
            } else {
              navigate(`/?q=${encodeURIComponent(trimmed)}`);
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (err: any) {
        setError(t("search_error"));
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [code, location.search, location.pathname, navigate, t],
  );

  // Auto-run search when `q` query param is present (useful when triggered from Navbar)
  useEffect(() => {
    // React to changes of the location's search param using react-router's location
    try {
      const params = new URLSearchParams(location.search);
      const q = params.get("q");

      if (q) {
        setCode(q);
        // call handleSearch with param (it will avoid re-navigating if already set)
        void handleSearch(q);
      }
    } catch (e) {
      // ignore
    }
  }, [location.search, handleSearch]);

  return (
    <div className="w-full mt-6">
      <div className="flex gap-2 w-full items-center">
        <SearchControl
          initialValue={code}
          inputWidthClass="w-96"
          isLoading={loading}
          onSearch={(c) => {
            setCode(c);
            handleSearch(c);
          }}
        />
      </div>

      <div className="mt-4">
        {error && <div className="text-red-500">{error}</div>}

        {enrichmentStatus && (
          <div className="text-amber-600 font-semibold">{enrichmentStatus}</div>
        )}

        {data && (
          <>
            <div className="mt-4 flex gap-2">
              {mdUrl && (
                <a
                  className={buttonStyles({ variant: "bordered" })}
                  download={`${code}.md`}
                  href={mdUrl}
                >
                  {t("download_markdown")}
                </a>
              )}

              {jsonUrl && (
                <a
                  className={buttonStyles({ variant: "bordered" })}
                  download={`${code}.json`}
                  href={jsonUrl}
                >
                  {t("download_json")}
                </a>
              )}

              <PdfTransformer data={data} fileName={`${code}.pdf`} />
            </div>
            <CnamMarkdownViewer
              data={data}
              onGenerated={(payload) => {
                if (!payload) {
                  setMdUrl(null);
                  setJsonUrl(null);

                  return;
                }

                setMdUrl(payload.mdUrl);
                setJsonUrl(payload.jsonUrl);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function IndexPage() {
  const { t } = useTranslation();

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center justify-center">
          <span className={title()}>{t("cnam")}&nbsp;</span>
          <span className={title({ color: "violet" })}>
            {t("simple")}&nbsp;
          </span>
          <br />
          <span className={title()}>
            <Trans i18nKey="cnam-index-title" />
          </span>
          <div className={subtitle({ class: "mt-4" })}>
            <Trans i18nKey="cnam-index-subtitle" />
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full items-center md:items-start">
          {/* Search UI */}
          <SearchBar />
        </div>
      </section>
    </DefaultLayout>
  );
}
