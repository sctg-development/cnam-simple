import { useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import type { Cursus } from "../types";
import printdfInit from '@/printpdf/printpdf.js';
import {
    Pdf_HtmlToDocument,
    Pdf_BytesToDocument,
} from '@/printpdf/printpdf.js';
import { Button } from "@heroui/button";
type Props = {
  data: Cursus | null;
  fileName?: string;
};

export default function PdfTransformer({ data, fileName }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!data) return;
    setError(null);
    setLoading(true);
    try {
      // Generate HTML directly from the JSON structure (no markdown -> HTML roundtrip)
      const html = generateHtml(data, t);
      const safeHtml = DOMPurify.sanitize(html);

      // Dynamically import the wasm-based printpdf package from the app's `printpdf/` folder
      // We expect `printpdf.js` and `printpdf_bg.wasm` to be available under `@@/printpdf/` at runtime
      printdfInit(); // Initialize the module (required for wasm to load properly)

      // Convert HTML into a document and then into bytes (synchronous variants are used here)
      const docJson = await Pdf_HtmlToDocument(safeHtml);
      const base64 = await Pdf_BytesToDocument(docJson);

      // Convert base64 to bytes
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `${data.code || "cursus"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        className="btn btn-primary"
        variant="bordered"
        onPress={handleDownload}
        disabled={loading || !data}
        aria-disabled={loading || !data}
      >
        {loading ? t("download_pdf") + "..." : t("download_pdf")}
      </Button>
      {error ? <div className="text-red-600 mt-2">{error}</div> : null}
    </div>
  );
}

function escapeHtml(s?: string) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateHtml(data: Cursus, t: (k: string) => string) {
  const parts: string[] = [];

  parts.push(`<header><h1>${escapeHtml(data.name || data.code)}</h1></header>`);

  if (data.code) {
    parts.push(`<p><strong>${escapeHtml(t("cursus.code"))}:</strong> ${escapeHtml(data.code)}</p>`);
  }
  if ((data as any).audience_access) {
    parts.push(`<p><strong>${escapeHtml(t("cursus.audience"))}:</strong> ${escapeHtml((data as any).audience_access)}</p>`);
  }
  if ((data as any).objectives) {
    parts.push(`<section><h2>${escapeHtml(t("cursus.objectives"))}</h2><p>${escapeHtml((data as any).objectives)}</p></section>`);
  }

  // Iterate Years in the Cursus (property: EU)
  if (Array.isArray(data.EU) && data.EU.length) {
    parts.push(`<section><h2>Units</h2>`);
    for (const y of data.EU) {
      parts.push(`<article><h3>${escapeHtml(String(y.year))}</h3>`);
      if (Array.isArray(y.units)) {
        for (const u of y.units) {
          parts.push(`<div class="unit"><h4>${escapeHtml(u.name || u.code || "")}</h4>`);
          if (u.code) parts.push(`<p><strong>Code:</strong> ${escapeHtml(u.code)}</p>`);
          if (u.audience_access) parts.push(`<p><strong>${escapeHtml(t("cursus.audience"))}:</strong> ${escapeHtml(u.audience_access)}</p>`);
          if (u.objectives) parts.push(`<p><strong>${escapeHtml(t("cursus.objectives"))}:</strong> ${escapeHtml(u.objectives)}</p>`);
          if (u.content) parts.push(`<div>${escapeHtml(u.content)}</div>`);
          if (u.bibliography && u.bibliography.length) {
            parts.push(`<div><strong>${escapeHtml(t("cursus.bibliography"))}:</strong><ul>`);
            for (const b of u.bibliography) {
              parts.push(`<li>${escapeHtml(b.title)}${b.author ? ` — ${escapeHtml(b.author)}` : ""}</li>`);
            }
            parts.push(`</ul></div>`);
          }
          parts.push(`</div>`);
        }
      }
      parts.push(`</article>`);
    }
    parts.push(`</section>`);
  }

  return parts.join("\n");
}