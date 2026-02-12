#!/usr/bin/env node

/**
 * Test WASM PDF generation with the simplest possible HTML
 * Run: node test_simple_html.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple HTML with just text
const testHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 20px; font-size: 12pt; }
        p { margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Test Title</h1>
    <p>This is a simple paragraph with text.</p>
    <p>Second paragraph.</p>
    <p>Third paragraph.</p>
</body>
</html>`;

async function runTest() {
    console.log('🧪 TEST: Simple HTML\n');
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

        // Dynamic import for WASM JS module
        const { Pdf_HtmlToDocument, initSync } = await import(wasmPath);
        console.log('✅ WASM module loaded\n');

        // Initialize WASM with binary
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
        doc.pages.forEach((page, idx) => {
            const opsCount = page.ops ? page.ops.length : 0;
            console.log(`  Page ${idx + 1}:`);
            console.log(`    Operations: ${opsCount}`);
            if (opsCount > 0) {
                const opTypes = page.ops.map(op => op[0]).slice(0, 5);
                console.log(`    Op types: ${opTypes.join(', ')}...`);
            }
        });
        console.log();

        // Final verdict
        const firstPageOps = (doc.pages[0]?.ops || []).length;
        
        console.log('━'.repeat(60));
        if (firstPageOps === 0) {
            console.log('❌ FAILURE: First page has NO operations (empty content)');
            console.log('   The HTML was parsed but no rendering happened.');
            console.log('   This is the BUG we need to fix!');
        } else {
            console.log(`✅ SUCCESS: First page has ${firstPageOps} operations`);
            console.log('   HTML rendering is working!');
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
        const outputPath = path.join(__dirname, 'test_simple_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(docObj, null, 2));
        console.log(`\n📁 Full output saved to: ${outputPath}`);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

runTest();
