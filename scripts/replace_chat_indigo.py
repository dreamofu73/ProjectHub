import re

file_path = 'apps/web/src/pages/Chat.tsx'

with open(file_path, 'r') as f:
    content = f.read()

replacements = [
    (r'bg-indigo-50 dark:bg-indigo-950/50', r'bg-[var(--primary)]/10'),
    (r'bg-indigo-50 dark:bg-indigo-950/20', r'bg-[var(--primary)]/10'),
    (r'border-indigo-100 dark:border-indigo-900/40', r'border-[var(--primary)]/20'),
    (r'bg-indigo-100 dark:bg-indigo-900/40', r'bg-[var(--primary)]/20'),
    (r'bg-indigo-500', r'bg-[var(--primary)]'),
    (r'hover:text-indigo-600 dark:hover:text-indigo-400', r'hover:text-[var(--primary)]'),
    (r'border-indigo-500', r'border-[var(--primary)]')
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open(file_path, 'w') as f:
    f.write(content)

print("Done.")
