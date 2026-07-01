"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  IconBook,
  IconChevronLeft,
  IconChevronRight,
  IconSchool,
} from "@tabler/icons-react";
import { IOption } from "@/src/interfaces/Option"; // Assurez-vous que c'est le bon chemin d'importation
import { getOptionsAction } from "../../option/option.action";

export function OptionSidebar() {
  const [options, setOptions] = useState<IOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 5;
  const router = useRouter();

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [rawOptions, err] = await getOptionsAction();
        if (err) {
          throw new Error("Failed to fetch options");
        }

        setOptions(rawOptions);
        setLoading(false);
      } catch (error) {
        console.error("Échec de récupérer les options", error);
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  const handleClassClick = (optionSlug: string, classId: string) => {
    router.push(`/admin/classEnrollment/${classId}`);
  };
  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  const paginatedOptions = options.slice(start, end);
  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <Accordion collapsible type="single" className="w-full">
      {/* Pagination */}
      {options.length > ITEMS_PER_PAGE && (
        <div className="flex justify-between items-center px-4 py-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconChevronLeft size={16} />
          </button>

          {/* Page indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-muted">{page + 1}</span>
            <span className="text-muted-foreground">
              / {Math.ceil(options.length / ITEMS_PER_PAGE)}
            </span>
          </div>

          <button
            disabled={end >= options.length}
            onClick={() => setPage((prev) => prev + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      )}
      {paginatedOptions.map((option) => (
        <AccordionItem value={option.id} key={option.id}>
          <AccordionTrigger className="px-4 py-2 hover:bg-muted/50 transition-colors">
            <div className="flex items-center w-full">
              <IconSchool className="mr-2 h-4 w-4" />
              <span>{option.nameOption}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="py-2">
              {option.classes?.map((classe) => (
                <li key={classe.id}>
                  <button
                    onClick={() => handleClassClick(option.id, classe.id)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full text-left"
                  >
                    <IconBook className="mr-2 h-4 w-4" />
                    <span>{classe.nameClasse}</span>
                  </button>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
