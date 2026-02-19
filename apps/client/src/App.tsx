import type { NavigateOptions } from "react-router-dom";

import { Route, Routes } from "react-router-dom";

// Component Composition & Separation of Concerns: Layered provider hierarchy

import { useHref, useNavigate } from "react-router-dom";
import { HeroUIProvider } from "@heroui/system";

import { CookieConsent } from "./components/cookie-consent";
import { PageNotFound } from "./pages/404";
import { CookieConsentProvider } from "./contexts/cookie-consent-context.tsx";

import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import MarkdownUtil from "@/pages/markdown-util";
import AboutPage from "@/pages/about";
import { siteConfig } from "@/config/site";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}
export function App() {
  console.log(`React router base path: ${import.meta.env.BASE_URL}`);
  const navigate = useNavigate();

  return (
    <>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <CookieConsentProvider>
          <CookieConsent />
          <Routes>
            <Route key="index" element={<IndexPage />} path={`/`} />
            <Route key="docs" element={<DocsPage />} path={`/docs`} />
            <Route key="pricing" element={<PricingPage />} path={`/pricing`} />
            <Route
              key="markdown-util"
              element={<MarkdownUtil />}
              path={`/markdown-util`}
            />
            <Route key="about" element={<AboutPage />} path={`/about`} />
            <Route key="404" element={<PageNotFound githubUrl={siteConfig().links.github}/>} path="*" />
          </Routes>
        </CookieConsentProvider>
      </HeroUIProvider>
    </>
  );
}

export default App;
