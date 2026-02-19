import { Route, Routes } from "react-router-dom";

// Component Composition & Separation of Concerns: Layered provider hierarchy
import { CookieConsentProvider } from "./contexts/cookie-consent-context";
import { CookieConsent } from "./components/cookie-consent";
import { PageNotFound } from "./pages/404";

import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import MarkdownUtil from "@/pages/markdown-util";
import AboutPage from "@/pages/about";

// Declarative Routing: Route-based component composition
export function App() {
  console.log(`React router base path: ${import.meta.env.BASE_URL}`);
  return (
    <CookieConsentProvider>
      <CookieConsent />
      <Routes>
        <Route key="index" element={<IndexPage />} path={`/`} />
        <Route key="docs" element={<DocsPage />} path={`/docs`} />
        <Route key="pricing" element={<PricingPage />} path={`/pricing`} />
        <Route key="markdown-util" element={<MarkdownUtil />} path={`/markdown-util`} />
        <Route key="about" element={<AboutPage />} path={`/about`} />
        <Route key="404" element={<PageNotFound />} path="*" />
      </Routes>
    </CookieConsentProvider>
  );
}

export default App;
