import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";
import { Trans, useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { marked } from "marked";

import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";
import DefaultLayout from "@/layouts/default";

function SearchBar() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const mdRef = useRef<HTMLDivElement | null>(null);
  const mdBlobUrlRef = useRef<string | null>(null);
  const jsonBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (mdBlobUrlRef.current) URL.revokeObjectURL(mdBlobUrlRef.current);
      if (jsonBlobUrlRef.current) URL.revokeObjectURL(jsonBlobUrlRef.current);
    };
  }, []);

  const generateMarkdown = (data: any) => {
    if (!data) return "";
    const lines: string[] = [];
    lines.push(`# ${data.name || data.code}`);
    lines.push(`**Code**: ${data.code}`);
    if (data.audience_access) lines.push(`**Audience**: ${data.audience_access}`);
    if (data.objectives) lines.push(`**Objectives**:\n${data.objectives}`);
    lines.push("\n---\n");

    for (const year of data.EU || []) {
      lines.push(`## ${year.year}`);
      for (const unit of year.units || []) {
        lines.push(`### ${unit.name}${unit.code ? ` (${unit.code})` : ""}`);
        if (unit.audience_access) lines.push(`**Audience**: ${unit.audience_access}`);
        if (unit.objectives) lines.push(`**Objectives**:\n${unit.objectives}`);
        if (unit.content) lines.push(`**Content**:\n${unit.content}`);
        if (unit.bibliography && unit.bibliography.length > 0) {
          lines.push("**Bibliography:**");
          for (const bib of unit.bibliography) {
            lines.push(`- ${bib.title}${bib.author ? ` — _${bib.author}_` : ""}`);
          }
        }
        lines.push("");
      }
    }

    return lines.join("\n\n");
  };

  const downloadUrl = (content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    return url;
  };

  const handleSearch = async () => {
    setError(null);
    setMarkdown(null);

    const trimmed = code.trim();
    if (!trimmed) return setError(t("search_error"));

    setLoading(true);
    try {
      const base = (import.meta.env as any).CLOUDFLARE_BACKEND || "";
      const res = await fetch(`${base}/api/cursus/${encodeURIComponent(trimmed)}?enrich=true`);
      const json = await res.json();
      if (!json || !json.success || !json.data) {
        setError(t("no_results"));
        setLoading(false);
        return;
      }

      const md = generateMarkdown(json.data);
      setMarkdown(md);

      // prepare downloads
      if (mdBlobUrlRef.current) URL.revokeObjectURL(mdBlobUrlRef.current);
      if (jsonBlobUrlRef.current) URL.revokeObjectURL(jsonBlobUrlRef.current);
      mdBlobUrlRef.current = downloadUrl(md, "text/markdown");
      jsonBlobUrlRef.current = downloadUrl(JSON.stringify(json.data, null, 2), "application/json");
    } catch (err: any) {
      setError(t("search_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mt-6">
      <div className="flex gap-2 w-full items-center">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("search_placeholder")}
          className="px-3 py-2 rounded-md border w-64"
        />
        <button
          onClick={handleSearch}
          className={buttonStyles({ variant: "shadow", radius: "full" })}
        >
          {loading ? t("search_loading") : t("search_button")}
        </button>
      </div>

      <div className="mt-4">
        {error && <div className="text-red-500">{error}</div>}

        {markdown && (
          <div className="mt-4">
            <div ref={mdRef} className="prose max-w-none" dangerouslySetInnerHTML={{ __html: marked(markdown) }} />

            <div className="mt-4 flex gap-2">
              {mdBlobUrlRef.current && (
                <a href={mdBlobUrlRef.current} download={`${code}.md`} className={buttonStyles({ variant: "bordered" })}>
                  {t("download_markdown")}
                </a>
              )}

              {jsonBlobUrlRef.current && (
                <a href={jsonBlobUrlRef.current} download={`${code}.json`} className={buttonStyles({ variant: "bordered" })}>
                  {t("download_json")}
                </a>
              )}
            </div>
          </div>
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
          <span className={title()}>{t("make")}&nbsp;</span>
          <span className={title({ color: "violet" })}>
            {t("beautiful")}&nbsp;
          </span>
          <br />
          <span className={title()}>
            <Trans i18nKey="websites-regardless-of-your-design-experience" />
          </span>
          <div className={subtitle({ class: "mt-4" })}>
            <Trans i18nKey="beautiful-fast-and-modern-react-ui-library" />
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full items-center md:items-start">
          <div className="flex gap-3">
            <Link
              isExternal
              className={buttonStyles({
                color: "primary",
                radius: "full",
                variant: "shadow",
              })}
              href={siteConfig().links.docs}
            >
              <Trans i18nKey="documentation" />
            </Link>
            <Link
              isExternal
              className={buttonStyles({ variant: "bordered", radius: "full" })}
              href={siteConfig().links.github}
            >
              <GithubIcon size={20} />
              GitHub
            </Link>
          </div>

          {/* Search UI */}
          <SearchBar />
        </div>
      </section>
    </DefaultLayout>
  );
}
