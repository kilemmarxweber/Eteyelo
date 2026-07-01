import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardHeader, CardContent, Card } from "@/components/ui/card";
import { IconChevronRight } from "@tabler/icons-react";
import { IParent } from "@/src/interfaces/Parent";
import { IStudent } from "@/src/interfaces/Student";
import Link from "next/link";

interface UserCardProps {
  parent: IParent;
  childs: IStudent[];
  payments: Array<{
    title: string;
    date: string;
    amount: string;
  }>;
}

export function UserCard({ parent, childs, payments }: UserCardProps) {
  function calculateAge(dateOfBirth: Date): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
  return (
    <Card>
      <CardHeader className="bg-muted/50 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src="/placeholder-user.jpg" alt="User Avatar" />
            <AvatarFallback>{parent.nom[0]}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="text-xl font-semibold text-primary">
              {`${parent.prenom} ${parent.nom} ${parent.postnom} `.toUpperCase()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold">E-mail : </span>
              <Link
                className="text-primary underline-offset-4 hover:underline capitalize"
                href={`mailto:${parent.email}`}
              >
                {parent.email}
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Enregistré le : </span>{" "}
              {parent.createdAt.toLocaleDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Date de naissance : </span>{" "}
              {parent.dateOfBirth.toDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Numero de telephone : </span>{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline capitalize"
                href={`tel:+243${parent.telephone}`}
              >
                {`${parent.telephone}`}
              </Link>
            </div>
            {/* <div className="text-sm text-muted-foreground">
              Address: {user.}
            </div> */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-8 p-6">
        <div>
          <div className="mb-4 font-semibold">Enfants</div>
          <div className="grid gap-4">
            {parent.students?.map((child: IStudent, index: number) => (
              <div key={index}>
                <div
                  key={child.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={"/avatars/01.png"} alt={`Avatar`} />
                      <AvatarFallback>
                        {child.nom[0].toLocaleUpperCase()}
                        {(child.prenom?.[0] ?? "").toLocaleUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5">
                      <div className="font-medium">{`${child.prenom} ${child.nom}`}</div>
                      <div className="text-sm text-muted-foreground">
                        {`${calculateAge(child.dateOfBirth)} ans`}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <IconChevronRight className="h-4 w-4" />
                    <span className="sr-only">View child details</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
