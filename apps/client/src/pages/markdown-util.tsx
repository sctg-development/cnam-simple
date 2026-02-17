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

  // Markdown content comes from drag & drop or file input
  const [markdown, setMarkdown] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  // Download the currently rendered `#markdown-content` into a minimal HTML file
  async function handleDownload() {
    if (!renderedHtml) return;
    setLoading(true);
    try {
      // Ensure mermaid diagrams are rendered in DOM before capture
      try {
        mermaid.run();
      } catch (e) {
        /* ignore mermaid errors on export */
      }

      const container = document.getElementById("markdown-content");

      if (!container) throw new Error("Markdown content not found");

      const bodyHtml = container.innerHTML;

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
      setLoading(false);
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
          <div className="mt-4 flex items-start gap-4">
            <div className="w-7xl text-left">
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
              <Button
                aria-disabled={loading || !renderedHtml}
                className="btn btn-primary"
                disabled={loading || !renderedHtml}
                variant="bordered"
                onPress={handleClear}
              >
                {t("markdown.clear")}
              </Button>

              <Button
                aria-disabled={loading || !renderedHtml}
                className="btn btn-primary"
                disabled={loading || !renderedHtml}
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
