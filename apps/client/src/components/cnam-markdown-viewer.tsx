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

/**
 * Component: CnamMarkdownViewer
 * ----------------------------
 * Renders provided markdown (already generated from cursus JSON) using
 * `marked` and provides download links for the markdown and JSON blobs.
 *
 * Notes:
 * - This component intentionally mirrors previous behaviour: it uses
 *   `dangerouslySetInnerHTML` with the output of `marked`. If you want to
 *   harden against XSS you should sanitize the generated HTML (e.g., using
 *   DOMPurify) before rendering.
 */

import type { Cursus } from "@/types";

import React from "react";
import { marked } from "marked";
import { useTranslation } from "react-i18next";

// Document Generation Pattern: Dynamic markdown rendering with i18n support
/** Props for the viewer component */
export interface CnamMarkdownViewerProps {
  /** Cursus JSON data as returned by the API */
  data: Cursus | null;
  /**
   * Optional callback invoked when the component generates markdown and
   * creates blob URLs for downloads. The callback is called whenever the
   * generated markdown or blobs change, and with nulls on cleanup.
   */
  onGenerated?: (
    payload: {
      markdown: string;
      mdUrl: string | null;
      jsonUrl: string | null;
    } | null,
  ) => void;
}

/* Markdown generation is performed inside the component so we can
   access the i18n `t` function for translated section titles. */

/**
 * Render cursus markdown and download actions.
 * The component converts JSON -> markdown, generates blob URLs for
 * markdown and JSON files and revokes them on unmount.
 */
export default function CnamMarkdownViewer({
  data,
  onGenerated,
}: CnamMarkdownViewerProps) {
  const { t } = useTranslation();

  // Memoization Pattern: Expensive markdown generation cached and recalculated only on data/locale change
  const markdown = React.useMemo(() => {
    if (!data) return "";
    const lines: string[] = [];

    // Header
    lines.push(`# ${data.name || data.code}`);
    lines.push(`**${t("cursus.code")}**: ${data.code}`);
    if (data.audience_access)
      lines.push(`**${t("cursus.audience")}**: ${data.audience_access}`);
    if (data.objectives)
      lines.push(`**${t("cursus.objectives")}**:\n${data.objectives}`);
    lines.push("\n---\n");

    // Years & units
    for (const year of data.EU || []) {
      lines.push(`## ${year.year}`);
      for (const unit of year.units || []) {
        lines.push(`### ${unit.name}${unit.code ? ` (${unit.code})` : ""}`);
        if (unit.audience_access)
          lines.push(`**${t("cursus.audience")}**: ${unit.audience_access}`);
        if (unit.objectives)
          lines.push(`**${t("cursus.objectives")}**:\n${unit.objectives}`);
        if (unit.content)
          lines.push(`**${t("cursus.content")}**:\n${unit.content}`);
        if (unit.bibliography && unit.bibliography.length > 0) {
          lines.push(`**${t("cursus.bibliography")}**:`);
          for (const bib of unit.bibliography) {
            lines.push(
              `- ${bib.title}${bib.author ? ` — _${bib.author}_` : ""}`,
            );
          }
        }
        lines.push("");
      }
    }

    return lines.join("\n\n");
  }, [data, t]);

  // Resource Management Pattern: Blob-based downloads with cleanup on unmount
  // Keep refs so we can revoke on cleanup
  const mdBlobUrlRef = React.useRef<string | null>(null);
  const jsonBlobUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Revoke previous URLs to avoid leaking objects
    if (mdBlobUrlRef.current) URL.revokeObjectURL(mdBlobUrlRef.current);
    if (jsonBlobUrlRef.current) URL.revokeObjectURL(jsonBlobUrlRef.current);

    if (markdown) {
      const mdBlob = new Blob([markdown], { type: "text/markdown" });

      mdBlobUrlRef.current = URL.createObjectURL(mdBlob);
    } else {
      mdBlobUrlRef.current = null;
    }

    if (data) {
      const jsonBlob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      jsonBlobUrlRef.current = URL.createObjectURL(jsonBlob);
    } else {
      jsonBlobUrlRef.current = null;
    }

    // Notify parent about the generated markdown and blob URLs
    if (typeof onGenerated === "function") {
      onGenerated({
        markdown,
        mdUrl: mdBlobUrlRef.current,
        jsonUrl: jsonBlobUrlRef.current,
      });
    }

    return () => {
      // Revoke current URLs and notify parent we are cleaning up
      if (mdBlobUrlRef.current) URL.revokeObjectURL(mdBlobUrlRef.current);
      if (jsonBlobUrlRef.current) URL.revokeObjectURL(jsonBlobUrlRef.current);
      if (typeof onGenerated === "function") onGenerated(null);
    };
  }, [markdown, data, onGenerated]);

  // Convert markdown to HTML using marked. No sanitization is performed here
  // to preserve previous behaviour; consider adding DOMPurify before render.
  const html = React.useMemo(
    () => marked(markdown || ""),
    [markdown],
  ) as string;

  return (
    <div className="mt-4">
      {/* Render HTML generated from markdown */}
      <div
        className="prose max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Download links are intentionally not rendered inside this component.
          The parent page (`SearchBar`) receives the generated markdown and blob
          URLs via `onGenerated` and is responsible for rendering download
          actions. This keeps the component focused on rendering only. */}
    </div>
  );
}
