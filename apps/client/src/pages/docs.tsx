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
import { useTranslation } from "react-i18next";

import { title, subtitle } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

export default function DocsPage() {
  const { t } = useTranslation();

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-3xl text-left">
          <h1 className={title()}>{t("docs.title")}</h1>

          <div className={subtitle({ class: "mt-4" })}>
            <h2 className="font-semibold mt-2">{t("docs.overview.title")}</h2>
            <p className="mt-2">{t("docs.overview.p")}</p>

            {/* ARIA Alert Pattern: Accessible disclaimer for screen readers */}
            <div role="alert" className="mt-4 p-4 bg-yellow-50 border-l-4 border-amber-400 rounded">
              <p className="font-semibold">{t("docs.warning.title")}</p>
              <p className="mt-1 text-sm">{t("docs.warning.p")}</p>
            </div>

            <h2 className="font-semibold mt-4">{t("docs.goals.title")}</h2>
            <ul className="list-disc pl-6 mt-2">
              <li>{t("docs.goals.item1")}</li>
              <li>{t("docs.goals.item2")}</li>
              <li>{t("docs.goals.item3")}</li>
              <li>{t("docs.goals.item4")}</li>
            </ul>

            <h2 className="font-semibold mt-4">{t("docs.architecture.title")}</h2>
            <p className="mt-2">{t("docs.architecture.p")}</p>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h3 className="font-medium">{t("docs.frontend.title")}</h3>
                <p className="mt-1">{t("docs.frontend.p")}</p>
              </div>

              <div>
                <h3 className="font-medium">{t("docs.backend.title")}</h3>
                <p className="mt-1">{t("docs.backend.p")}</p>
              </div>
            </div>

            <h2 className="font-semibold mt-4">{t("docs.install.title")}</h2>
            <p className="mt-2">{t("docs.install.p")}</p>

            <h2 className="font-semibold mt-4">{t("docs.tests.title")}</h2>
            <p className="mt-2">{t("docs.tests.p")}</p>

            <h2 className="font-semibold mt-4">{t("docs.api.title")}</h2>
            <p className="mt-2">{t("docs.api.p")}</p>

            <h2 className="font-semibold mt-4">{t("docs.license.title")}</h2>
            <p className="mt-2">{t("docs.license.p")}</p>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
