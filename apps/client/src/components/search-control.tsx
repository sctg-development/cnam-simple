/**
 * Reusable SearchControl component
 * - Provides a search input with the same style as the template
 * - Calls `onSearch(code)` when the user presses Enter or clicks the button
 */

import React from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useTranslation } from "react-i18next";
import { SearchIcon } from "@/components/icons";

export interface SearchControlProps {
  initialValue?: string;
  onSearch?: (code: string) => void;
  /** Show loading state on the button */
  isLoading?: boolean;
  /** Tailwind class applied to the input wrapper to control width (e.g., 'w-64') */
  inputWidthClass?: string;
}

export default function SearchControl({ initialValue = "", onSearch, isLoading = false, inputWidthClass = "w-64" }: SearchControlProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(initialValue);

  const invokeSearch = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (typeof onSearch === "function") onSearch(trimmed);
  };

  return (
    <div className="flex gap-2 items-center">
      <Input
        aria-label={t("search")}
        classNames={{
          // apply width class to the input wrapper so the visual size can be
          // controlled by the parent (e.g., Navbar passes a larger width)
          inputWrapper: `bg-default-100 ${inputWidthClass}`,
          input: "text-sm",
        }}
        labelPlacement="outside"
        placeholder={`${t("search_placeholder")}`}
        startContent={<SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") invokeSearch(value);
        }}
      />

      <Button
        onPress={() => invokeSearch(value)}
      >
        {isLoading ? t("search_loading") : t("search_button")}
      </Button>
    </div>
  );
}
