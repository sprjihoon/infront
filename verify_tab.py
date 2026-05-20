with open('apps/web/components/ui/BottomTabBar.tsx', 'rb') as f:
    data = f.read(600)

text = data.decode('utf-8')
import re
for m in re.finditer(r'href: "([^"]+)",\s+label: "([^"]+)"', text):
    href = m.group(1)
    label = m.group(2)
    codepoints = [hex(ord(c)) for c in label]
    print(f'href={href!r} label_codepoints={codepoints}')
