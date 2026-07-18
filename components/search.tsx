import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchProps = {
  className?: string;
};

export function Search({ className }: SearchProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <Input
        type="search"
        placeholder="Rechercher..."
        className="h-9 w-full min-w-0 text-sm md:w-[100px] md:text-base lg:w-[300px]"
      />
    </div>
  );
}
