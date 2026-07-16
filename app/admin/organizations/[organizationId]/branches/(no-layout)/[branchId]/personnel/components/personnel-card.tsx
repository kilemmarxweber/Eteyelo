import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CardHeader, CardContent, Card } from "@/components/ui/card";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { ITeaching } from "@/src/interfaces/Teaching";
import Link from "next/link";

interface UserCardProps {
  personnel: IPersonnel;
  child: ITeaching[];
}

export function UserCard({ personnel, child }: UserCardProps) {
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
            <AvatarImage src={KLAMBOCORE_DEFAULT_IMAGE_PATH} alt="User Avatar" />
            <AvatarFallback>{personnel.nom[0]}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="text-xl font-semibold text-primary">
              {`${personnel.prenom} ${personnel.nom} ${personnel.postnom} `.toUpperCase()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold">E-mail : </span>
              <Link
                className="text-primary underline-offset-4 hover:underline capitalize"
                href={`mailto:${personnel.email}`}
              >
                {personnel.email}
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Enregistré le : </span>{" "}
              {personnel.createdAt.toLocaleDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Date de naissance : </span>{" "}
              {personnel.dateOfBirth.toDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold"> Numero de telephone : </span>{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline capitalize"
                href={`tel:+243${personnel.telephone}`}
              >
                {`${personnel.telephone}`}
              </Link>
            </div>
            {/* <div className="text-sm text-muted-foreground">
                Address: {user.}
              </div> */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-8 p-6">
        {/* <div>
            <div className="mb-4 font-semibold">Enfants</div>
            <div className="grid gap-4">
              {personnel.teaching.map((child: ITeaching, index: number) => (
                <div key={index}>
                  <div
                    key={child.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={"/avatars/01.png"} alt={`Avatar`} />
                        <AvatarFallback>
                          {child.[0].toLocaleUpperCase()}
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
                  <Separator className="mt-3" />
                </div>
              ))}
            </div>
          </div> */}
        {/* <div>
            <div className="mb-4 font-semibold">Derniers Paiements</div>
            <div className="grid gap-4">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid gap-0.5">
                      <div className="font-medium">{payment.title}</div>
                      <div className="text-sm text-muted-foreground">
                        Paid on {payment.date}
                      </div>
                    </div>
                  </div>
                  <div className="font-medium">{payment.amount}</div>
                </div>
              ))}
            </div>
          </div> */}
      </CardContent>
    </Card>
  );
}
