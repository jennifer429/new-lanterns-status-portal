import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Combobox — inline-styled, no chrome until open ────────────────────────────
export function InlineCombobox({
  value, onChange, options, placeholder, popoverWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  popoverWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  const showAdd = search.trim() && !options.some(s => s.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between text-xs text-left',
            'bg-transparent border-none outline-none rounded px-1.5 py-1 min-h-[28px]',
            'hover:bg-primary/5 focus:bg-primary/5 transition-colors',
            !value && 'text-muted-foreground/35'
          )}
        >
          <span className="flex-1 leading-snug break-words">{value || placeholder}</span>
          <ChevronsUpDown className="ml-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', popoverWidth || 'w-[220px]')} align="start">
        <Command>
          <CommandInput placeholder="Search or type..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {search.trim() ? 'No match' : 'Type to search'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(opt => (
                <CommandItem key={opt} value={opt}
                  onSelect={() => { onChange(opt); setOpen(false); setSearch(''); }}>
                  <Check className={cn('mr-2 h-3 w-3', value === opt ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-xs">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showAdd && (
              <CommandGroup>
                <CommandItem value={`__add__${search.trim()}`}
                  onSelect={() => { onChange(search.trim()); setOpen(false); setSearch(''); }}>
                  <PlusCircle className="mr-2 h-3 w-3 text-primary" />
                  <span className="text-xs">Add "{search.trim()}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
