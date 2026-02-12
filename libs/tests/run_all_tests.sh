#!/bin/bash
#
# Run all PrintPDF WASM debugging tests
# Usage: ./run_all_tests.sh
#

set -e

echo "🧪 PrintPDF WASM Debugging Test Suite"
echo "======================================"
echo ""

TESTS=(
    "test_simple_html.js:Simple HTML Test"
    "test_official_html.js:Official HTML Test"
    "test_configurations.js:Configuration Variants"
    "test_conversion_pipeline.js:Full Conversion Pipeline"
    "test_html_variants.js:HTML Variants (18 variants)"
)

failed=0
passed=0

for test_info in "${TESTS[@]}"; do
    IFS=':' read -r test_file test_name <<< "$test_info"
    
    if [ ! -f "$test_file" ]; then
        echo "❌ SKIP: $test_file not found"
        continue
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if node "$test_file"; then
        ((passed++))
    else
        ((failed++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Run Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Tests executed: ${#TESTS[@]}"
echo "✅ Passed: $passed"
echo "❌ Failed: $failed"
echo ""

if [ -f "test_output.pdf" ]; then
    echo "📄 Generated files:"
    ls -lh test_*.pdf test_*_output.json 2>/dev/null || true
    echo ""
fi

echo "📖 For more information, see TEST_GUIDE.md"
echo ""
