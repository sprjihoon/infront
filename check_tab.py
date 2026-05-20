with open('apps/web/components/ui/BottomTabBar.tsx', 'rb') as f:
    data = f.read(400)

text = data.decode('utf-8')
lines = text.split('\n')
for line in lines:
    if 'label' in line:
        print(repr(line))
