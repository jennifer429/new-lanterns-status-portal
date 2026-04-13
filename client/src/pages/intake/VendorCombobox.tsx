import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VendorComboboxProps {
  vendors: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function VendorCombobox({
  vendors,
  value,
  onChange,
  placeholder = "Select vendor...",
}: VendorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  // Filter vendors that aren't "Other" (we handle custom entry differently)
  const filteredVendors = vendors.filter((v) => v !== "Other");

  // Check if the search term matches an existing vendor (case-insensitive)
  const searchTrimmed = search.trim();
  const exactMatch = filteredVendors.some(
    (v) => v.toLowerCase() === searchTrimmed.toLowerCase()
  );

  const handleSelect = (vendor: string) => {
    onChange(vendor);
    setSearch("");
    setOpen(false);
  };

  const handleAddCustom = () => {
    if (searchTrimmed) {
      onChange(searchTrimmed);
      setSearch("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          className="flex-1 h-8 text-sm rounded-md border border-input bg-background/50 px-2 text-left flex items-center justify-between gap-1 min-w-0"
        >
          <span
            className={cn(
              "truncate",
              !value && "text-muted-foreground"
            )}
          >
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={triggerWidth ? { width: triggerWidth } : undefined}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              {searchTrimmed ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-accent rounded-sm justify-center text-purple-400"
                  onClick={handleAddCustom}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add "{searchTrimmed}"
                </button>
              ) : (
                "No vendors found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredVendors
                .filter(
                  (v) =>
                    !searchTrimmed ||
                    v.toLowerCase().includes(searchTrimmed.toLowerCase())
                )
                .map((vendor) => (
                  <CommandItem
                    key={vendor}
                    value={vendor}
                    onSelect={() => handleSelect(vendor)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        value === vendor ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {vendor}
                  </CommandItem>
                ))}
              {/* Show "Add custom" option when search doesn't exactly match an existing vendor */}
              {searchTrimmed && !exactMatch && (
                <CommandItem
                  value={`__add__${searchTrimmed}`}
                  onSelect={handleAddCustom}
                  className="text-purple-400"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add "{searchTrimmed}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
