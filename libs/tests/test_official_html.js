#!/usr/bin/env node

/**
 * Test WASM PDF generation with HTML from official printpdf tests
 * Run: node test_official_html.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTML from official printpdf tests (html_page_breaking.rs)
const testHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 20px; font-size: 12pt; }
        p { margin-bottom: 10px; }
    </style>
</head>
<body>
    <p>This is paragraph 1. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    <p>This is paragraph 2. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <p>This is paragraph 3. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
    <p>This is paragraph 4. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.</p>
    <p>This is paragraph 5. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.</p>
    <p>This is paragraph 6. Deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus.</p>
    <p>This is paragraph 7. Error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.</p>
    <p>This is paragraph 8. Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae.</p>
    <p>This is paragraph 9. Vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit.</p>
    <p>This is paragraph 10. Aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos.</p>
    <p>This is paragraph 11. Qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem.</p>
    <p>This is paragraph 12. Ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam.</p>
    <p>This is paragraph 13. Eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.</p>
    <p>This is paragraph 14. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit.</p>
    <p>This is paragraph 15. Laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure.</p>
    <p>This is paragraph 16. Reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.</p>
    <p>This is paragraph 17. Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</p>
    <p>This is paragraph 18. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis.</p>
    <p>This is paragraph 19. Praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias.</p>
    <p>This is paragraph 20. Excepturi sint occaecati cupiditate non provident, similique sunt in culpa.</p>
</body>
</html>`;

async function runTest() {
    console.log('🧪 TEST: Official PrintPDF HTML (page breaking test)\n');
    console.log('━'.repeat(60));

    try {
        // Load printpdf WASM
        console.log('📦 Loading WASM module...');
        const wasmPath = path.join(__dirname, '../../apps/client/src/printpdf/printpdf.js');
        const wasmBinaryPath = path.join(__dirname, '../../apps/client/src/printpdf/printpdf_bg.wasm');
        
        if (!fs.existsSync(wasmPath)) {
            console.error('❌ WASM JS not found at:', wasmPath);
            process.exit(1);
        }
        
        if (!fs.existsSync(wasmBinaryPath)) {
            console.error('❌ WASM binary not found at:', wasmBinaryPath);
            process.exit(1);
        }

        const { Pdf_HtmlToDocument, initSync } = await import(wasmPath);
        console.log('✅ WASM module loaded\n');

        // Initialize WASM
        console.log('🔄 Initializing WASM...');
        const wasmBinary = fs.readFileSync(wasmBinaryPath);
        initSync(wasmBinary);
        console.log('✅ WASM initialized\n');

        // Define test input
        const input = {
            html: testHtml,
            images: {},
            fonts: {},
            options: {
                pageWidth: 210,
                pageHeight: 297,
                fontEmbedding: false
            }
        };

        // Log input details
        console.log('📝 Input Details:');
        console.log(`  HTML length: ${testHtml.length} chars`);
        console.log(`  Number of paragraphs: 20`);
        console.log(`  Images: ${Object.keys(input.images).length}`);
        console.log(`  Fonts: ${Object.keys(input.fonts).length}`);
        console.log(`  Page size: ${input.options.pageWidth}x${input.options.pageHeight} mm`);
        console.log(`  Font embedding: ${input.options.fontEmbedding}\n`);

        // Call WASM function
        console.log('🔄 Calling Pdf_HtmlToDocument...');
        const startTime = Date.now();
        const docJson = await Pdf_HtmlToDocument(JSON.stringify(input));
        const duration = Date.now() - startTime;
        console.log(`✅ Completed in ${duration}ms\n`);

        // Parse response
        console.log('📊 Parsing response...');
        let docObj;
        try {
            docObj = JSON.parse(docJson);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e.message);
            console.log('Response (first 500 chars):', docJson.substring(0, 500));
            process.exit(1);
        }

        // Check status
        if (docObj.status !== 0) {
            console.error(`❌ Error status: ${docObj.status}`);
            console.error(`Error: ${JSON.stringify(docObj.data)}`);
            process.exit(1);
        }

        console.log('✅ Status: OK (0)\n');

        // Analyze document structure
        const doc = docObj.data.doc;
        const numPages = doc.pages.length;
        const numFonts = Object.keys(doc.resources.fonts).length;
        const warnings = docObj.data.warnings;

        console.log('📈 Document Structure:');
        console.log(`  Total pages: ${numPages}`);
        console.log(`  Fonts registered: ${numFonts}`);
        console.log(`  Warnings: ${warnings.length}`);
        console.log();

        // Analyze each page
        console.log('📄 Page Analysis:');
        let totalOps = 0;
        let emptyPages = 0;
        
        doc.pages.forEach((page, idx) => {
            const opsCount = page.ops ? page.ops.length : 0;
            totalOps += opsCount;
            if (opsCount === 0) emptyPages++;
            
            console.log(`  Page ${idx + 1}:`);
            console.log(`    Operations: ${opsCount}`);
            if (opsCount > 0) {
                const opTypes = page.ops.map(op => op[0]).slice(0, 3);
                console.log(`    Op types: ${opTypes.join(', ')}...`);
            }
        });
        console.log();

        // Final verdict
        console.log('━'.repeat(60));
        if (emptyPages === numPages) {
            console.log('❌ FAILURE: ALL pages are empty (no operations)');
            console.log('   This confirms the rendering bug!');
        } else if (emptyPages > 0) {
            console.log(`⚠️  WARNING: ${emptyPages}/${numPages} pages are empty`);
            console.log(`   ${numPages - emptyPages} pages have content`);
        } else {
            console.log(`✅ SUCCESS: All ${numPages} pages have content`);
            console.log(`   Total operations: ${totalOps}`);
        }

        // Show warnings if any
        if (warnings.length > 0) {
            console.log('\n⚠️  Warnings from WASM:');
            warnings.forEach((w, i) => {
                console.log(`  [${i + 1}] ${w}`);
            });
        }

        console.log('━'.repeat(60));

        // Save output for inspection
        const outputPath = path.join(__dirname, 'test_official_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(docObj, null, 2));
        console.log(`\n📁 Full output saved to: ${outputPath}`);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

runTest();
