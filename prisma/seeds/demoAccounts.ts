import { SEED_ORGANIZATION_ID } from "./seedContext";

export type DemoAccount = {
  email: string;
  username: string;
  password: string;
  appRole: string;
  memberRole: string | null;
  destination: string;
  label: string;
};

export const DEMO_PASSWORDS = {
  owner: "Owner123!",
  admin: "Admin123!",
  teacher: "Password123!",
  parent: "Password123!",
  student: "Student123!",
  platformSupport: "Support123!",
} as const;

const seedOrgPath = `/admin/organizations/${SEED_ORGANIZATION_ID}`;
const seedBranchPath = `${seedOrgPath}/branches/{branchId}`;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Proprietaire plateforme",
    email: "owner@eteyelo.cd",
    username: "owner",
    password: DEMO_PASSWORDS.owner,
    appRole: "owner",
    memberRole: null,
    destination: "/admin",
  },
  {
    label: "Gestionnaire organisation",
    email: "admin@eteyelo.cd",
    username: "admin",
    password: DEMO_PASSWORDS.admin,
    appRole: "admin",
    memberRole: "gestionnaire",
    destination: seedOrgPath,
  },
  {
    label: "Support plateforme Klambocore",
    email: "support@klambocore.cd",
    username: "support.klambocore",
    password: DEMO_PASSWORDS.platformSupport,
    appRole: "platform_support",
    memberRole: null,
    destination: "/admin/platform-support",
  },
  {
    label: "Enseignant (exemple)",
    email: "prof.mukendi@eteyelo.cd",
    username: "prof.mukendi",
    password: DEMO_PASSWORDS.teacher,
    appRole: "user",
    memberRole: "teacher",
    destination: seedBranchPath,
  },
  {
    label: "Parent (exemple)",
    email: "kasongo@parent.cd",
    username: "parent.kasongo",
    password: DEMO_PASSWORDS.parent,
    appRole: "user",
    memberRole: "parent",
    destination: seedBranchPath,
  },
  {
    label: "Eleve (exemple)",
    email: "kasongo.junior@eleve.cd",
    username: "eleve.kasongo.junior",
    password: DEMO_PASSWORDS.student,
    appRole: "user",
    memberRole: "student",
    destination: seedBranchPath,
  },
];

export function printDemoAccounts() {
  console.log("\nComptes de demonstration:");
  console.log("=".repeat(72));

  for (const account of DEMO_ACCOUNTS) {
    console.log(`\n${account.label}`);
    console.log(`  Email       : ${account.email}`);
    console.log(`  Username    : ${account.username}`);
    console.log(`  Mot de passe: ${account.password}`);
    console.log(`  User.role   : ${account.appRole}`);
    console.log(
      `  Member.role : ${account.memberRole ?? "(aucun membership)"}`,
    );
    console.log(`  Destination : ${account.destination}`);
  }

  console.log("\n" + "=".repeat(72));
  console.log(
    "Enseignants : prof.*@eteyelo.cd / Password123!",
  );
  console.log("Parents     : *@parent.cd / Password123!");
  console.log("Eleves      : *@eleve.cd / Student123!");
  console.log("Personnel   : pers.*@eteyelo.cd / Password123!");
  console.log(
    "Rapports    : paiements, caisse, présences, fiches (seed report*)",
  );
}
