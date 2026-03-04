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

  /** Static options mode */
  options?: Option[];

  /** Async mode: called whenever user types (debounced) */
  onSearch?: (query: string) => Promise<Option[]>;

  /** Placeholder text */
  placeholder?: string;

  /** Debounce time in ms (default 400ms) */
  debounce?: number;

  className?: string;
}

export function SearchableSingleSelectAsync({
  value,
  onChange,
  options = [],
  onSearch,
  placeholder = "Search...",
  debounce = 400,
  className,
}: SearchableSingleSelectAsyncProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [displayOptions, setDisplayOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);

  const selected = displayOptions.find((o) => o.value === value);

  /** Debounce async logic */
  React.useEffect(() => {
    if (!open || !onSearch) return;

    const handler = setTimeout(async () => {
      setLoading(true);
      const results = await onSearch(searchTerm);
      setDisplayOptions(results);
      setLoading(false);
    }, debounce);

    return () => clearTimeout(handler);
  }, [searchTerm, onSearch, open, debounce]);

  React.useEffect(() => {
    if (onSearch) return;
    const query = searchTerm.trim().toLowerCase();
    const nextOptions = query
      ? options.filter((option) => option.label.toLowerCase().includes(query))
      : options;
    setDisplayOptions(nextOptions);
  }, [onSearch, options, searchTerm]);

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

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
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
                  {displayOptions.map((opt) => (
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
