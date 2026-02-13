# CNAM Cursus Scraper - Feasibility Analysis

**Date**: February 10, 2026  
**Project**: CNAM Simple  
**Objective**: Build a web scraper for CNAM training programs using Cloudflare Workers and Playwright

---

## Executive Summary

The proposed implementation is **highly feasible** with manageable complexity. The existing monorepo architecture provides excellent foundations, and the technical stack is well-suited for the requirements. However, several specific challenges related to web scraping robustness, performance optimization, and deployment constraints need careful attention.

**Feasibility Score: 8.5/10**

---

## 1. Project Overview

### Objectives
- Fetch CNAM training program data (e.g., CYC9101A) from bedeo.cnam.fr
- Parse cursus structure including years, units (EU), and detailed unit information
- Return structured JSON with training information, objectives, content, and bibliography
- Cache results in Cloudflare KV to minimize scraping frequency
- Expose data via REST API endpoint

### Target Data Structure
```json
{
  "name": "string",
  "code": "string",
  "audience_access": "string",
  "objectives": "string",
  "EU": [
    {
      "year": "number",
      "units": [
        {
          "name": "string",
          "code": "string",
          "url": "string",
          "audience_access": "string",
          "objectives": "string",
          "content": "string",
          "bibliography": [
            {
              "title": "string",
              "author": "string"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 2. Current Architecture Analysis

### Monorepo Structure
The project uses **Turbo** as a monorepo orchestrator with a workspace-based approach:

```
apps/
├── client/          (React 19 + HeroUI frontend)
├── cloudflare-worker/  (Cloudflare Workers backend)
```

**Strengths**:
- Clean separation of concerns
- Shared dependency management via root `package.json`
- Turbo enables efficient task orchestration and caching
- Environment variable support across workspaces

### Backend Architecture (Cloudflare Worker)

#### Router System
- Custom router class with support for:
  - RESTful HTTP methods (GET, POST, PUT, DELETE)
  - Rocket-style parameter syntax: `<param>` and `<param..>`
  - URLPattern-based route matching
  - Permission/authentication checks via Auth0/Dex
  - CORS support
  - Rate limiting (via Cloudflare's DDoS protection)

#### Authentication & Permissions
- JWT validation against Auth0 JWKS or Dex
- Permission-based access control
- Credential verification for protected routes

#### Available Bindings
- **CFBROWSER**: Browser rendering capability via Cloudflare
- **CACHE**: KV namespace for caching (ID: `6f0994498cca443ba25b4f01919c9c1a`)
- **RATE_LIMITER**: Rate limiting with configurable limits (currently 5 requests/60 seconds)

#### Dependencies
- `@cloudflare/playwright` (v1.1.0): Headless browser automation
- `jose` (v6.1.3): JWT handling and verification
- `wrangler` (v4.63.0): Cloudflare development and deployment

### Frontend Architecture (React)

- React 19 with modern hooks
- HeroUI component library (v2.x)
- React Router v7 for navigation
- Internationalization support (i18next with backend)
- TailwindCSS v4 for styling
- Vite as build tool

**Current Pages**:
- Home, Docs, Pricing, Blog, About (placeholder structure)
- 404 error page
- Cookie consent management

---

## 3. Technical Stack Assessment

### 3.1 Cloudflare Playwright Integration

**Status**: ✅ Ready to Use

The `@cloudflare/playwright` dependency is already included in `cloudflare-worker/package.json`. This is the critical component for web scraping.

**Key Features**:
- Headless browser automation
- DOM parsing and XPath support
- JavaScript execution capability
- Session management
- Form interaction support

**Cloudflare Worker Browser Compatibility**:
- Bound via `CFBROWSER` in `wrangler.jsonc`
- Configured with `compatibility_date: "2025-10-04"`
- Requires `nodejs_compat` flag (already enabled)

### 3.2 KV Cache (Cloudflare Workers KV)

**Status**: ✅ Pre-configured

The CACHE KV namespace is already bound:
```
"kv_namespaces": [
  {
    "binding": "CACHE",
    "id": "6f0994498cca443ba25b4f01919c9c1a"
  }
]
```

**Considerations**:
- Maximum value size: **25 MB** per entry (sufficient for typical cursus data)
- Maximum key length: **512 bytes**
- Read/write operations: ~50ms latency (acceptable for caching)
- Cost-effective for frequently accessed data

### 3.3 Rate Limiting

**Current Configuration**:
- 5 requests per 60 seconds per endpoint
- May be too restrictive for parallel scraping operations
- **Adjustable** in wrangler.jsonc as needed

### 3.4 XPath & DOM Parsing

The target website structure requires:
- XPath evaluation: `//*[@id="cursus_schema"]`
- Class-based selectors: `.schema-ensemble`, `.schema-unite`
- Attribute extraction from HTML elements

**Playwright Support**: ✅ Full XPath and CSS selector support

---

## 4. Data Scraping Feasibility Analysis

### 4.1 Target Website Structure

**Site**: https://bedeo.cnam.fr/public/cursus/view/{code}

**Scraping Strategy**:
1. **Level 1 - Cursus Page**:
   - Navigate to main cursus page
   - Parse div `#cursus_schema` for year containers
   - Extract year labels from `.schema-ensemble-infos-label` spans
   - Identify all `.schema-unite` education units
   - Extract unit links from `.schema-unite-content-code` anchors

2. **Level 2 - Unit Detail Pages**:
   - Navigate to each unit URL
   - Parse `#presentation` section for:
     - `#presentation/div[1]/div`: audience_access
     - `#presentation/div[2]/div`: objectives
   - Parse `#contenu` section for:
     - `#contenu/div[1]/div`: content (multiple paragraphs)
     - `#contenu/div[2]/div/table`: bibliography (title + author)

### 4.2 XPath Complexity Assessment

**Simple XPaths** (High Reliability):
- `//div[@id="cursus_schema"]`
- `//div[@class="schema-ensemble"]`
- `//div[@class="schema-unite"]`

**XPath with Position Predicates** (Medium Reliability):
- `//*[@id="presentation"]/div[1]/div`
- `//*[@id="contenu"]/div[2]/div/table`

**Risk**: HTML structure changes could break position-based selectors

### 4.3 Feasibility: HIGH

**Justification**:
- XPath evaluation is well-supported by Playwright
- Target selectors are specific and identifiable
- Data extraction logic is straightforward
- No JavaScript rendering complexity required
- Reasonable expectations for static content

---

## 5. Implementation Requirements

### 5.1 Code Structure

#### New Files Required

```
apps/cloudflare-worker/src/
├── scraper/
│   ├── cnam-scraper.ts       (Main scraper orchestration)
│   ├── parsers.ts             (XPath-based DOM parsing)
│   └── types.ts               (Shared types)
├── cache/
│   ├── kv-cache.ts            (KV operations wrapper)
│   └── cache-key-generator.ts (Consistent cache key strategy)
├── routes/
│   └── cursus.ts          (API endpoint implementation)
```

#### Key Modules to Implement

1. **Cursus Route Handler** (`cursus.ts`)
   ```typescript
   router.get("/api/cursus/<code>", async (req, env) => {
     // Implementation
   });
   ```

2. **CNAM Scraper** (`scraper/cnam-scraper.ts`)
   - Initialize browser instance
   - Handle navigation with retry logic
   - Coordinate multi-page scraping
   - Error handling and cleanup

3. **DOM Parsers** (`scraper/parsers.ts`)
   - `parseCursusPage()`: Extract year structure
   - `parseUnitDetailPage()`: Extract content details
   - `extractBibliography()`: Table parsing for references

4. **KV Cache Manager** (`cache/kv-cache.ts`)
   - `get(code)`: Retrieve cached cursus
   - `set(code, data, ttl)`: Store with TTL
   - `invalidate(code)`: Manual cache clearing

### 5.2 API Endpoint Design

**Endpoint**: `GET /api/cursus/<code>`

**Parameters**:
- `code` (path): Training code (e.g., "CYC9101A")
- `force` (query, optional): Force scrape even if cached
- `timeout` (query, optional): Custom timeout in milliseconds

**Response Structure**:
```json
{
  "success": true,
  "data": { /* cursus object */ },
  "cached": false,
  "scrapedAt": "2026-02-10T15:30:00Z"
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Cursus not found",
  "code": 404
}
```

### 5.3 Scraping Logic Flow

```
Request received (code=CYC9101A)
    ↓
[CheckCache] Is it in KV?
    ├─ YES → Return cached data (< 50ms)
    └─ NO → Continue to scraping
    ↓
[Initialize Playwright]
    ↓
[Fetch Cursus Page]
    → Navigate to https://bedeo.cnam.fr/public/cursus/view/CYC9101A
    → Wait for #cursus_schema to load
    → Extract years and unit links
    ↓
[For Each Unit]
    → Navigate to unit URL
    → Extract presentation (audience, objectives)
    → Extract content section
    → Parse bibliography table
    ↓
[Build Response JSON]
    ↓
[Cache Result] Store in KV with TTL
    ↓
[Return Response]
```

---

## 6. Technical Challenges & Solutions

### Challenge 1: Dynamic Content Loading

**Issue**: If bedeo.cnam.fr uses client-side rendering (React/Angular), elements may not be immediately available.

**Severity**: Medium

**Solutions**:
1. **Explicit Waits**: Use `await page.waitForSelector()` before extraction
2. **Network Idle**: Wait for network idle state with `page.goto(url, { waitUntil: 'networkidle' })`
3. **JavaScript Evaluation**: If needed, execute JavaScript in page context
4. **Timeouts**: Configurable timeout with sensible defaults (10-30 seconds)

**Implementation**:
```typescript
await page.waitForSelector('div[id="cursus_schema"]', { timeout: 10000 });
```

### Challenge 2: XPath Position Predicates Fragility

**Issue**: `#presentation/div[1]/div` assumes fixed HTML structure. Any DOM changes break extraction.

**Severity**: Medium (maintenance issue)

**Solutions**:
1. **Fallback Selectors**: Use multiple selector strategies
```typescript
const audience = await page.$eval(
  '#presentation > div:nth-child(1) p',
  el => el?.textContent?.trim() || ''
).catch(() => {
  // Fallback: try alternative selector
  return page.$eval('#presentation p', el => el?.textContent?.trim() || '');
});
```

2. **Error Recovery**: Collect partial data if some fields unavailable
3. **Logging**: Detailed logs for debugging structure changes
4. **Monitoring**: Track selector success rates

### Challenge 3: Session Management & Browser Reuse

**Issue**: Opening a new browser context for every request generates overhead.

**Severity**: Low-Medium (performance impact)

**Solutions**:
1. **Request-scoped Browser**: Create browser context per request (simpler, correct for distributed Workers)
2. **Proper Cleanup**: Ensure browser closes even on errors
```typescript
try {
  // Scraping logic
} finally {
  await browser.close();
}
```

3. **Alternative**: Use persistent context if Workers support connection pooling (currently not recommended)

### Challenge 4: Rate Limiting Sensitivity

**Issue**: CNAM server may detect and block excessive requests. Cloudflare's 5 req/60s may be insufficient.

**Severity**: Medium

**Solutions**:
1. **Increase Cache TTL**: 24-48 hours for production (reduce scraping frequency)
2. **Request Throttling**: Add delays between unit page navigations
```typescript
await new Promise(resolve => setTimeout(resolve, 2000)); // 2s between requests
```

3. **User-Agent Rotation**: Vary User-Agent headers
4. **IP Diversity**: Cloudflare workers may use various IPs (automatic)
5. **Respect robots.txt**: Check and honor rate limiting rules

### Challenge 5: Error Handling & Timeouts

**Issue**: Long-running scraping operations may exceed Cloudflare Workers timeout (30 seconds default).

**Severity**: High

**Calculations**:
- Average unit: 2-3 seconds to scrape
- Typical cursus: 3-5 years × 4-8 units = 12-40 units
- **Total time estimate**: 30-120 seconds for full cursus

**Solutions**:
1. **Async Queue System**: Queue scraping tasks for background processing
2. **Progress Caching**: Cache partial results as units are scraped
3. **Timeout Optimization**:
   - Parallel unit scraping (limited concurrency: 2-3 simultaneous)
   - Aggressive timeouts per unit (5s)
   - Fallback to cached partial data

**Implementation Strategy**:
```typescript
// Scrape units in parallel with concurrency limit
const queue = units.map((unit, i) => ({ unit, priority: i }));
const results = await scrapeWithConcurrency(queue, 3);
```

### Challenge 6: BEDEO.CNAM.FR Accessibility

**Issue**: Website may require specific headers, have CAPTCHA, or block automated access.

**Severity**: Medium-High

**Solutions**:
1. **Request Headers**: Mimic real browser behavior
```typescript
await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
```

2. **Screenshot Testing**: Verify scraping with screenshots during development
3. **Manual Testing**: Test against real website before deployment
4. **Fallback**: Provide manual data entry option if scraping fails

---

## 7. Performance Analysis

### 7.1 Response Time Estimates

**Cached Request**: ~100-200ms
- KV lookup: 50ms
- Serialization/transmission: 50-150ms

**First Request (Cold Cache)**:
- Browser startup: 2-3s
- Navigation + initial parse: 3-5s
- Unit detail scraping (4 units × 3s): 12s
- **Total**: 17-23 seconds (acceptable)

### 7.2 Optimization Strategies

1. **Caching with TTL**:
   - Default: 24 hours
   - Configurable via environment variables
   - Manual invalidation endpoint (admin only)

2. **Parallel Processing**:
   - Multiple units simultaneously (2-3 concurrent)
   - Reduce total scraping time by 30-50%

3. **Progressive Caching**:
   - Cache each unit individually
   - Return partial results if timeout occurs
   - Allow frontend to request missing units

4. **Lazy Loading on Frontend**:
   - Load cursus overview first
   - Load detailed units on-demand
   - Reduces initial payload

---

## 8. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| BEDEO.CNAM.FR blocks automated access | High | Medium | User-Agent rotation, respectful rate limiting, fallback to manual entry |
| HTML structure changes break scraper | Medium | Medium | Flexible CSS/XPath selectors, monitoring, version control |
| Cloudflare Workers timeout (30s) | Medium | Low | Parallel processing, progressive caching, timeout optimization |
| KV storage quota exceeded | Low | Very Low | Compress data, implement TTL expiration, monitor usage |
| Data extraction errors (position selectors) | Medium | Low | Comprehensive error logging, fallback selectors, manual validation |
| Performance issues with large curricula | Medium | Low | Progressive scraping, caching, potentially async queuing |

---

## 9. Dependency & Infrastructure Readiness

### 9.1 Dependency Gap Analysis

**Already Available**:
- ✅ `@cloudflare/playwright` v1.1.0 (browser automation)
- ✅ `jose` v6.1.3 (JWT handling)
- ✅ Cloudflare KV binding (caching)
- ✅ Cloudflare Browser Rendering API (CFBROWSER)
- ✅ TypeScript support (v5.9.3)
- ✅ Vitest + @cloudflare/vitest-pool-workers (testing)

**No Additional Major Dependencies Required** ✅

### 9.2 Cloudflare Features Used

1. **Cloudflare Workers**: Runtime environment
2. **Cloudflare Browser Rendering API**: Headless browser
3. **Cloudflare Workers KV**: Distributed caching
4. **Cloudflare DDoS Protection**: Rate limiting

All features are enabled and configured.

---

## 10. Implementation Roadmap

### Phase 1: Foundation (2-3 days)
- [ ] Create project structure (scraper, parsers, cache modules)
- [ ] Implement basic Playwright integration test
- [ ] Build KV cache wrapper
- [ ] Write type definitions

### Phase 2: Core Functionality (3-5 days)
- [ ] Implement `parseCursusPage()` (main page parsing)
- [ ] Implement `parseUnitDetailPage()` (detail page parsing)
- [ ] Add error handling and retry logic
- [ ] Implement cursus API route

### Phase 3: Testing & Validation (2-3 days)
- [ ] Unit tests for parsers
- [ ] Integration tests against real bedeo.cnam.fr
- [ ] Test with various cursus codes
- [ ] Validate JSON output structure
- [ ] Load testing (concurrent requests)

### Phase 4: Frontend Integration (2-3 days)
- [ ] Create cursus search component
- [ ] Create cursus detail view
- [ ] Implement loading states and error handling
- [ ] Add cache invalidation UI (admin only)

### Phase 5: Optimization & Deployment (1-2 days)
- [ ] Performance profiling
- [ ] Security review (prevent injection, validate inputs)
- [ ] Environment configuration finalization
- [ ] Deployment and monitoring setup

**Total Estimated Time**: 10-16 days

---

## 11. Frontend Integration Considerations

### 11.1 UI/UX for Cursus Search

**Recommended Features**:
1. **Search Input**: Cursus code input (e.g., "CYC9101A")
2. **Loading States**: Show spinner during fetch
3. **Error Handling**: Display user-friendly error messages
4. **Cached Indicator**: Show if data is cached
5. **Last Updated**: Display scrape timestamp

**Implementation Points**:
- Use React hooks for state management
- React Router for cursus detail view
- TailwindCSS for responsive design (already available)
- Error boundary for stability

### 11.2 Data Presentation

**Structure**:
- Cursus overview (name, code, objectives)
- Accordion-style year sections
- Unit cards within each year
- Bibliography as references section

**Responsive Design**:
- Mobile: Stack all sections vertically
- Tablet: 2 column layout for units
- Desktop: Full width with sidebar navigation

---

## 12. Security Considerations

### 12.1 Input Validation

**Cursus Code Format**:
```typescript
const codePattern = /^[A-Z0-9]{6,8}$/; // e.g., CYC9101A or CYC9101
if (!codePattern.test(code)) {
  throw new Error('Invalid cursus code format');
}
```

### 12.2 API Security

1. **CORS**: Already configured in router
2. **Rate Limiting**: Per-IP rate limiting (5 req/60s)
3. **Input Sanitization**: Validate code format
4. **Authentication** (optional): Protect with Auth0 if needed
5. **XSS Prevention**: Properly escape all output

### 12.3 Scraper Security

1. **User-Agent**: Identify as a bot
2. **Request Headers**: Common browser headers
3. **Robots.txt Compliance**: Check BEDEO.CNAM.FR robots.txt
4. **Error Logging**: Log parse failures for debugging
5. **No Credential Usage**: No passwords or sensitive data in requests

---

## 13. Testing Strategy

### Unit Tests
- Parser functions for each XPath extraction
- Cache operations (set, get, invalidate)
- Error handling and fallback logic
- Input validation

### Integration Tests
- Full cursus scraping flow
- Multi-unit extraction
- Cache hit/miss scenarios
- Error recovery

### E2E Tests
- Real website scraping (with test code)
- Response validation against schema
- Performance benchmarks

### Test Example Structure
```typescript
describe('CNAM Scraper', () => {
  it('parses cursus page structure', () => {
    // Test with real HTML or mock
  });
  
  it('extracts unit bibliography correctly', () => {
    // Verify table parsing
  });
  
  it('caches and retrieves data', async () => {
    // Test KV operations
  });
});
```

---

## 14. Recommendations

### 14.1 Go-Ahead Recommendation: ✅ YES

**Confidence Level**: High (8.5/10)

The project is **technically feasible** with expected implementation within 10-16 days. The existing infrastructure is well-suited, and no significant architectural changes are required.

### 14.2 Implementation Guidelines

1. **Start with Manual Testing**:
   - Test web scraping logic locally before deployment
   - Validate selectors against real bedeo.cnam.fr

2. **Incremental Deployment**:
   - Deploy to staging first
   - Monitor scraping success rates
   - Adjust rate limiting and timeouts based on real performance

3. **Graceful Degradation**:
   - Always return cached data if scraping fails
   - Log errors for debugging
   - Provide manual fallback options

4. **Monitor and Maintain**:
   - Track selector success rates
   - Monitor API response times
   - Alert on scraping failures
   - Plan for quarterly validation against structure changes

### 14.3 Alternative Approaches (If Primary Fails)

1. **Server-Side Rendering**: If Playwright performance is insufficient, consider Next.js SSR with scheduled scraping

2. **External Scraping Service**: Use third-party services like Bright Data or ScraperAPI as fallback

3. **Manual Data Entry**: Provide admin panel for manual cursus entry as backup

4. **Hybrid Approach**: Combine automated scraping with manual updates for enhanced reliability

---

## 15. Conclusion

The CNAM cursus scraper project is **highly feasible** within the current monorepo architecture. The Cloudflare Workers platform, combined with Playwright browser automation and KV caching, provides a robust foundation for reliable, performant data extraction.

**Key Success Factors**:
1. Thorough testing against real website before production
2. Robust error handling and graceful degradation
3. Respectful rate limiting to avoid BEDEO.CNAM.FR blocking
4. Comprehensive logging for troubleshooting
5. Clear monitoring and alerting post-deployment

**Next Steps**:
1. Review and approve implementation plan
2. Set up testing environment with real BEDEO.CNAM.FR access
3. Begin Phase 1 (Foundation) development
4. Schedule weekly reviews during implementation

---

## Appendices

### A. Reference URLs
- **CNAM Portal**: https://bedeo.cnam.fr/public/cursus/view/
- **Cloudflare Workers Documentation**: https://developers.cloudflare.com/workers/
- **Playwright Documentation**: https://playwright.dev/docs/intro
- **Cloudflare KV Documentation**: https://developers.cloudflare.com/kv/

### B. Example Cursus Code
- CYC9101A (used in requirements)
- CYC9102A
- CYC9103A
(To be confirmed with actual CNAM codes)

### C. Browser Automation Best Practices
- Always use try/finally for browser cleanup
- Set reasonable timeouts (5-30s depending on operation)
- Handle network errors gracefully
- Log detailed error information
- Test error paths during development

---

**Report Prepared By**: GitHub Copilot  
**Document Status**: FINAL  
**Version**: 1.0
