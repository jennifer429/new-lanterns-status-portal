import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Type-ahead vendor picker. Filters the picklist case-insensitively as you
 * type, and offers to add a brand-new vendor when nothing matches.
 *
 * - `onSelect` fires when an existing option is chosen.
 * - `onAddNew` fires when the user adds a value not already in the list; the
 *   parent is responsible for persisting it to the vendor picklist.
 */
export function VendorCombobox({
  value,
  options,
  placeholder,
  onSelect,
  onAddNew,
  disabled,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onSelect: (v: string) => void;
  onAddNew: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmed = search.trim();
  // Case-insensitive substring match — autopopulates the list as you type.
  const filtered = options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()));
  const exactExists = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const showAdd = trimmed.length > 0 && !exactExists;

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex flex-1 h-8 items-center justify-between text-sm text-left rounded-md border border-input bg-background/50 px-2 text-foreground",
            "hover:bg-background/70 focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px]" align="start">
        {/* shouldFilter={false}: we filter manually so matching is always
            plain case-insensitive substring, never cmdk's fuzzy scoring. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a vendor…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && !showAdd && (
              <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                {trimmed ? "No match" : "Type to search"}
              </CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onSelect(opt);
                      close();
                    }}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", value === opt ? "opacity-100" : "opacity-0")} />
                    <span className="text-sm">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showAdd && (
              <CommandGroup>
                <CommandItem
                  value={`__add__${trimmed}`}
                  onSelect={() => {
                    onAddNew(trimmed);
                    close();
                  }}
                >
                  <PlusCircle className="mr-2 h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">Add &quot;{trimmed}&quot;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
