import { School } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceProps } from "@/src/interfaces/Paiement";

function convertToWords(number: number) {
  const units = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
  ];
  const teens = [
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  const tens = [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante-dix",
    "quatre-vingt",
    "quatre-vingt-dix",
  ];

  if (number === 0) return "zéro";

  function convertLessThanOneThousand(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const unit = n % 10;
      const ten = Math.floor(n / 10);
      return tens[ten] + (unit ? "-" + units[unit] : "");
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return (
      (hundred > 1 ? units[hundred] + " cents" : "cent") +
      (remainder ? " " + convertLessThanOneThousand(remainder) : "")
    );
  }

  const parts = [];
  let remaining = Math.floor(number);

  if (remaining >= 1000000) {
    const millions = Math.floor(remaining / 1000000);
    parts.push(
      millions > 1
        ? convertLessThanOneThousand(millions) + " millions"
        : "un million",
    );
    remaining %= 1000000;
  }

  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    parts.push(
      thousands > 1
        ? convertLessThanOneThousand(thousands) + " mille"
        : "mille",
    );
    remaining %= 1000;
  }

  if (remaining > 0) {
    parts.push(convertLessThanOneThousand(remaining));
  }

  return parts.join(" ");
}

export function Invoice({
  studentName,
  schoolName,
  schoolAddress,
  schoolContact,
  schoolEmail,
  paymentDate,
  financierName,
  fees,
  invoiceNumber,
}: InvoiceProps) {
  const totalAmount = fees.reduce(
    (sum, fee) => sum + parseFloat(fee.amountPaid || "0"),
    0,
  );

  return (
    <Card className="flex-1 w-[750px]">
      <CardHeader>
        <CardTitle>Aperçu de la facture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-blue-50 p-8 rounded-lg shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-14 border-b pb-4 p-4 rounded-t-lg border-gray-300">
            <div className="flex items-center space-x-4">
              <School className="h-12 w-12 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">{schoolName}</h2>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-semibold text-gray-800">
                Facture #{invoiceNumber}
              </h3>
              <p className="text-sm text-gray-500">Date: {paymentDate}</p>
            </div>
          </div>

          <div className="mb-8">
            <h4 className="font-semibold text-gray-700 mb-2">
              Détails de l'élève
            </h4>
            <p className="font-medium text-gray-700">
              <span className="font-medium">Nom:</span> {studentName}
            </p>
          </div>

          <div className="mb-8">
            <h4 className="font-semibold text-gray-700 mb-2">
              Détails du paiement
            </h4>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300 font-medium text-gray-700">
                  <th className="text-left py-2">Frais</th>
                  <th className="text-left py-2">Classe</th>
                  <th className="text-left py-2">Année scolaire</th>
                  <th className="text-right py-2">Montant payé</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee, index) => (
                  <tr
                    key={index}
                    className="border-b  border-gray-300 font-medium text-gray-700"
                  >
                    <td className="py-2">{fee.nameFrais}</td>
                    <td className="py-2">{fee.className}</td>
                    <td className="py-2">{fee.schoolYear}</td>
                    <td className="text-right py-2">{fee.amountPaid} $</td>
                  </tr>
                ))}
                <tr className="font-bold  text-gray-700">
                  <td colSpan={3} className="py-2">
                    Total
                  </td>
                  <td className="text-right py-2">
                    {totalAmount.toFixed(2)} $
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="font-medium mt-4 text-gray-700">
              Montant total en lettres: {convertToWords(totalAmount)} dollars
            </p>
          </div>

          <div className="border-t border-gray-300 pt-4 mb-4">
            <h4 className="font-semibold text-gray-700 mb-2">
              Note d'avertissement
            </h4>
            <p className="text-sm text-gray-600">
              Ce reçu est un document officiel. Toute tentative de falsification
              ou d'altération est passible de poursuites judiciaires.
            </p>
          </div>

          <div className="mb-8">
            <p className="text-sm font-medium mb-2 text-gray-700">
              Argent perçu par: {financierName}
            </p>
          </div>

          <div className="flex justify-end mb-8 text-gray-700">
            <div className="w-1/3">
              <p className="text-sm font-medium mb-2">Signature et cachet</p>
              <div className="h-20 border-b border-dashed border-gray-300"></div>
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <div className="w-32 h-32 bg-gray-200 flex items-center justify-center">
              <p className="text-xs text-gray-500">Zone QR Code</p>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 border-t pt-4">
            <p className="font-semibold">{schoolName}</p>
            <p>{schoolAddress}</p>
            <p>
              Tél: {schoolContact} | Email: {schoolEmail}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
