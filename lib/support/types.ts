export type SupportAgentPublic = {
  id: string;
  /** Id utilisateur — utilisé par le formulaire de contact (destinataire). */
  userId: string;
  name: string;
  email: string;
  role: string;
  image: string;
  topics: string[];
};

export const SUPPORT_TOPICS = [
  {
    title: "Assistance compte",
    text: "Connexion, accès administrateurs, gestion des utilisateurs et réinitialisation des mots de passe.",
  },
  {
    title: "Support établissement",
    text: "Classes, élèves, enseignants, paiements, bulletins et paramétrage de votre école.",
  },
  {
    title: "Incident technique",
    text: "Erreurs, lenteurs, imports de données, problèmes d'affichage ou de synchronisation.",
  },
] as const;
