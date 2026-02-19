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
import { Trans, useTranslation } from "react-i18next";
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  DragEvent,
  ChangeEvent,
  ClipboardEvent,
} from "react";
import { Marked } from "marked";
import hljs from "highlight.js";
import { markedHighlight } from "marked-highlight";
import mermaid from "mermaid";
import markedMermaid from "@maddyguthridge/marked-mermaid";
import { Button } from "@heroui/button";
// Inline highlight.js CSS for HTML export (Vite raw import)
import hljsGithubCss from "highlight.js/styles/github.css?raw";

import HtmlToDocx from "../html-to-docx/";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";

export default function DocsPage() {
  const { t } = useTranslation();

  useEffect(() => {
    // render mermaid diagrams after the markdown HTML is inserted into the DOM
    mermaid.initialize({ startOnLoad: false });
    mermaid.run();
  }, []);

  const [loading, setLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);

  // Markdown content comes from drag & drop or file input
  const [markdown, setMarkdown] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [includePng, setIncludePng] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-run mermaid when the markdown changes
  useEffect(() => {
    try {
      mermaid.run();
    } catch (e) {
      /* ignore mermaid errors */
    }
  }, [markdown]);

  // Memoize rendered HTML so we can reuse it for the download button state
  const renderedHtml = useMemo(
    () => getHtmlFromMarkdown(markdown || ""),
    [markdown],
  );

  // Handlers for drag & drop + file input
  const readFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".md") && !file.type.includes("markdown")) {
      alert(t("markdown.unsupported_file"));

      return;
    }
    try {
      const text = await file.text();

      setMarkdown(text);
      setFileName(file.name);
    } catch (err) {
      console.error(err);
      alert(t("markdown.cannot_read_file"));
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0] ?? null;

    await readFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    await readFile(file);
    e.currentTarget.value = "";
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    // If clipboard contains files, prefer the first file
    const file = e.clipboardData?.files?.[0] ?? null;

    if (file) {
      await readFile(file);

      return;
    }

    // Otherwise accept plain text
    const text = e.clipboardData?.getData("text/plain") ?? "";

    if (text) {
      setMarkdown(text);
      setFileName(t("markdown.pasted_name"));
    }
  };

  const handleClear = () => {
    setMarkdown("");
    setFileName(null);
    // re-run mermaid to clear any previous diagrams
    try {
      mermaid.run();
    } catch (e) {
      /* ignore */
    }
  };

  // Convert SVG elements inside a cloned root to PNG (base64) and replace them in the clone.
  async function convertSvgsInClone(cloneRoot: HTMLElement) {
    const originalContainer = document.getElementById("markdown-content");

    if (!originalContainer)
      return { success: 0, failed: 0, failedDetails: [] as any[] };

    // Insert the clone off-screen but keep a layout width so mermaid can compute sizes.
    const wrapper = document.createElement("div");
    const containerRect = (originalContainer.getBoundingClientRect &&
      originalContainer.getBoundingClientRect()) || { width: 800 };

    wrapper.style.position = "absolute";
    wrapper.style.left = "-99999px"; // off-screen but still laid out
    wrapper.style.top = "0";
    wrapper.style.width = `${Math.max(100, Math.round(containerRect.width))}px`;
    wrapper.style.height = "auto";
    wrapper.style.overflow = "visible";
    wrapper.style.pointerEvents = "none";
    wrapper.style.visibility = "hidden";
    wrapper.appendChild(cloneRoot);
    document.body.appendChild(wrapper);

    // let mermaid render anything in the clone and wait for completion
    try {
      mermaid.run();
    } catch (e) {
      /* ignore */
    }

    // Wait for ALL mermaid diagrams to be rendered (data-processed="true")
    const mermaidDivs = cloneRoot.querySelectorAll("div.mermaid");

    if (mermaidDivs.length > 0) {
      let maxWaitAttempts = 100; // 5 seconds max (50ms × 100)
      let allProcessed = false;

      while (maxWaitAttempts > 0 && !allProcessed) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));

        const processedDivs = cloneRoot.querySelectorAll(
          'div.mermaid[data-processed="true"]',
        );

        console.log(
          `[convertSvgsInClone] Mermaid rendering progress: ${processedDivs.length}/${mermaidDivs.length} diagrams rendered`,
        );

        allProcessed = mermaidDivs.length === processedDivs.length;

        if (!allProcessed) {
          maxWaitAttempts--;
        }
      }

      if (!allProcessed) {
        const processedDivs = cloneRoot.querySelectorAll(
          'div.mermaid[data-processed="true"]',
        );

        console.warn(
          "[convertSvgsInClone] ⚠️ Timeout waiting for Mermaid diagrams:",
          {
            total: mermaidDivs.length,
            processed: processedDivs.length,
            remaining: mermaidDivs.length - processedDivs.length,
          },
        );

        // Log which diagrams didn't render
        const unprocessedDivs = cloneRoot.querySelectorAll(
          'div.mermaid:not([data-processed="true"])',
        );

        unprocessedDivs.forEach((div, idx) => {
          const content = (div.textContent || "").substring(0, 100);

          console.warn(
            `[convertSvgsInClone] Unprocessed diagram ${idx}: ${content}`,
          );
        });
      }
    } else {
      console.log("[convertSvgsInClone] No Mermaid diagrams found in clone");
    }

    const originalSvgs = Array.from(originalContainer.querySelectorAll("svg"));
    const clonedSvgs = Array.from(cloneRoot.querySelectorAll("svg"));
    const count = clonedSvgs.length;
    let success = 0;
    let failed = 0;
    const failedDetails: Array<{
      index: number;
      reason?: string;
      urls?: string[];
      serialized?: string;
    }> = [];

    const copyComputed = (source: Element, target: Element) => {
      try {
        const cs = window.getComputedStyle(source);
        let styleText = "";

        for (let i = 0; i < cs.length; i++) {
          const prop = cs[i];
          const val = cs.getPropertyValue(prop);
          const prio = cs.getPropertyPriority(prop);

          if (val) styleText += `${prop}:${val}${prio ? " !important" : ""};`;
        }
        const existing = target.getAttribute("style") || "";

        target.setAttribute("style", existing + styleText);
      } catch (err) {
        // ignore style-copy failures
      }
    };

    // inline external <image> references inside an SVG serialized string (if CORS allows)
    async function inlineExternalImages(serialized: string) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(serialized, "image/svg+xml");
      const images = Array.from(doc.querySelectorAll("image"));
      let inlined = 0;
      const failedUrls: string[] = [];

      for (const imgEl of images) {
        const href =
          imgEl.getAttribute("href") || imgEl.getAttribute("xlink:href");

        if (!href) continue;
        if (href.startsWith("data:") || href.startsWith("blob:")) continue;

        const url = (() => {
          try {
            return new URL(href, document.baseURI).href;
          } catch (e) {
            return href;
          }
        })();

        try {
          const resp = await fetch(url, { mode: "cors" });

          if (!resp.ok) throw new Error(`fetch ${resp.status}`);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((res, rej) => {
            const fr = new FileReader();

            fr.onload = () => res(String(fr.result));
            fr.onerror = () => rej(new Error("FileReader failed"));
            fr.readAsDataURL(blob);
          });

          imgEl.setAttribute("href", dataUrl);
          imgEl.setAttribute("xlink:href", dataUrl);
          inlined++;
        } catch (err) {
          failedUrls.push(url);
        }
      }

      return {
        serialized: new XMLSerializer().serializeToString(doc.documentElement),
        inlined,
        failedUrls,
      };
    }

    // attempt to render serialized SVG -> PNG and replace target element on success
    async function attemptRenderFromSerialized(
      serialized: string,
      targetEl: Element,
      cssWidth: number,
      cssHeight: number,
    ) {
      const tryLoadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const tmp = new Image();

          try {
            tmp.crossOrigin = "anonymous";
          } catch (e) {
            /* ignore */
          }
          tmp.width = cssWidth;
          tmp.height = cssHeight;
          tmp.onload = () => resolve(tmp);
          tmp.onerror = () => reject(new Error("SVG image load failed"));
          tmp.src = src;
        });

      const svgDataUrl =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
      let loadedImg: HTMLImageElement | null = null;
      let usedBlobUrl: string | null = null;

      try {
        loadedImg = await tryLoadImage(svgDataUrl);
      } catch (err) {
        const blob = new Blob([serialized], {
          type: "image/svg+xml;charset=utf-8",
        });
        const blobUrl = URL.createObjectURL(blob);

        usedBlobUrl = blobUrl;
        loadedImg = await tryLoadImage(blobUrl);
      }

      if (!loadedImg) throw new Error("Failed to load serialized SVG as image");

      const scale = 2;
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(cssWidth * scale));
      canvas.height = Math.max(1, Math.round(cssHeight * scale));
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas 2D not supported");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(loadedImg, 0, 0, cssWidth, cssHeight);

      if (usedBlobUrl) {
        try {
          URL.revokeObjectURL(usedBlobUrl);
        } catch (e) {
          /* ignore */
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      const imgEl = document.createElement("img");

      imgEl.src = dataUrl;
      imgEl.setAttribute("width", String(cssWidth));
      imgEl.setAttribute("height", String(cssHeight));
      targetEl.parentNode?.replaceChild(imgEl, targetEl);
    }

    for (let i = 0; i < count; i++) {
      const cloneSvg = clonedSvgs[i] as Element;
      const orig = originalSvgs[i] ?? null;

      try {
        // copy computed styles from original when available (helps keep visual parity)
        if (orig) {
          copyComputed(orig, cloneSvg);
          const sChildren = orig.querySelectorAll("*");
          const tChildren = cloneSvg.querySelectorAll("*");
          const len = Math.min(sChildren.length, tChildren.length);

          for (let j = 0; j < len; j++)
            copyComputed(sChildren[j] as Element, tChildren[j] as Element);
        }

        const clonedRect = (cloneSvg as Element).getBoundingClientRect();
        const origRect = orig
          ? (orig as Element).getBoundingClientRect()
          : null;
        const rect =
          clonedRect && clonedRect.width > 0 && clonedRect.height > 0
            ? clonedRect
            : (origRect ?? { width: 800, height: 600 });
        const cssWidth = Math.max(1, Math.round(rect.width)) || 800;
        const cssHeight = Math.max(1, Math.round(rect.height)) || 600;

        // first attempt: serialize and render directly
        const serialized = new XMLSerializer().serializeToString(cloneSvg);

        try {
          await attemptRenderFromSerialized(
            serialized,
            cloneSvg,
            cssWidth,
            cssHeight,
          );
          success++;
        } catch (err) {
          // if rendering fails, try to inline external images (if any) and retry
          const hasExternalImage =
            /<image[^>]+(?:href|xlink:href)=["'](https?:|\/\/|\.)/i.test(
              serialized,
            );

          if (hasExternalImage) {
            const {
              serialized: inlinedSerialized,
              inlined: inlinedCount,
              failedUrls,
            } = await inlineExternalImages(serialized);

            if (inlinedCount > 0) {
              // replace the SVG node in the clone with the inlined version so measurements persist
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(
                  inlinedSerialized,
                  "image/svg+xml",
                );
                const newSvg = doc.documentElement as Element;

                cloneSvg.parentNode?.replaceChild(newSvg, cloneSvg);
                // retry with the inlined svg
                await attemptRenderFromSerialized(
                  inlinedSerialized,
                  newSvg,
                  cssWidth,
                  cssHeight,
                );
                success++;
              } catch (err2) {
                failed++;
                failedDetails.push({
                  index: i,
                  reason: String(err2),
                  urls: failedUrls,
                  serialized,
                });
              }
            } else {
              failed++;
              failedDetails.push({
                index: i,
                reason: "no-inlined-resources",
                serialized,
              });
            }
          } else {
            // final fallback: record failure
            failed++;
            failedDetails.push({ index: i, reason: String(err), serialized });
          }
        }
      } catch (err) {
        // unexpected error per-SVG, keep going
        // eslint-disable-next-line no-console
        console.warn("SVG conversion unexpected error", err);
        failed++;
        failedDetails.push({ index: i, reason: String(err) });
      }

      setConversionProgress(Math.round(((i + 1) / Math.max(1, count)) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    // remove the temporary wrapper from the DOM
    try {
      wrapper.remove();
    } catch (e) {
      /* ignore */
    }

    setConversionProgress(null);

    return { success, failed, failedDetails };
  }

  /**
   * Prepare a DOM clone for export by rendering Mermaid diagrams.
   * Handles both direct rendering (wrapper) and SVG->PNG conversion cases.
   * @param clone The cloned DOM element to prepare
   * @param includePng Whether to convert SVGs to PNG
   * @param containerRect The bounding rect for sizing the off-screen wrapper
   * @returns The wrapper element (if created) that must be cleaned up after use
   */
  async function prepareCloneWithMermaidRendering(
    clone: HTMLElement,
    includePng: boolean,
    containerRect: DOMRect | { width: number },
  ): Promise<HTMLElement | null> {
    // If converting to PNG, convertSvgsInClone handles the wrapper internally
    if (includePng) {
      setConverting(true);
      await convertSvgsInClone(clone);
      setConverting(false);

      return null;
    }

    // Otherwise, create an off-screen wrapper for Mermaid rendering
    const wrapper = document.createElement("div");

    wrapper.style.position = "absolute";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "0";
    wrapper.style.width = `${Math.max(100, Math.round(containerRect.width))}px`;
    wrapper.style.visibility = "hidden";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Check if there are any mermaid diagrams to render
    const mermaidDivs = clone.querySelectorAll("div.mermaid");

    if (mermaidDivs.length > 0) {
      // Only wait for mermaid if there are actually diagrams to render
      try {
        mermaid.run();
      } catch (e) {
        /* ignore */
      }

      // Wait for ALL mermaid diagrams to be rendered (data-processed="true")
      let maxWaitAttempts = 100; // 5 seconds max (50ms × 100)
      let allProcessed = false;

      while (maxWaitAttempts > 0 && !allProcessed) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));

        const processedDivs = clone.querySelectorAll(
          'div.mermaid[data-processed="true"]',
        );

        console.log(
          `[prepareCloneWithMermaidRendering] Mermaid rendering progress: ${processedDivs.length}/${mermaidDivs.length} diagrams rendered`,
        );

        allProcessed = mermaidDivs.length === processedDivs.length;

        if (!allProcessed) {
          maxWaitAttempts--;
        }
      }

      if (!allProcessed) {
        const processedDivs = clone.querySelectorAll(
          'div.mermaid[data-processed="true"]',
        );

        console.warn(
          "[prepareCloneWithMermaidRendering] ⚠️ Timeout waiting for Mermaid diagrams:",
          {
            total: mermaidDivs.length,
            processed: processedDivs.length,
            remaining: mermaidDivs.length - processedDivs.length,
          },
        );

        // Log which diagrams didn't render
        const unprocessedDivs = clone.querySelectorAll(
          'div.mermaid:not([data-processed="true"])',
        );

        unprocessedDivs.forEach((div, idx) => {
          const content = (div.textContent || "").substring(0, 100);

          console.warn(
            `[prepareCloneWithMermaidRendering] Unprocessed diagram ${idx}: ${content}`,
          );
        });
      }
    } else {
      console.log(
        "[prepareCloneWithMermaidRendering] No Mermaid diagrams found, skipping render wait",
      );
    }

    return wrapper;
  }

  // Download the currently rendered `#markdown-content` into a minimal HTML file
  async function handleDownload() {
    if (!renderedHtml) return;
    setLoading(true);
    let wrapper: HTMLElement | null = null;

    try {
      const container = document.getElementById("markdown-content");

      if (!container) throw new Error("Markdown content not found");

      // clone DOM so we can mutate it safely without touching the live page
      const clone = container.cloneNode(true) as HTMLElement;

      // Prepare the clone: handle Mermaid rendering and optional SVG->PNG conversion
      const containerRect = container.getBoundingClientRect
        ? container.getBoundingClientRect()
        : { width: 800 };

      wrapper = await prepareCloneWithMermaidRendering(
        clone,
        includePng,
        containerRect,
      );

      if (includePng) {
        // Check if there were conversion failures
        const failedDivs = clone.querySelectorAll(
          'div.mermaid[data-failed="true"]',
        );

        if (failedDivs.length > 0) {
          // eslint-disable-next-line no-console
          console.warn("SVG->PNG conversion had failures");
          alert(
            `${t("markdown.png_conversion_error_cors")} (${failedDivs.length} diagrams failed)`,
          );
        }
      }

      const bodyHtml = clone.innerHTML;

      const doc = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Exported markdown</title>
  <style>${hljsGithubCss}</style>
</head>
<body style="font-family: sans-serif;">
${bodyHtml}
</body>
</html>`;

      const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `cnam-markdown.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert(String(err));
    } finally {
      try {
        if (wrapper) wrapper.remove();
      } catch (e) {
        /* ignore */
      }
      setLoading(false);
      setConverting(false);
      setConversionProgress(null);
    }
  }

  // Generate a DOCX from the rendered HTML using @turbodocx/html-to-docx
  async function handleDownloadDocx() {
    if (!renderedHtml) return;
    setDocxLoading(true);
    let wrapper: HTMLElement | null = null;

    try {
      const container = document.getElementById("markdown-content");

      if (!container) throw new Error("Markdown content not found");

      // clone DOM so we can mutate it safely
      const clone = container.cloneNode(true) as HTMLElement;

      // Prepare the clone: handle Mermaid rendering and optional SVG->PNG conversion
      const containerRect = container.getBoundingClientRect
        ? container.getBoundingClientRect()
        : { width: 800 };

      wrapper = await prepareCloneWithMermaidRendering(
        clone,
        includePng,
        containerRect,
      );

      const htmlWithImages = `<!doctype html>
        <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Exported markdown</title>
          <style>${hljsGithubCss}</style>
        </head>
        <body style="font-family: sans-serif;">
        ${clone.innerHTML}
        </body>
        </html>`;

      // Fix table structure: Remove text nodes from table rows that break html-to-docx parsing
      // This happens when clone.innerHTML includes whitespace/newlines between <tr> and <td>
      const cleanedHtml = htmlWithImages
        .replace(/<tr[^>]*>[\s\n]+(?=<t[dh])/g, (match) => {
          // Replace <tr...> followed by whitespace with <tr> (no whitespace)
          return match.replace(/[\s\n]+$/, "");
        })
        .replace(
          /(<\/t[dh]>)[\s\n]+(?=<t[dh]|<\/tr>)/g,
          "$1", // Remove whitespace between cells or before </tr>
        )
        .replace(
          /(<\/tbody>)[\s\n]+(?=<\/table>)/g,
          "$1", // Remove whitespace before </table>
        )
        .replace(
          /(<tbody>|<thead>|<tfoot>)[\s\n]+(?=<tr)/g,
          "$1", // Remove whitespace after tbody/thead/tfoot opening tags
        );

      // Instrumentation: print the full HTML
      console.log(
        "[handleDownloadDocx] Full cleaned HTML content:\n",
        cleanedHtml,
      );

      const docx = await HtmlToDocx(
        cleanedHtml,
        null,
        {
          imageProcessing: {
            verboseLogging: true,
            svgHandling: "native",
            suppressSharpWarning: false,
            svgSanitization: false, // allow SVGs through without sanitization (note: this can be a security risk if the HTML content is not trusted)
          },
        },
        null,
      );

      // normalize `docx` to a Blob-compatible binary for the browser
      const blob = new Blob([docx as any], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `${fileName ? fileName.replace(/\.md$/i, "") : "cnam-markdown"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert(`${t("markdown.docx_error")} — ${String(err)}`);
    } finally {
      setDocxLoading(false);
      try {
        if (wrapper) wrapper.remove();
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Convert markdown -> HTML (hoisted function so it can be used earlier)
  function getHtmlFromMarkdown(markdown: string) {
    const marked = new Marked();

    marked.use(markedMermaid());
    marked.use(
      markedHighlight({
        emptyLangClass: "hljs",
        langPrefix: "hljs language-",
        highlight(code, lang, _info) {
          const language = hljs.getLanguage(lang) ? lang : "plaintext";

          // don't highlight mermaid code blocks, as they are processed separately by marked-mermaid
          if (language === "mermaid") {
            return code;
          }

          return hljs.highlight(code, { language }).value;
        },
      }),
    );
    let html = marked.parse(markdown) as string;

    // If marked-highlight left mermaid blocks as <pre><code class="language-mermaid">...</code></pre>,
    // convert them to `<div class="mermaid">...</div>` so mermaid.run() can render them.
    html = html.replace(
      /<pre[^>]*>\s*<code[^>]*language-mermaid[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g,
      (_m, code) => {
        const decoded = code
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");

        return `<div class="mermaid">${decoded}</div>`;
      },
    );

    //return DOMPurify.sanitize(html);
    return html;
  }

  return (
    <DefaultLayout>
      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center justify-center">
          <h1 className={title()}>
            <Trans t={t}>markdown-util</Trans>
          </h1>
          <div className="mt-4 flex items-start gap-4 w-xl md:w-3xl lg:w-7xl">
            <div className="w-xl md:w-3xl lg:w-7xl text-left">
              <div
                aria-label={t("markdown.drop_or_click")}
                className={`mb-4 rounded border-2 border-dashed p-6 cursor-pointer ${isDragging ? "border-primary bg-slate-50" : "border-gray-200"}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onPaste={handlePaste}
              >
                <input
                  ref={fileInputRef}
                  accept=".md,text/markdown"
                  className="hidden"
                  type="file"
                  onChange={handleFileChange}
                />
                <p className="text-sm">
                  {fileName
                    ? t("markdown.file_loaded", { name: fileName })
                    : t("markdown.drop_or_click")}
                </p>
              </div>

              <div
                dangerouslySetInnerHTML={{
                  __html:
                    renderedHtml ||
                    `<p class="text-muted">${t("markdown.no_content")}</p>`,
                }}
                id="markdown-content"
              />
            </div>

            <div className="shrink-0 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <label
                className="inline-flex items-center gap-2 text-sm"
                title={t("markdown.include_png_tooltip")}
              >
                <input
                  checked={includePng}
                  className="checkbox"
                  disabled={converting}
                  type="checkbox"
                  onChange={(e) => setIncludePng(e.currentTarget.checked)}
                />
                <span>{t("markdown.include_png")}</span>
              </label>

              {converting && (
                <div className="text-sm text-muted ml-2">
                  {t("markdown.png_conversion_in_progress")}
                  {conversionProgress ? ` (${conversionProgress}%)` : ""}
                </div>
              )}

              <Button
                aria-disabled={loading || converting || !renderedHtml}
                className="btn btn-primary"
                disabled={loading || converting || !renderedHtml}
                variant="bordered"
                onPress={handleClear}
              >
                {t("markdown.clear")}
              </Button>

              <Button
                aria-disabled={
                  docxLoading || loading || converting || !renderedHtml
                }
                className="btn btn-primary"
                disabled={docxLoading || loading || converting || !renderedHtml}
                variant="bordered"
                onPress={handleDownloadDocx}
              >
                {docxLoading ? t("download_docx") + "..." : t("download_docx")}
              </Button>

              <Button
                aria-disabled={loading || converting || !renderedHtml}
                className="btn btn-primary"
                disabled={loading || converting || !renderedHtml}
                variant="bordered"
                onPress={handleDownload}
              >
                {loading ? t("download_markdown") + "..." : t("download_html")}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
