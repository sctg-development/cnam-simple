#!/usr/bin/env node

/**
 * Comprehensive HTML/CSS debugging test
 * Run: node test_html_variants_new.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let Pdf_HtmlToDocument;

async function testHtmlVariant(name, html) {
    try {
        const input = {
            html,
            images: {},
            fonts: {},
            options: {
                pageWidth: 210,
                pageHeight: 297,
                fontEmbedding: false
            }
        };

        const docJson = await Pdf_HtmlToDocument(JSON.stringify(input));
        const docObj = JSON.parse(docJson);

        if (docObj.status !== 0) {
            return { name, status: 'ERROR', ops: 0, message: docObj.data };
        }

        const firstPageOps = (docObj.data.doc.pages[0]?.ops || []).length;
        return {
            name,
            status: firstPageOps > 0 ? 'OK' : 'EMPTY',
            ops: firstPageOps,
            pages: docObj.data.doc.pages.length
        };
    } catch (err) {
        return { name, status: 'EXCEPTION', ops: 0, message: err.message };
    }
}

async function runTests() {
    console.log('🧪 TEST: HTML Variants\n');
    console.log('━'.repeat(60));

    try {
        // Load WASM once
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

        console.log('📦 Loading WASM module...');
        const wasmModule = await import(wasmPath);
        Pdf_HtmlToDocument = wasmModule.Pdf_HtmlToDocument;
        
        console.log('🔄 Initializing WASM...');
        const wasmBinary = fs.readFileSync(wasmBinaryPath);
        wasmModule.initSync(wasmBinary);
        console.log('✅ WASM initialized\n');

        // Define variants
        const variants = [
            {
                name: 'Raw text in body',
                html: '<html><body>Hello</body></html>'
            },
            {
                name: 'Single paragraph',
                html: '<html><body><p>Hello</p></body></html>'
            },
            {
                name: 'Paragraph with DOCTYPE',
                html: '<!DOCTYPE html><html><body><p>Hello</p></body></html>'
            },
            {
                name: 'With head tag',
                html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With meta charset',
                html: '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With empty style',
                html: '<!DOCTYPE html><html><head><style></style></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With body style',
                html: '<!DOCTYPE html><html><head><style>body { }</style></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With paragraph style',
                html: '<!DOCTYPE html><html><head><style>p { }</style></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With margin style',
                html: '<!DOCTYPE html><html><head><style>p { margin: 10px; }</style></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'With font-size style',
                html: '<!DOCTYPE html><html><head><style>p { font-size: 12px; }</style></head><body><p>Hello</p></body></html>'
            },
            {
                name: 'Multiple paragraphs',
                html: '<!DOCTYPE html><html><body><p>Para 1</p><p>Para 2</p><p>Para 3</p></body></html>'
            },
            {
                name: 'With headings',
                html: '<!DOCTYPE html><html><body><h1>Title</h1><p>Paragraph</p></body></html>'
            },
            {
                name: 'With text formatting',
                html: '<!DOCTYPE html><html><body><p>Text with <strong>bold</strong> and <em>italic</em>.</p></body></html>'
            },
            {
                name: 'With lists',
                html: '<!DOCTYPE html><html><body><ul><li>Item 1</li><li>Item 2</li></ul></body></html>'
            },
            {
                name: 'With div container',
                html: '<!DOCTYPE html><html><body><div><p>Paragraph in div</p></div></body></html>'
            },
            {
                name: 'With article tag',
                html: '<!DOCTYPE html><html><body><article><h1>Article</h1><p>Content</p></article></body></html>'
            },
            {
                name: 'With section tag',
                html: '<!DOCTYPE html><html><body><section><h2>Section</h2><p>Content</p></section></body></html>'
            },
            {
                name: 'Full page structure',
                html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 20px; font-size: 12pt; }
    </style>
</head>
<body>
    <h1>Title</h1>
    <p>Paragraph 1</p>
    <p>Paragraph 2</p>
</body>
</html>`
            }
        ];

        // Run tests
        console.log('━'.repeat(70));
        console.log('HTML Variant Tests');
        console.log('━'.repeat(70));

        const results = [];
        for (const variant of variants) {
            process.stdout.write(`Testing: ${variant.name.padEnd(35)} ... `);
            const result = await testHtmlVariant(variant.name, variant.html);
            results.push(result);
            
            if (result.status === 'OK') {
                console.log(`✅ ${result.ops} ops`);
            } else if (result.status === 'EMPTY') {
                console.log(`❌ EMPTY`);
            } else {
                console.log(`⚠️  ${result.status}`);
            }
        }

        // Summary
        console.log('\n' + '━'.repeat(70));
        console.log('SUMMARY');
        console.log('━'.repeat(70) + '\n');

        const okTests = results.filter(r => r.status === 'OK').length;
        const emptyTests = results.filter(r => r.status === 'EMPTY').length;
        const errorTests = results.filter(r => r.status === 'ERROR' || r.status === 'EXCEPTION').length;

        console.log(`✅ Working: ${okTests}`);
        console.log(`❌ Empty: ${emptyTests}`);
        console.log(`⚠️  Error: ${errorTests}`);
        console.log();

        if (okTests === 0) {
            console.log('🔴 CRITICAL: NO HTML variants produce content!');
            console.log('   This means the rendering engine is completely broken.');
        } else if (emptyTests > 0) {
            console.log('🟡 PARTIAL: Some HTML variants work, some don\'t:');
            results.forEach(r => {
                if (r.status === 'EMPTY') {
                    console.log(`   ❌ ${r.name}`);
                }
            });
        } else {
            console.log('🟢 ALL VARIANTS WORK!');
        }

        console.log('\n' + '━'.repeat(70));

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

runTests();
