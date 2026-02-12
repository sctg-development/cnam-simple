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
// Component Dependency & Composition: Modular UI component assembly
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { LinkUniversal } from "./link-universal";
import SearchControl from "@/components/search-control";
import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/navbar";
import { link as linkStyles } from "@heroui/theme";
import { clsx } from "@heroui/shared-utils";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { I18nIcon, LanguageSwitch } from "./language-switch";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  GithubIcon,
  HeartFilledIcon,
} from "@/components/icons";
import { Logo } from "@/components/icons";
import { availableLanguages } from "@/i18n";

// Callback-based Event Handling: Callback pattern for parent-child communication
export const Navbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const searchInput = (
    <SearchControl
      inputWidthClass="w-96"
      onSearch={(c) => {
        try {
          const q = encodeURIComponent(c);
          // Use react-router navigation to avoid full page reloads / loops
          navigate(`/?q=${q}`);
        } catch (e) {
          // Fallback to full navigation for older browsers
          window.location.href = `/?q=${encodeURIComponent(c)}`;
        }
      }}
    />
  );

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <Link
            className="flex justify-start items-center gap-1"
            color="foreground"
            href="/"
          >
            <Logo />
            <p className="font-bold text-inherit">ACME</p>
          </Link>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig().navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Link
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </Link>
            </NavbarItem>
          ))}
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <LinkUniversal isExternal href={siteConfig().links.github} title={t("github")} isInternet>
            <GithubIcon className="text-default-500" />
          </LinkUniversal>
          <ThemeSwitch />
          <LanguageSwitch
            availableLanguages={availableLanguages}
            icon={I18nIcon}
          />
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
        <NavbarItem className="hidden md:flex">
          <Button
            isExternal
            as={Link}
            className="text-sm font-normal text-default-600 bg-default-100"
            href={siteConfig().links.sponsor}
            startContent={<HeartFilledIcon className="text-danger" />}
            variant="flat"
          >
            <Trans i18nKey="sponsor" />
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link isExternal href={siteConfig().links.github}>
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <LanguageSwitch
          availableLanguages={availableLanguages}
          icon={I18nIcon}
        />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        {searchInput}
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig().navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig().navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
