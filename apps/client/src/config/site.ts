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
export type SiteConfig = typeof siteConfig;
import i18next from "../i18n";

// Configuration Object Pattern: Centralized application settings with type safety
export const siteConfig = () => ({
  needCookieConsent: true, // Set to false if you don't need cookie consent
  name: i18next.t("vite-heroui"),
  description: i18next.t("cnam-index-title"),
  navItems: [
    {
      label: i18next.t("home"),
      href: "/",
    },
    {
      label: i18next.t("docs"),
      href: "/docs",
    },
    // {
    //   label: i18next.t("pricing"),
    //   href: "/pricing",
    // },
    {
      label: i18next.t("markdown-util"),
      href: "/markdown-util",
    },
    // {
    //   label: i18next.t("about"),
    //   href: "/about",
    // },
  ],
  navMenuItems: [
    {
      label: i18next.t("profile"),
      href: "/profile",
    },
    {
      label: i18next.t("dashboard"),
      href: "/dashboard",
    },
    {
      label: i18next.t("projects"),
      href: "/projects",
    },
    {
      label: i18next.t("team"),
      href: "/team",
    },
    {
      label: i18next.t("calendar"),
      href: "/calendar",
    },
    {
      label: i18next.t("settings"),
      href: "/settings",
    },
    {
      label: i18next.t("help-and-feedback"),
      href: "/help-feedback",
    },
    {
      label: i18next.t("logout"),
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/sctg-development/cnam-simple",
    // twitter: "https://twitter.com/hero_ui",
    // docs: "https://heroui.com",
    // discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://github.com/sponsors/sctg-development",
    template:
      "https://github.com/sctg-development/vite-react-heroui-auth0-template",
  },
});
