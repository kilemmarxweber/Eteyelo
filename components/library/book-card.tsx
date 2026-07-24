"use client";

import Link from "next/link";
import { BookOpen, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LibraryBookCardData = {
  id: string;
  title: string;
  author: string | null;
  publisher?: string | null;
  description: string | null;
  coverImage: string | null;
  fileType: "PDF" | "EPUB";
  language: string;
  cycle: "PRIMAIRE" | "SECONDAIRE" | "HUMANITES" | null;
  level: string | null;
  section: string | null;
  subject: string | null;
  category: string | null;
  tags: string[];
  viewCount: number;
  createdAt: string;
};

const cycleLabel: Record<string, string> = {
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  HUMANITES: "Humanités",
};

type BookCardProps = {
  book: LibraryBookCardData;
  href: string;
  className?: string;
};

export function BookCard({ book, href, className }: BookCardProps) {
  return (
    <Card
      className={cn(
        "group overflow-hidden border-border/80 transition hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {book.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImage}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-background to-primary/5 text-primary">
            <BookOpen className="size-10 opacity-70" />
            <span className="text-xs font-medium uppercase tracking-wide opacity-70">
              {book.fileType}
            </span>
          </div>
        )}
        <Badge className="absolute top-3 right-3 gap-1 shadow-sm" variant="secondary">
          {book.fileType === "PDF" ? (
            <FileText className="size-3" />
          ) : (
            <BookOpen className="size-3" />
          )}
          {book.fileType}
        </Badge>
      </div>

      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="line-clamp-2 text-base leading-snug">
          {book.title}
        </CardTitle>
        <CardDescription className="line-clamp-1">
          {book.author || "Auteur non renseigné"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-1.5 pb-3">
        {book.cycle ? (
          <Badge variant="outline">{cycleLabel[book.cycle] ?? book.cycle}</Badge>
        ) : null}
        {book.level ? <Badge variant="outline">{book.level}</Badge> : null}
        {book.subject ? (
          <Badge variant="outline">{book.subject}</Badge>
        ) : null}
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full" variant="default">
          <Link href={href}>Lire</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
