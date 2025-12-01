"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface Option {
  value: string;
  label: string;
}

interface SearchableSingleSelectAsyncProps {
  value?: string;
  onChange: (value: string) => void;

  /** Called whenever user types (debounced) */
  onSearch: (query: string) => Promise<Option[]>;

  /** Placeholder text */
  placeholder?: string;

  /** Debounce time in ms (default 400ms) */
  debounce?: number;

  className?: string;

  optionsProps?: Option[];
}

export function SearchableSingleSelectAsync({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  debounce = 400,
  className,
}: SearchableSingleSelectAsyncProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [options, setOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);

  const selected = options.find((o) => o.value === value);

  /** Debounce logic */
  React.useEffect(() => {
    if (!open) return;

    const handler = setTimeout(async () => {
      setLoading(true);
      const results = await onSearch(searchTerm);
      setOptions(results);
      setLoading(false);
    }, debounce);

    return () => clearTimeout(handler);
  }, [searchTerm, onSearch, open, debounce]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between", className)}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 size-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." onValueChange={setSearchTerm} />

          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          opt.value === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
