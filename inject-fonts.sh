#!/bin/bash
cd libs/printpdf
# Base64 encode fonts for WASM (no filesystem access)
HELVETICA_B64=$(base64 -w0 -i examples/assets/fonts/Helvetica.ttf -o -)
HELVETICA_BOLD_B64=$(base64 -w0 -i examples/assets/fonts/Helvetica-Bold.ttf -o -)
HELVETICA_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Helvetica-Oblique.ttf -o -)
HELVETICA_BOLD_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Helvetica-BoldOblique.ttf -o -)
TIMES_B64=$(base64 -w0 -i examples/assets/fonts/Times.ttf -o -)
TIMES_BOLD_B64=$(base64 -w0 -i examples/assets/fonts/Times-Bold.ttf -o -)
TIMES_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Times-Oblique.ttf -o -)
TIMES_BOLD_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Times-BoldOblique.ttf -o -)
COURIER_B64=$(base64 -w0 -i examples/assets/fonts/Courier.ttf -o -)
COURIER_BOLD_B64=$(base64 -w0 -i examples/assets/fonts/Courier-Bold.ttf -o -)
COURIER_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Courier-Oblique.ttf -o -)
COURIER_BOLD_OBLIQUE_B64=$(base64 -w0 -i examples/assets/fonts/Courier-BoldOblique.ttf -o -)
NOTO_SANS_JP_B64=$(base64 -w0 -i examples/assets/fonts/NotoSansJP-Regular.otf -o -)
ROBOTO_B64=$(base64 -w0 -i examples/assets/fonts/RobotoMedium.ttf -o -)

# Create the font object content
FONT_OBJECT="\"Helvetica.ttf\": \"$HELVETICA_B64\",
    \"Helvetica-Bold.ttf\": \"$HELVETICA_BOLD_B64\",
    \"Helvetica-Oblique.ttf\": \"$HELVETICA_OBLIQUE_B64\",
    \"Helvetica-BoldOblique.ttf\": \"$HELVETICA_BOLD_OBLIQUE_B64\",
    \"Times.ttf\": \"$TIMES_B64\",
    \"Times-Bold.ttf\": \"$TIMES_BOLD_B64\",
    \"Times-Oblique.ttf\": \"$TIMES_OBLIQUE_B64\",
    \"Times-BoldOblique.ttf\": \"$TIMES_BOLD_OBLIQUE_B64\",
    \"Courier.ttf\": \"$COURIER_B64\",
    \"Courier-Bold.ttf\": \"$COURIER_BOLD_B64\",
    \"Courier-Oblique.ttf\": \"$COURIER_OBLIQUE_B64\",
    \"Courier-BoldOblique.ttf\": \"$COURIER_BOLD_OBLIQUE_B64\",
    \"NotoSansJP-Regular.otf\": \"$NOTO_SANS_JP_B64\",
    \"RobotoMedium.ttf\": \"$ROBOTO_B64\""

# Replace the placeholder in script.js
# Use a temp file approach to handle large base64 strings
python3 << EOF
import re

with open('script.js', 'r') as f:
    content = f.read()

# Replace the DEFAULT_FONTS placeholder
font_object = '''$FONT_OBJECT'''
new_content = re.sub(
    r'const DEFAULT_FONTS = \{[^}]*\};',
    'const DEFAULT_FONTS = {\n    ' + font_object + '\n};',
    content,
    flags=re.DOTALL
)

with open('script.js', 'w') as f:
    f.write(new_content)

print("Fonts injected successfully")
EOF