#!/usr/bin/env node

/**
 * Test WASM PDF conversion (HTML -> Document -> Base64)
 * Run: node test_conversion_pipeline.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    <p>This is paragraph 1.</p>
    <p>This is paragraph 2.</p>
    <p>This is paragraph 3.</p>
</body>
</html>`;

async function runTest() {
    console.log('🧪 TEST: Full PDF Conversion Pipeline\n');
    console.log('━'.repeat(60));

    try {
        // Load WASM
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

        const { 
            Pdf_HtmlToDocument, 
            Pdf_BytesToDocument,
            initSync
        } = await import(wasmPath);
        console.log('✅ WASM module loaded\n');

        // Initialize WASM
        console.log('🔄 Initializing WASM...');
        const wasmBinary = fs.readFileSync(wasmBinaryPath);
        initSync(wasmBinary);
        console.log('✅ WASM initialized\n');

        // Step 1: HTML to Document
        console.log('━'.repeat(60));
        console.log('STEP 1: HTML to Document Conversion');
        console.log('━'.repeat(60));

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

        console.log('Input:');
        console.log(`  HTML: ${testHtml.length} chars`);
        console.log(`  Images: 0, Fonts: 0`);
        console.log();

        console.log('🔄 Calling Pdf_HtmlToDocument...');
        const docJson = await Pdf_HtmlToDocument(JSON.stringify(input));
        console.log('✅ Response received\n');

        // Parse response
        let docObj;
        try {
            docObj = JSON.parse(docJson);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e.message);
            process.exit(1);
        }

        // Check status
        if (docObj.status !== 0) {
            console.error(`❌ Error status: ${docObj.status}`);
            console.error(`Error: ${JSON.stringify(docObj.data)}`);
            process.exit(1);
        }

        const doc = docObj.data.doc;
        console.log('Result:');
        console.log(`  Pages: ${doc.pages.length}`);
        console.log(`  Fonts: ${Object.keys(doc.resources.fonts).length}`);
        
        // Analyze operations per page
        const opsPerPage = doc.pages.map((p, idx) => ({
            page: idx + 1,
            ops: p.ops ? p.ops.length : 0
        }));

        console.log('  Operations per page:');
        opsPerPage.forEach(p => {
            console.log(`    Page ${p.page}: ${p.ops} ops ${p.ops === 0 ? '❌ EMPTY' : '✅'}`);
        });

        console.log();

        // Check if any page has content
        const hasContent = opsPerPage.some(p => p.ops > 0);
        
        if (!hasContent) {
            console.log('⚠️  WARNING: No page has operations!');
            console.log('   This is where the rendering fails.\n');
        }

        // Step 2: Document to Base64
        console.log('━'.repeat(60));
        console.log('STEP 2: Document to Base64 Conversion');
        console.log('━'.repeat(60));

        console.log('🔄 Calling Pdf_BytesToDocument...');
        const base64 = await Pdf_BytesToDocument(docJson);
        console.log('✅ Base64 received\n');

        console.log('Result:');
        console.log(`  Base64 length: ${base64.length} chars`);
        console.log(`  First 100 chars: ${base64.substring(0, 100)}`);
        console.log();

        // Verify base64
        console.log('🔄 Validating base64...');
        try {
            const buffer = Buffer.from(base64, 'base64');
            console.log(`✅ Valid base64 (${buffer.length} bytes)\n`);

            // Save PDF
            const pdfPath = path.join(__dirname, 'test_output.pdf');
            fs.writeFileSync(pdfPath, buffer);
            console.log(`📄 PDF saved to: ${pdfPath}\n`);

            // Check PDF header
            const header = buffer.toString('utf8', 0, 5);
            console.log(`PDF Header: "${header}"`);
            if (header === '%PDF-') {
                console.log('✅ Valid PDF header\n');
            } else {
                console.log('❌ Invalid PDF header\n');
            }

        } catch (e) {
            console.error('❌ Invalid base64:', e.message);
            process.exit(1);
        }

        // Final summary
        console.log('━'.repeat(60));
        console.log('SUMMARY');
        console.log('━'.repeat(60));

        if (!hasContent) {
            console.log('❌ ISSUE IDENTIFIED:');
            console.log('   Step 1 generates empty pages (no operations)');
            console.log('   Step 2 correctly converts empty data to PDF');
            console.log('   The problem is in HTML rendering, not PDF generation!');
        } else {
            console.log('✅ Full pipeline working correctly');
            console.log('   HTML → Document → Base64 → PDF');
        }

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

runTest();
