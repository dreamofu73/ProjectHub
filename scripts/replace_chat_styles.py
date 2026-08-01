import re

files = [
    'apps/web/src/pages/Chat.tsx',
    'apps/web/src/components/layout/Sidebar.tsx'
]

replacements = [
    (r'bg-white dark:bg-slate-900', r'bg-[var(--bg-surface)]'),
    (r'bg-slate-50 dark:bg-slate-800(?:/40|/50)?', r'bg-[var(--bg-surface-2)]'),
    (r'bg-slate-100 dark:bg-slate-800(?:/50)?', r'bg-[var(--bg-surface-2)]'),
    (r'hover:bg-slate-100 dark:hover:bg-slate-800(?:/50)?', r'hover:bg-[var(--bg-surface-2)]'),
    
    (r'text-slate-900 dark:text-white', r'text-[var(--text-primary)]'),
    (r'text-slate-800 dark:text-slate-100', r'text-[var(--text-primary)]'),
    (r'hover:text-slate-800 dark:hover:text-slate-200', r'hover:text-[var(--text-primary)]'),
    
    (r'text-slate-600 dark:text-slate-300', r'text-[var(--text-secondary)]'),
    (r'text-slate-600 dark:text-slate-400', r'text-[var(--text-secondary)]'),
    
    (r'text-slate-500 dark:text-slate-400', r'text-[var(--text-muted)]'),
    (r'text-slate-400 dark:text-slate-500', r'text-[var(--text-muted)]'),
    (r'text-slate-400 dark:text-slate-600', r'text-[var(--text-muted)]'),
    (r'text-slate-300 dark:text-slate-700', r'text-[var(--text-muted)]'),
    (r'text-slate-300 dark:text-slate-600', r'text-[var(--text-muted)]'),
    
    (r'border-slate-200 dark:border-slate-800', r'border-[var(--border)]'),
    (r'border-slate-100 dark:border-slate-800', r'border-[var(--border)]'),
    (r'border-slate-200 dark:border-slate-700/60', r'border-[var(--border)]'),
    
    # Active/Inactive sidebar classes
    (r'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300', r'bg-[var(--primary)]/10 text-[var(--primary)]'),
    (r'text-indigo-600 dark:text-indigo-400', r'text-[var(--primary)]'),
    (r'bg-indigo-50 dark:bg-indigo-950/30', r'bg-[var(--primary)]/10'),
    (r'hover:text-indigo-500', r'hover:text-[var(--primary)]'),
    (r'hover:bg-indigo-50 dark:hover:bg-indigo-950/30', r'hover:bg-[var(--primary)]/10'),
    (r'text-indigo-500', r'text-[var(--primary)]'),
    (r'bg-indigo-600', r'bg-[var(--primary)]'),
    (r'hover:bg-indigo-700', r'hover:bg-[var(--primary)]'),
    (r'border-indigo-500', r'border-[var(--primary)]'),
    (r'border-indigo-300 dark:border-indigo-700', r'border-[var(--primary)]'),
    (r'focus-within:border-indigo-400 dark:focus-within:border-indigo-600/60', r'focus-within:border-[var(--primary)]'),
    (r'focus-within:ring-indigo-500/10', r'focus-within:ring-[var(--primary)]/10'),
]

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
        
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(file_path, 'w') as f:
        f.write(content)

print("Done replacing styles.")
