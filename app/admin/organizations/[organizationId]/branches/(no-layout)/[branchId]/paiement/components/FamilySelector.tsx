"use client";

import { useEffect, useRef, useState } from "react";
import { searchFamilyAction, Family, StudentItem } from "../paiement.action";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSchoolYearsAction1 } from "../../schoolYear/schoolYear.action";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";

interface Props {
  onChange: (data: {
    parentId: string;
    classEnrollIds: string[];
    schoolYearId: string;
  }) => void;
  resetKey?: number;
}

export default function FamilySelector({ onChange, resetKey }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Family[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeParent, setActiveParent] = useState<string>("");

  const [schoolYear, setSchoolYear] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const { data: session } = useSession();
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  const didMountRef = useRef(false);
  // ================= SEARCH =================
  const handleSearch = async (value: string) => {
    setSearch(value);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    const data = await searchFamilyAction(value);
    setResults(data);
  };

  // ================= TOGGLE STUDENT =================
  const toggleStudent = (parentId: string, child: StudentItem) => {
    const id = child.classEnrollId;

    let updated: string[];

    if (selected.includes(id)) {
      updated = selected.filter((s) => s !== id);
    } else {
      updated = [...selected, id];
    }

    setSelected(updated);
    setActiveParent(parentId);

    onChange({
      parentId,
      classEnrollIds: updated,
      schoolYearId: schoolYear, // ✅ AJOUT
    });
  };

  // ================= SELECT ALL FAMILY =================
  const selectAll = (family: Family) => {
    const ids = family.students
      .filter((s) => s.schoolYearId === schoolYear) // ✅ FIX IMPORTANT
      .map((s) => s.classEnrollId);

    setSelected(ids);
    setActiveParent(family.parent.id);

    onChange({
      parentId: family.parent.id,
      classEnrollIds: ids,
      schoolYearId: schoolYear, // ✅ AJOUT
    });
  };

  // ================= CLEAR =================
  const clearAll = () => {
    setSelected([]);
    setActiveParent("");

    onChange({
      parentId: "",
      classEnrollIds: [],
      schoolYearId: schoolYear, // ✅ AJOUT
    });
  };

  // ================= LOAD SCHOOL YEARS =================
  useEffect(() => {
    const loadYears = async () => {
      if (!branchId) return;
      const [data, error] = await getSchoolYearsAction1({ branchId });

      if (error || !data) return;

      setSchoolYears(data);

      const current = data.find((y) => y.isCurrentYear);

      setSchoolYear(current?.id ?? data[0]?.id ?? "");
    };

    loadYears();
  }, [branchId]);

  useEffect(() => {
    if (!activeParent) return;

    onChange({
      parentId: activeParent,
      classEnrollIds: selected,
      schoolYearId: schoolYear,
    });
  }, [schoolYear]);

  useEffect(() => {
    if (resetKey === undefined) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setSearch("");
    setResults([]);
    setSelected([]);
    setActiveParent("");

    onChange({
      parentId: "",
      classEnrollIds: [],
      schoolYearId: schoolYear,
    });
  }, [resetKey]);

  // ================= UI =================
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* ================= SIDEBAR ================= */}

      {/* ================= MAIN ================= */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          {/* YEAR (LEFT) */}
          <div className="w-[180px]">
            <Select value={schoolYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="sm:w-[150px] h-9 text-sm">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>

              <SelectContent>
                {schoolYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.nameYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SEARCH (RIGHT) */}
          <Input
            placeholder="🔍 Rechercher parent ou élève..."
            className="flex-1 h-9 text-sm"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* ================= RESULTS ================= */}
        <div className="flex flex-col gap-3">
          {results.map((family) => (
            <div
              key={family.parent.id}
              className="border rounded-lg p-4 shadow-sm"
            >
              {/* HEADER CARD */}
              <div className="flex justify-between items-center font-bold mb-2">
                <span>
                  👨‍👩‍👧 {family.parent.prenom} {family.parent.nom}
                </span>

                <div className="flex gap-2">
                  {/* SELECT ALL */}
                  <button
                    type="button"
                    onClick={() => selectAll(family)}
                    className="p-1 rounded hover:bg-green-50 text-green-600"
                    title="Tout sélectionner"
                  >
                    <Check size={16} />
                  </button>

                  {/* CLEAR */}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="p-1 rounded hover:bg-red-50 text-red-500"
                    title="Effacer la sélection"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* STUDENTS */}
              <div className="space-y-2">
                {family.students
                  .filter((child) => child.schoolYearId === schoolYear)
                  .map((child) => {
                    const checked = selected.includes(child.classEnrollId);

                    return (
                      <label
                        key={child.classEnrollId}
                        className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleStudent(family.parent.id, child)
                          }
                        />

                        <span className="flex-1">
                          {child.prenom} {child.nom} - {child.codeClasse}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
