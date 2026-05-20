with open('apps/web/components/ui/BottomTabBar.tsx', 'rb') as f:
    data = f.read(500)

text = data.decode('utf-8')
lines = text.split('\n')
for line in lines:
    if 'label' in line:
        # extract label value between quotes after "label: "
        idx = line.find('label: "')
        if idx >= 0:
            start = idx + 8
            end = line.find('"', start)
            val = line[start:end]
            codepoints = [hex(ord(c)) for c in val]
            print('label:', codepoints)
