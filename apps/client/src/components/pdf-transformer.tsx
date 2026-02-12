import { useState } from "react";
import { useTranslation } from "react-i18next";
// Security Pattern: Input sanitization against XSS vulnerabilities
import DOMPurify from "dompurify";
import type { Cursus } from "../types";
import printdfInit from '@/printpdf/printpdf.js';
import {
    Pdf_HtmlToDocument,
    Pdf_BytesToDocument,
} from '@/printpdf/printpdf.js';
import { Button } from "@heroui/button";
import { getFonts } from "@/printpdf/fonts";


type Props = {
    data: Cursus | null;
    fileName?: string;
};

export default function PdfTransformer({ data, fileName }: Props) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Error Handling & State Management: Explicit state validation and error tracking
    async function handleDownload() {
        if (!confirm("The PDF generation is under heavy development and currently does not work. Running it is just for testing purposes, but it will fail. Do you want to proceed?")) {
            setError("PDF generation cancelled by user.");
            return;
        }
        if (!data) return;
        setError(null);
        setLoading(true);
        const fonts = getFonts(); // Load default fonts (returns an object with font names as keys and base64 strings as values)
        try {
            // Generate HTML directly from the JSON structure (no markdown -> HTML roundtrip)
            const html = generateHtml(data, t);

            // Data Validation & Sanitization: Whitelist-based HTML sanitization
            const safeHtml = DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['html', 'head', 'body', 'title', 'h1', 'h2', 'h3', 'h4', 'p', 'div', 'span', 'strong', 'em', 'ul', 'li', 'section', 'article'],
                ALLOWED_ATTR: ['id', 'class', 'style'],
                WHOLE_DOCUMENT: true,
                FORCE_BODY: false
            });

            console.log("HTML before DOMPurify (first 500 chars):", html.substring(0, 500));
            console.log("HTML after DOMPurify (first 500 chars):", safeHtml.substring(0, 500));

            await printdfInit(); // Initialize the module (required for wasm to load properly)

            const generationOptions = {
                pageWidth: 210,
                pageHeight: 297,
                imageOptimization: null, // Changed from imageCompression to imageOptimization
                fontEmbedding: true
            };

            const input = {
                title: data.name || data.code || "Cursus PDF",
                html: `${safeHtml}`,
                images: {},
                fonts: fonts,
                options: generationOptions
            };
            
            console.log("Input structure - Fonts count:", Object.keys(fonts).length, "HTML length:", safeHtml.length);
            
            // Convert HTML into a document and then into bytes (synchronous variants are used here)
            let docJson: string;
            try {
                docJson = await Pdf_HtmlToDocument(JSON.stringify(input));
            } catch (wasmError: any) {
                console.error("WASM Error during HTML to Document conversion:", wasmError);
                throw new Error(`PDF conversion failed: ${wasmError?.message || String(wasmError)}`);
            }
            
            console.log("Generated document JSON:", docJson);
            
            // Parse the response
            let docObj: any;
            try {
                docObj = JSON.parse(docJson);
            } catch (jsonErr) {
                throw new Error(`Failed to parse document JSON: ${jsonErr}`);
            }
            
            if (docObj.status !== 0) {
                throw new Error(`PDF generation failed with status ${docObj.status}: ${JSON.stringify(docObj.data)}`);
            }
            
            console.log("Document pages count:", docObj.data?.doc?.pages?.length);
            console.log("Document fonts count:", Object.keys(docObj.data?.doc?.resources?.fonts || {}).length);
            console.log("First page ops count:", docObj.data?.doc?.pages?.[0]?.ops?.length);
            console.log("Warnings:", docObj.data?.warnings || []);
            
            let base64: string;
            try {
                base64 = await Pdf_BytesToDocument(docJson);
            } catch (bytesError: any) {
                console.error("WASM Error during bytes conversion:", bytesError);
                throw new Error(`PDF bytes conversion failed: ${bytesError?.message || String(bytesError)}`);
            }

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
            console.error("Complete error stack:", err);
            const errorMsg = err?.message || String(err);
            setError(errorMsg);
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
            {error ? (
                <div className="text-red-600 mt-2 p-3 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-sm">Error:</p>
                    <p className="text-sm">{error}</p>
                </div>
            ) : null}
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
    parts.push(`<!DOCTYPE html>`);
    parts.push(`<html lang="en">`);
    parts.push(`<head>`);
    parts.push(`<meta charset="UTF-8">`);
    parts.push(`<title>${escapeHtml(data.name || data.code || "Cursus PDF")}</title>`);
    parts.push(`</head>`);
    parts.push(`<body>`);
    parts.push(`<div class="document-header"><h1>${escapeHtml(data.name || data.code)}</h1></div>`);
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
    parts.push(`</body>`);
    parts.push(`</html>`);
    return parts.join("\n");
}