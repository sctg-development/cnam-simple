# PrintPDF WASM Debugging Tests

Scripts Node.js pour déboguer le problème de génération PDF vide avec le WASM printpdf.

## Problem

When calling `Pdf_HtmlToDocument` from the WASM module:
- ✅ Response is valid JSON
- ✅ Document structure is correct
- ✅ Expected number of pages are created
- ❌ **BUT: All pages have 0 operations (empty content)**
- ❌ No warnings or errors are shown

## Test Scripts

### 1. `test_simple_html.js` - Minimal Test
```bash
node test_simple_html.js
```
Tests with the simplest possible HTML structure:
```html
<!DOCTYPE html>
<html>
<head><style>body { margin: 20px; }</style></head>
<body>
    <h1>Test Title</h1>
    <p>Simple paragraph</p>
</body>
</html>
```

**Expected output:**
- If working: `First page ops: [number > 0]`
- If broken: `First page ops: 0  ❌ EMPTY`

---

### 2. `test_official_html.js` - Official Test Suite HTML
```bash
node test_official_html.js
```
Uses HTML from the official `printpdf` test suite (`html_page_breaking.rs`):
- 20 paragraphs
- Should break across multiple pages
- Tests with proper CSS

**Expected output:**
- Multiple pages with content operations
- Shows which pages are empty vs. have content

---

### 3. `test_configurations.js` - Configuration Variants
```bash
node test_configurations.js
```
Tests 4 different HTML configurations:
1. Minimal HTML (no tags)
2. With DOCTYPE
3. With head/style
4. With multiple tags (h1, p, ul, li, strong, em)

**Expected output:**
- Comparison table showing which configs work
- Helps identify if specific HTML elements cause issues

---

### 4. `test_conversion_pipeline.js` - Full Pipeline Test
```bash
node test_conversion_pipeline.js
```
Tests the complete PDF generation pipeline:
1. **Step 1:** HTML → Document (via `Pdf_HtmlToDocument`)
2. **Step 2:** Document → Base64 (via `Pdf_BytesToDocument`)
3. **Step 3:** Base64 → PDF file (saved to `test_output.pdf`)

**Expected output:**
- Detailed progress through each step
- Identifies where the failure occurs
- Saves a PDF file for inspection

---

### 5. `test_html_variants.js` - Comprehensive HTML Variants
```bash
node test_html_variants.js
```
Tests 18 different HTML variants to find the minimal case that breaks:
- Raw text in body
- Single paragraph
- Various style combinations
- Different semantic tags (article, section, div, etc.)
- Full page structure

**Expected output:**
- Table showing which variants work vs. fail
- Helps identify specific HTML element that causes the issue

---

## Running All Tests

```bash
# Run all tests sequentially
echo "Test 1: Simple HTML"
node test_simple_html.js

echo -e "\nTest 2: Official HTML"
node test_official_html.js

echo -e "\nTest 3: Configurations"
node test_configurations.js

echo -e "\nTest 4: Conversion Pipeline"
node test_conversion_pipeline.js

echo -e "\nTest 5: HTML Variants"
node test_html_variants.js
```

OR create a shell script to run them:

```bash
#!/bin/bash
for test in test_simple_html.js test_official_html.js test_configurations.js test_conversion_pipeline.js test_html_variants.js; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node "$test"
  echo ""
done
```

## Output Files

Each test generates a JSON output file for inspection:
- `test_simple_output.json` - From `test_simple_html.js`
- `test_official_output.json` - From `test_official_html.js`
- `test_output.pdf` - Generated PDF (from `test_conversion_pipeline.js`)

These files can be:
- Copied to `generated.json` in the repo for comparison
- Analyzed to see the full document structure
- Used to verify pagination and content distribution

## Interpreting Results

### Expected Working Behavior
```
📊 Document Structure:
  Total pages: 5
  Fonts registered: 0
  Warnings: 0

📄 Page Analysis:
  Page 1:
    Operations: 42          ← ✅ GOOD: Has content
    Op types: Text, Path, ...

  Page 2:
    Operations: 58          ← ✅ GOOD: Has content
```

### Current Broken Behavior
```
📊 Document Structure:
  Total pages: 5
  Fonts registered: 0
  Warnings: 0

📄 Page Analysis:
  Page 1:
    Operations: 0          ← ❌ BAD: Empty page

  Page 2:
    Operations: 0          ← ❌ BAD: Empty page
```

## Hypothesis for the Bug

Based on the symptoms:
1. ✅ HTML is parsed (document structure is correct)
2. ✅ Pages are created (correct page dimensions)
3. ❌ Layout/rendering fails silently (no warnings)
4. ❌ Result: Empty pages with 0 operations

**Likely causes:**
- HTML parsing succeeds but layout engine fails
- CSS selector matching issue
- Font resolution problem (even though fonts are empty)
- Display list generation fails silently
- Bridge conversion (display list → PDF ops) fails

## Next Steps

1. **Run `test_simple_html.js` first** - Confirms if it's a WASM issue or specific to your HTML
2. **Run `test_html_variants.js`** - Find the exact HTML element/CSS that breaks
3. **Check `test_output.pdf`** - Open with a PDF viewer to see if it's truly empty
4. **Compare JSON outputs** - Check `test_official_output.json` vs `generated.json` from your failing case
5. **Check WASM logs** - Look for clues in browser console or node output
