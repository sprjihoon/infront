with open('apps/web/components/ui/BottomTabBar.tsx', 'rb') as f:
    data = f.read(600)

text = data.decode('utf-8')
lines = text.split('\n')
for line in lines:
    if 'label' in line or 'href' in line:
        if 'TABS' not in line and 'import' not in line and 'className' not in line:
            print(repr(line))
