"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Teacher = {
  id: string;
  name: string;
};

type Props = {
  teachers: Teacher[];
  value: string | null;
  onChange: (value: string) => void;
};

export function TeacherCombobox({ teachers, value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  const selectedTeacher = teachers.find((t) => t.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full md:w-80 justify-between"
        >
          {selectedTeacher ? selectedTeacher.name : "Choisir un enseignant"}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full md:w-80 p-0">
        <Command>
          <CommandInput placeholder="Rechercher un enseignant..." />
          <CommandEmpty>Aucun enseignant trouvé.</CommandEmpty>
          <CommandGroup>
            {teachers.map((teacher) => (
              <CommandItem
                key={teacher.id}
                value={teacher.name}
                onSelect={() => {
                  onChange(teacher.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-1",
                    value === teacher.id ? "opacity-100" : "opacity-0",
                  )}
                />
                {teacher.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
