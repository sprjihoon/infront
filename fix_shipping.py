import re

path = "apps/web/app/(main)/shipping-request/page.tsx"
with open(path, "rb") as f:
    raw = f.read()

# Detect BOM
if raw.startswith(b"\xef\xbb\xbf"):
    bom = b"\xef\xbb\xbf"
    text = raw[3:].decode("utf-8")
else:
    bom = b""
    text = raw.decode("utf-8")

# 1. Remove "견적 확인" from STEP_LABELS
text = text.replace(
    '["물품 확인", "배송 옵션", "해외 배송지", "인보이스", "견적 확인"]',
    '["물품 확인", "배송 옵션", "해외 배송지", "인보이스"]'
)

# 2. Remove estimatedFee and quoteLoading state lines
text = re.sub(r'  const \[estimatedFee, setEstimatedFee\] = useState<number \| null>\(null\);\n', '', text)
text = re.sub(r'  const \[quoteLoading, setQuoteLoading\] = useState\(false\);\n', '', text)

# 3. Remove fetchQuote callback and its useEffect
text = re.sub(
    r'  // EMS 견적 조회\n  const fetchQuote = useCallback.*?}, \[overseasAddress, parcels, shippingMethod\]\);\n\n  useEffect\(\) => \{\n    if \(step === 5\) fetchQuote\(\);\n  }, \[step, fetchQuote\]\);\n',
    '',
    text,
    flags=re.DOTALL
)
# Fallback: simpler pattern
text = re.sub(
    r'  // EMS 견적 조회\n  const fetchQuote[\s\S]*?}\), \[overseasAddress, parcels, shippingMethod\]\);\n\n  useEffect\(\(\) => \{\n    if \(step === 5\) fetchQuote\(\);\n  \}, \[step, fetchQuote\]\);\n',
    '',
    text
)

# 4. Remove totalAmount line (only used in step 5)
text = re.sub(r'  const totalAmount = \(estimatedFee \?\? 0\) \+ packagingFee;\n', '', text)

# 5. change step < 5 to step < 4
text = text.replace('step < 5 ? (', 'step < 4 ? (')

# 6. Change estimated_shipping_fee
text = text.replace('estimated_shipping_fee: estimatedFee ?? 0,', 'estimated_shipping_fee: 0,')

# 7. Remove step 5 JSX block
text = re.sub(
    r"        \{/\* ── Step 5: 견적 확인 ─+? \*/\}\n        \{step === 5 && \([\s\S]*?\n        \)\}\n",
    '',
    text
)

# 8. Update the amber note in step 1
text = text.replace(
    '사전 견적을 안내해드립니다.',
    '포장 완료 후 실제 비용을 안내해드립니다.'
)

# 9. Update useCallback import - remove unused if needed
# (skip for now, linter can handle)

out = bom + text.encode("utf-8")
with open(path, "wb") as f:
    f.write(out)

print("done:", path)
