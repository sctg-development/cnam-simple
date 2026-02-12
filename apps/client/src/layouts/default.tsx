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
import type React from "react";

// Layout Composition: Wrapper component providing structural consistency
import { LinkUniversal } from "../components/link-universal";
import { siteConfig } from "../config/site";
import { Trans, useTranslation } from "react-i18next";

import { Navbar } from "@/components/navbar";
export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Template Method Pattern: Consistent layout structure with configurable content area
  const { t } = useTranslation();

  return (
    <div className="relative flex flex-col h-screen">
      {/* Navigation Component: Reusable header UI */}
      <Navbar />
      {/* Main Content Area: Dynamic children composition */}
      <main className="container mx-auto max-w-7xl px-6 grow pt-16">
        {children}
      </main>
      {/* Footer: Consistent branding and navigation */}
      <footer className="w-full flex items-center justify-center py-3">
        <LinkUniversal
          isExternal
          isInternet
          className="flex items-center gap-1 text-current"
          href={siteConfig().links.template}
          title={t("heroui-com-homepage")}
        >
          <span className="text-default-600">
            <Trans ns="base">powered-by</Trans>
          </span>
          <p className="text-primary">SCTG Template</p>
        </LinkUniversal>
      </footer>
    </div>
  );
}
