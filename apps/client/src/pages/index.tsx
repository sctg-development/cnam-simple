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

import { Link } from "@heroui/link";
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
    if (data.audience_access)
      lines.push(`**Audience**: ${data.audience_access}`);
    if (data.objectives) lines.push(`**Objectives**:\n${data.objectives}`);
    lines.push("\n---\n");

    for (const year of data.EU || []) {
      lines.push(`## ${year.year}`);
      for (const unit of year.units || []) {
        lines.push(`### ${unit.name}${unit.code ? ` (${unit.code})` : ""}`);
        if (unit.audience_access)
          lines.push(`**Audience**: ${unit.audience_access}`);
        if (unit.objectives) lines.push(`**Objectives**:\n${unit.objectives}`);
        if (unit.content) lines.push(`**Content**:\n${unit.content}`);
        if (unit.bibliography && unit.bibliography.length > 0) {
          lines.push("**Bibliography:**");
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
      const res = await fetch(
        `${base}/api/cursus/${encodeURIComponent(trimmed)}?enrich=true`,
      );
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
      jsonBlobUrlRef.current = downloadUrl(
        JSON.stringify(json.data, null, 2),
        "application/json",
      );
    } catch (err: any) {
      setError(t("search_error"));
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mt-6">
      <div className="flex gap-2 w-full items-center">
        <input
          className="px-3 py-2 rounded-md border w-64"
          placeholder={t("search_placeholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className={buttonStyles({ variant: "shadow", radius: "full" })}
          onClick={handleSearch}
        >
          {loading ? t("search_loading") : t("search_button")}
        </button>
      </div>

      <div className="mt-4">
        {error && <div className="text-red-500">{error}</div>}

        {markdown && (
          <div className="mt-4">
            <div
              dangerouslySetInnerHTML={{ __html: marked(markdown) }}
              ref={mdRef}
              className="prose max-w-none"
            />

            <div className="mt-4 flex gap-2">
              {mdBlobUrlRef.current && (
                <a
                  className={buttonStyles({ variant: "bordered" })}
                  download={`${code}.md`}
                  href={mdBlobUrlRef.current}
                >
                  {t("download_markdown")}
                </a>
              )}

              {jsonBlobUrlRef.current && (
                <a
                  className={buttonStyles({ variant: "bordered" })}
                  download={`${code}.json`}
                  href={jsonBlobUrlRef.current}
                >
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
