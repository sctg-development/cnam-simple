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
  return (
    <CookieConsentProvider>
      <CookieConsent />
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<DocsPage />} path="/docs" />
        <Route element={<PricingPage />} path="/pricing" />
        <Route element={<MarkdownUtil />} path="/markdown-util" />
        <Route element={<AboutPage />} path="/about" />
        <Route element={<PageNotFound />} path="*" />
      </Routes>
    </CookieConsentProvider>
  );
}

export default App;
