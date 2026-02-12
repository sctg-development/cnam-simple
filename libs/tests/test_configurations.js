#!/usr/bin/env node

/**
 * Test WASM PDF generation with different configurations
 * Run: node test_configurations.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
    {
        name: 'Minimal HTML',
        html: '<html><body><p>Hello World</p></body></html>',
        options: { pageWidth: 210, pageHeight: 297, fontEmbedding: false }
    },
    {
        name: 'HTML with DOCTYPE',
        html: '<!DOCTYPE html><html><body><p>Hello World</p></body></html>',
        options: { pageWidth: 210, pageHeight: 297, fontEmbedding: false }
    },
    {
        name: 'HTML with head and style',
        html: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 20px; font-size: 12pt; }
        p { margin-bottom: 10px; color: black; }
    </style>
</head>
<body>
    <p>Styled paragraph 1</p>
    <p>Styled paragraph 2</p>
</body>
</html>`,
        options: { pageWidth: 210, pageHeight: 297, fontEmbedding: false }
    },
    {
        name: 'HTML with multiple tags',
        html: `<!DOCTYPE html>
<html>
<head><style>body{margin:20px;}</style></head>
<body>
    <h1>Heading</h1>
    <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
    <ul>
        <li>Item 1</li>
        <li>Item 2</li>
    </ul>
</body>
</html>`,
        options: { pageWidth: 210, pageHeight: 297, fontEmbedding: false }
    }
];

async function runTests() {
    console.log('🧪 TEST: Multiple HTML configurations\n');

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

        const { Pdf_HtmlToDocument, initSync } = await import(wasmPath);
        console.log('✅ WASM module loaded\n');

        // Initialize WASM
        console.log('🔄 Initializing WASM...');
        const wasmBinary = fs.readFileSync(wasmBinaryPath);
        initSync(wasmBinary);
        console.log('✅ WASM initialized\n');

        // Run each test
        const results = [];
        
        for (const test of tests) {
            console.log('━'.repeat(60));
            console.log(`🧪 Test: ${test.name}`);
            console.log('━'.repeat(60));
            
            const input = {
                html: test.html,
                images: {},
                fonts: {},
                options: test.options
            };

            console.log(`HTML length: ${test.html.length} chars`);
            
            try {
                const docJson = await Pdf_HtmlToDocument(JSON.stringify(input));
                const docObj = JSON.parse(docJson);

                if (docObj.status !== 0) {
                    console.log(`❌ Error: ${docObj.data}`);
                    results.push({ test: test.name, status: 'ERROR', ops: 0 });
                    continue;
                }

                const doc = docObj.data.doc;
                const firstPageOps = (doc.pages[0]?.ops || []).length;
                const hasContent = firstPageOps > 0;

                console.log(`Pages: ${doc.pages.length}`);
                console.log(`First page ops: ${firstPageOps}`);
                console.log(`Result: ${hasContent ? '✅ HAS CONTENT' : '❌ EMPTY'}`);
                
                results.push({
                    test: test.name,
                    status: hasContent ? 'OK' : 'EMPTY',
                    ops: firstPageOps,
                    pages: doc.pages.length
                });

            } catch (err) {
                console.log(`❌ Exception: ${err.message}`);
                results.push({ test: test.name, status: 'EXCEPTION', ops: 0 });
            }
            
            console.log();
        }

        // Summary
        console.log('━'.repeat(60));
        console.log('📊 SUMMARY\n');
        
        results.forEach(r => {
            const icon = r.status === 'OK' ? '✅' : r.status === 'EMPTY' ? '❌' : '⚠️';
            console.log(`${icon} ${r.test}`);
            console.log(`   Status: ${r.status}, First page ops: ${r.ops}`);
        });

        const hasContentTests = results.filter(r => r.status === 'OK').length;
        const emptyTests = results.filter(r => r.status === 'EMPTY').length;
        
        console.log(`\nTotal: ${hasContentTests} with content, ${emptyTests} empty`);
        
        if (emptyTests === results.length) {
            console.log('\n❌ ALL TESTS FAILED - No content generated in any test!');
        } else if (emptyTests > 0) {
            console.log(`\n⚠️  ${emptyTests} tests produced empty pages`);
        } else {
            console.log('\n✅ All tests produced content!');
        }

        console.log('━'.repeat(60));

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

runTests();
