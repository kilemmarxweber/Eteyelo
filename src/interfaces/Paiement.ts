import { IclassEnrollment } from "./classEnrollment";
import { IFrais } from "./Frais";
import { IStudent } from "./Student";
import z from "zod";

export interface IPaiement {
  id: string;
  numeroRecu: string;
  montantPaye: number;
  receivedCurrency?: "USD" | "CDF" | "AOA";
  receivedAmount?: number;
  exchangeRateUsed?: number | null;

  modePaiement: ModePaiement;
  status: StatusPaiement;

  datePaiement: Date;
  transactionRef: string;
  notes?: string;

  frais?: {
    id: string;
    nameFrais: string;
    montantFrais: number;
  };

  classEnrollment?: {
    id: string;
    nom: string;
    prenom: string;
    sexe?: string;
    nameClasse: string;
    codeClasse?: string;
    nameYear: string;
    parentId?: string;
    parentName?: string;
    parentPrenom?: string;
    parentPostnom?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface ICashierExpense {
  id: string;
  transactionRef: string;
  amount: number;
  description?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Fee {
  feeId: string;
  nameFrais: string;
  className: string;
  schoolYear: string;
  amountPaid: string;
}

export interface InvoiceProps {
  studentName: string;
  schoolName: string;
  schoolAddress: string;
  schoolContact: string;
  schoolEmail: string;
  paymentDate: string;
  financierName: string;
  fees: Fee[];
  invoiceNumber: string;
}

export enum ModePaiement {
  ESPECES = "ESPECES",
  MPESA = "MPESA",
  AIRTEL_MONEY = "AIRTEL_MONEY",
  ORANGE_MONEY = "ORANGE_MONEY",
  CARTE = "CARTE",
  BANQUE = "BANQUE",
}

export enum StatusPaiement {
  VALIDE = "VALIDE",
  ANNULE = "ANNULE",
  EN_ATTENTE = "EN_ATTENTE",
  REMBOURSE = "REMBOURSE",
}

export const paiementSchema = z.object({
  id: z.string().optional(),
  numeroRecu: z.string().optional(),

  /** Montant de référence métier en USD (après conversion). */
  amount: z.coerce.number().min(0.01),

  /** Devise réellement perçue à la caisse. */
  receivedCurrency: z.enum(["USD", "CDF", "AOA"]).optional(),
  /** Montant perçu dans receivedCurrency. */
  receivedAmount: z.coerce.number().positive().optional(),
  /** Taux figé au moment du paiement (received → USD, ou 1 si USD). */
  exchangeRateUsed: z.coerce.number().positive().optional(),

  modePaiement: z.nativeEnum(ModePaiement),
  status: z.nativeEnum(StatusPaiement),

  datePaiement: z.coerce.date().optional(),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),

  // 🔥 CHANGEMENT IMPORTANT
  fraisIds: z.array(z.string()).min(1, "Sélectionnez au moins un frais"),

  classEnrollIds: z.array(z.string()).min(1, "Sélectionnez au moins un élève"),

  parentId: z.string().min(1, "Parent requis"),
});

export const cashierExpenseSchema = z.object({
  amount: z.coerce.number().min(0.01),
  description: z.string().optional(),
  category: z.string().optional(),
});
