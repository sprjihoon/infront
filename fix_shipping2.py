import re

path = "apps/web/app/(main)/shipping-request/page.tsx"
with open(path, "rb") as f:
    raw = f.read()

bom = b"\xef\xbb\xbf" if raw.startswith(b"\xef\xbb\xbf") else b""
text = raw[len(bom):].decode("utf-8")

# Remove fetchQuote function and useEffect
text = re.sub(
    r'\n  // EMS 견적 조회\n  const fetchQuote = useCallback[\s\S]*?\}, \[overseasAddress, parcels, shippingMethod\]\);\n\n  useEffect\(\(\) => \{\n    if \(step === 5\) fetchQuote\(\);\n  \}, \[step, fetchQuote\]\);\n',
    '\n',
    text
)

# Also remove unused imports: Box, Shield (only used in step 5)
text = re.sub(r',\s*Box\b', '', text)
text = re.sub(r',\s*Shield\b', '', text)

# Add error display after step 4 items section (before </> closing)
# Find the step 4 closing and add error display before it
step4_close = '          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">\n              <span className="text-sm text-gray-600">총 신고 금액</span>\n              <span className="text-sm font-bold text-gray-900">USD {customsValue.toFixed(2)}</span>\n            </div>\n          </>\n        )}'
step4_close_new = '          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">\n              <span className="text-sm text-gray-600">총 신고 금액</span>\n              <span className="text-sm font-bold text-gray-900">USD {customsValue.toFixed(2)}</span>\n            </div>\n\n            {error && (\n              <div className="bg-red-50 rounded-xl px-4 py-3">\n                <p className="text-xs text-red-600">{error}</p>\n              </div>\n            )}\n          </>\n        )}'
text = text.replace(step4_close, step4_close_new)

with open(path, "wb") as f:
    f.write(bom + text.encode("utf-8"))

print("done")
