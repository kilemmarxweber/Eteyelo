export type TermsReadingMode = "resume" | "complet";

export type TermsSection = {
  id: string;
  title: string;
  summary: string;
  full: string;
};

export const TERMS_LAST_UPDATED = "Janvier 2026";
export const TERMS_PRODUCT = "Kalasa v2.0";
export const TERMS_PLATFORM = "Klambocore";
export const TERMS_COMPANY = "Klambocore Sarl";
export const TERMS_CONTACT_EMAIL = "contact@klambocore.com";
export const TERMS_CONTACT_PHONE = "+243844952966";
export const TERMS_CONTACT_ADDRESS =
  "Avenue Route Bypass 425, Mont-Ngafula, Kinshasa, RDC";

export const TERMS_FOUNDER_NAME = "Yannick Kilem";
export const TERMS_FOUNDER_ROLE = "Fondateur & Directeur, Klambocore Sarl";
export const TERMS_FOUNDER_EMAIL = "kilem@klambocore.com";
export const TERMS_FOUNDER_PHONE = "+243844952966";
export const TERMS_FOUNDER_PHOTO = "/uploads/kilem.jpeg";

export const TERMS_SCHOOL_TYPES = [
  "Maternelle",
  "Primaire",
  "Secondaire",
  "Humanités",
] as const;

export const TERMS_LICENSE_PRICE_USD = 2500;
export const TERMS_SUBSCRIPTION_MONTHLY_USD = 100;
export const TERMS_SUBSCRIPTION_MONTHS = 9;
export const TERMS_MAINTENANCE_STORAGE_USD = 150;

export const termsSections: TermsSection[] = [
  {
    id: "objet",
    title: "1. Objet et acceptation",
    summary:
      "Kalasa v2.0 (Klambocore) est une plateforme de gestion scolaire numérique pour la RDC. En l'utilisant, vous acceptez ces conditions et confirmez être habilité si vous agissez pour un établissement.",
    full: `Les présentes conditions générales d'utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de ${TERMS_PRODUCT}, solution de gestion scolaire numérique éditée et déployée sous la marque ${TERMS_PLATFORM} par ${TERMS_COMPANY}.

La plateforme vise à moderniser la gestion administrative, pédagogique et financière des établissements scolaires en République Démocratique du Congo : centralisation des données, automatisation des tâches, transparence académique et financière, communication école–parents et accès à distance sécurisé.

Toute personne qui se connecte ou utilise le service accepte les CGU en vigueur. Si vous agissez pour le compte d'un établissement, vous déclarez disposer des pouvoirs nécessaires pour l'engager. L'utilisation implique également l'acceptation de la politique de confidentialité.`,
  },
  {
    id: "perimetre",
    title: "2. Périmètre du service",
    summary:
      "Le système couvre la gestion des utilisateurs, l'enseignement, les classes, les finances, le cursus scolaire (notes, bulletins, résultats), les présences et la communication avec les parents.",
    full: `La plateforme ${TERMS_PRODUCT} regroupe notamment les modules suivants :

• Gestion des utilisateurs : élèves, personnel, enseignants, parents et comptes associés ;
• Enseignement : cours, affectations, vacations, horaires ;
• Classes et inscriptions : années scolaires, sections, options, classes et inscriptions officielles ;
• Finance : frais scolaires, paiements, reçus et suivi des soldes ;
• Cursus scolaire : notes, fiche centrale, bulletins et résultats ;
• Suivi des présences, performances et situation financière des élèves ;
• Tableaux de bord, statistiques, événements et documents officiels.

Les fonctionnalités disponibles peuvent varier selon le profil utilisateur, l'offre souscrite par l'établissement et la configuration de son espace.`,
  },
  {
    id: "deploiement",
    title: "3. Accès et déploiement",
    summary:
      "Le système est accessible en cloud ou en local, depuis téléphone, tablette ou ordinateur. L'authentification par identifiants personnels est obligatoire ; le mot de passe doit être modifié à la première connexion.",
    full: `${TERMS_PRODUCT} peut être déployé en hébergement cloud ou en local au sein de l'établissement, selon le mode choisi lors de la mise en service. Dans les deux cas, l'accès à distance est possible depuis un téléphone, une tablette ou un ordinateur, sans installation complexe côté utilisateur.

La page d'authentification constitue la porte d'entrée du système. Chaque utilisateur doit saisir son nom d'utilisateur et son mot de passe personnels. Lors de la première connexion, il lui est demandé de modifier son mot de passe.

Les mises à jour peuvent être déployées automatiquement afin d'améliorer la sécurité, la performance et les fonctionnalités. ${TERMS_COMPANY} met en œuvre des mesures de protection des données adaptées au mode d'hébergement retenu.`,
  },
  {
    id: "roles",
    title: "4. Rôles et permissions",
    summary:
      "Chaque rôle (administrateur, directeur, enseignant, comptable, étudiant, parent) n'accède qu'aux fonctionnalités qui lui sont assignées. Les enseignants ne voient que leurs classes ; les titulaires contrôlent leur classe.",
    full: `L'accès au système est organisé par rôles et permissions. Selon la documentation ${TERMS_PRODUCT}, les profils incluent notamment : Administrateur, Directeur, Enseignant, Comptable et Étudiant, auxquels s'ajoutent les accès parents lorsque configurés.

Chaque rôle dispose de fonctionnalités spécifiques :
• un enseignant accède uniquement aux classes et cours qui lui sont assignés ;
• un titulaire de classe gère et contrôle les notes de sa classe ;
• le personnel administratif et financier gère les inscriptions, frais et paiements selon ses droits ;
• les parents peuvent consulter, selon configuration, le profil scolaire, les résultats, présences et paiements de leurs enfants.

Toute tentative d'accès à des données ou espaces non autorisés est interdite. ${TERMS_COMPANY} peut suspendre un compte en cas d'usage contraire aux CGU ou aux droits accordés.`,
  },
  {
    id: "donnees",
    title: "5. Données scolaires",
    summary:
      "L'établissement est responsable de l'exactitude des données saisies (élèves, inscriptions, notes, paiements). La plateforme centralise et affiche ces informations aux acteurs autorisés.",
    full: `Les établissements clients demeurent responsables de l'exactitude, de la licéité et de la mise à jour des données qu'ils enregistrent : identités, coordonnées, inscriptions, notes, présences, frais, paiements et documents administratifs.

La plateforme permet notamment :
• le profil élève centralisé (identité, classe, emploi du temps, performance, situation financière, présences) ;
• l'inscription officielle d'un élève à une classe pour une année scolaire active ;
• la consultation des informations par l'administration et, le cas échéant, par les parents.

${TERMS_COMPANY} fournit les outils techniques de saisie, consultation, calcul et export, mais n'est pas responsable des erreurs de saisie, des retards de mise à jour ni des décisions pédagogiques ou administratives prises par l'établissement sur la base de ces données.`,
  },
  {
    id: "pedagogie",
    title: "6. Notes, bulletins et résultats",
    summary:
      "Les enseignants encodent les évaluations ; les modifications après saisie nécessitent l'approbation du titulaire ou du directeur des études. Les bulletins sont générés automatiquement selon le modèle congolais.",
    full: `Le module cursus scolaire permet l'encodage des devoirs, interrogations, travaux pratiques, applications et examens. Les enseignants peuvent ajouter appréciations et commentaires pédagogiques.

Règles importantes :
• une fois une note encodée, l'enseignant ne peut plus la modifier librement ;
• toute modification nécessite l'approbation du titulaire de classe ou du directeur des études ;
• le titulaire peut annuler une évaluation ou demander une nouvelle épreuve en cas de taux d'échec anormalement élevé ;
• après validation, les moyennes et fiches de période sont calculées automatiquement en respectant la pondération des matières.

Le système génère les fiches de notes, bulletins scolaires et relevés conformes au modèle utilisé par l'État congolais, ainsi que les statistiques de réussite par classe, période ou année. Les parents peuvent être informés des résultats par e-mail ou WhatsApp selon la configuration de l'établissement.`,
  },
  {
    id: "finance",
    title: "7. Paiements et finances",
    summary:
      "Les frais scolaires et paiements sont enregistrés dans le module Finance. Plusieurs modes sont acceptés (banque, virement, e-money, espèces) et un reçu est généré pour chaque opération.",
    full: `Le module Finance permet de définir les frais de l'établissement (inscription, scolarité, transport, etc.) et d'enregistrer les paiements des élèves.

Fonctionnement :
• enregistrement des paiements par le caissier ou le personnel autorisé ;
• prise en charge de plusieurs modes : banque, virement, e-money, espèces ;
• suivi des frais payés et du solde restant ;
• recherche par nom d'élève ou de parent ;
• paiement groupé possible pour plusieurs enfants d'un même parent, avec répartition automatique des montants selon la priorité des frais obligatoires ;
• génération d'un reçu pour chaque paiement, ou d'un reçu unique détaillé en cas de paiement groupé.

Les réductions ou statuts particuliers (orphelin, fratrie, etc.) sont gérés par l'établissement selon sa politique interne. ${TERMS_COMPANY} n'intervient pas dans les décisions tarifaires de l'école, mais fournit les outils de traçabilité et de transparence.`,
  },
  {
    id: "communication",
    title: "8. Communication et notifications",
    summary:
      "La plateforme facilite la communication école–parents via le suivi en temps réel des résultats, présences et paiements. Des notifications automatiques peuvent être envoyées par e-mail ou WhatsApp.",
    full: `La plateforme améliore la communication entre l'établissement, les enseignants, les parents et les élèves en centralisant les informations essentielles : progression scolaire, présences, retards, participation, situation financière et événements programmés.

Des notifications automatiques peuvent être envoyées aux parents, notamment lors de la publication des résultats, selon les canaux configurés (e-mail, WhatsApp).

L'établissement reste responsable du contenu des communications qu'il publie et des coordonnées qu'il enregistre pour les notifications. Les parents et utilisateurs s'engagent à maintenir des coordonnées exactes et à consulter les informations qui leur sont destinées de manière responsable.`,
  },
  {
    id: "securite",
    title: "9. Sécurité et confidentialité",
    summary:
      "L'accès est strictement limité aux entités autorisées. Les données sensibles ne sont visibles que selon le rôle. Les communications sont sécurisées et les identifiants restent personnels.",
    full: `Conformément aux principes décrits dans la documentation ${TERMS_PRODUCT}, la plateforme garantit un accès strictement limité aux entités autorisées, que l'hébergement soit local ou cloud.

Mesures applicables :
• authentification individuelle par identifiants personnels ;
• contrôle d'accès par rôles et périmètre (classe, cours, établissement) ;
• obligation de changement de mot de passe à la première connexion ;
• chiffrement des communications (HTTPS/TLS) ;
• journalisation des actions sensibles lorsque applicable.

Le traitement des données personnelles est détaillé dans la politique de confidentialité. ${TERMS_COMPANY} ne vend pas les données. Tout partage est limité aux besoins techniques, légaux ou opérationnels du service.`,
  },
  {
    id: "propriete",
    title: "10. Propriété intellectuelle",
    summary:
      "Kalasa v2.0 est protégé par copyright (Janvier 2026). La plateforme, son interface et sa documentation appartiennent à Klambocore Sarl. Les données saisies par l'établissement restent sa propriété.",
    full: `${TERMS_PRODUCT} — Système de gestion scolaire numérique — est une solution protégée. Copyright Janvier 2026.

La plateforme, son architecture, son design, sa documentation, ses logos et l'ensemble des éléments logiciels associés sont la propriété exclusive de ${TERMS_COMPANY}, sauf mention contraire.

Aucune disposition des présentes CGU ne confère à l'utilisateur un droit de propriété sur le logiciel. Une licence d'utilisation limitée, non exclusive et révocable est accordée pour la durée du contrat et aux seules fins prévues.

Les contenus, documents et données importés ou créés par un établissement ou un utilisateur restent leur propriété. L'établissement accorde les droits strictement nécessaires à l'hébergement, à l'affichage et au fonctionnement technique du service.`,
  },
  {
    id: "tarification",
    title: "11. Tarification, maintenance et hébergement",
    summary:
      "Tarif par établissement (maternelle, primaire, secondaire, humanités) : 2 500 $ négociable, ou 100 $/mois sur 9 mois. Contrat de maintenance obligatoire + réservation stockage en ligne 150 $.",
    full: `La souscription à ${TERMS_PLATFORM} (${TERMS_PRODUCT}) s'effectue par établissement scolaire, selon l'un des niveaux suivants : ${TERMS_SCHOOL_TYPES.join(", ")}.

Tarification de la licence :
• prix fixe : ${TERMS_LICENSE_PRICE_USD.toLocaleString("fr-FR")} USD par établissement et par niveau, montant négociable selon la taille, le périmètre fonctionnel et les besoins de déploiement ;
• option abonnement : ${TERMS_SUBSCRIPTION_MONTHLY_USD} USD par mois, étalé sur les ${TERMS_SUBSCRIPTION_MONTHS} mois d'enseignement scolaire de l'année académique.

Frais obligatoires (tous modes de paiement) :
• contrat de maintenance : obligatoire pour toute souscription, quel que soit le mode de règlement retenu (paiement unique ou abonnement) ;
• réservation d'espace de stockage en ligne : ${TERMS_MAINTENANCE_STORAGE_USD} USD, obligatoire pour la maintenance, les améliorations, l'hébergement des données et les services associés.

Ces montants couvrent la mise à disposition, la maintenance corrective et évolutive, la sécurisation de l'espace cloud et le support technique lié au bon fonctionnement de la plateforme. Les conditions définitives (calendrier de paiement, durée d'engagement, périmètre exact) sont précisées dans le contrat commercial signé avec ${TERMS_COMPANY}.

En cas de retard ou de défaut de paiement, ${TERMS_COMPANY} peut suspendre l'accès aux services concernés après mise en demeure.`,
  },
  {
    id: "evolution",
    title: "12. Évolution et disponibilité",
    summary:
      "Le service peut évoluer avec des mises à jour automatiques. Une maintenance planifiée peut entraîner une indisponibilité temporaire, sans garantie de fonctionnement ininterrompu.",
    full: `${TERMS_COMPANY} s'efforce d'assurer une disponibilité continue du service. Des opérations de maintenance, mises à jour automatiques ou incidents techniques peuvent toutefois entraîner des interruptions temporaires.

L'éditeur se réserve le droit de faire évoluer, améliorer ou modifier la plateforme (fonctionnalités, interface, exigences techniques) afin de renforcer la sécurité, la performance et la qualité du service, conformément à la vision du projet ${TERMS_PRODUCT}.

Les changements substantiels affectant les établissements clients seront, dans la mesure du possible, communiqués à l'avance. Aucune garantie n'est accordée quant à l'adéquation du service à un usage particulier non expressément prévu par les fonctionnalités documentées.`,
  },
  {
    id: "responsabilite",
    title: "13. Limitation de responsabilité",
    summary:
      "Klambocore est tenue d'une obligation de moyens. L'établissement reste responsable de ses saisies, décisions pédagogiques et politiques tarifaires. La responsabilité de l'éditeur est limitée aux dommages directs prouvés.",
    full: `${TERMS_COMPANY} est tenue d'une obligation de moyens dans la fourniture du service. Elle ne saurait être tenue responsable :

• des erreurs de saisie ou de décisions pédagogiques des enseignants et de l'administration ;
• des dommages indirects (perte de chiffre d'affaires, préjudice d'image, etc.) ;
• des interruptions liées à la connexion internet, au matériel de l'utilisateur ou à un cas de force majeure ;
• du contenu publié ou des notifications envoyées par l'établissement.

La responsabilité de l'éditeur, toutes causes confondues, est limitée au montant effectivement payé par l'établissement concerné au cours des douze (12) mois précédant le fait générateur, sauf faute lourde ou dolosive.

L'utilisateur reconnaît que la transmission d'informations sur Internet comporte des risques inhérents et s'engage à disposer de moyens de sauvegarde appropriés pour ses données critiques.`,
  },
  {
    id: "resiliation",
    title: "14. Suspension et résiliation",
    summary:
      "En cas de manquement, de non-paiement ou de menace pour la sécurité, l'accès peut être suspendu. L'établissement peut demander la clôture de son espace selon les modalités contractuelles.",
    full: `En cas de violation des présentes CGU, de non-paiement ou de menace pour la sécurité du service, ${TERMS_COMPANY} peut suspendre ou résilier l'accès d'un utilisateur ou d'un établissement, après notification lorsque les circonstances le permettent.

L'établissement peut demander la clôture de son espace conformément aux conditions de son contrat commercial. Sur demande et dans des délais raisonnables, un export des données pourra être facilité, sous réserve des obligations légales de conservation.

La résiliation n'affecte pas les obligations nées antérieurement (paiements dus, responsabilités liées aux données déjà traitées).`,
  },
  {
    id: "droit",
    title: "15. Droit applicable",
    summary:
      "Les CGU sont régies par le droit congolais. En cas de litige, les parties privilégient une résolution amiable avant toute action devant les juridictions compétentes de Kinshasa.",
    full: `Les présentes CGU sont régies par le droit de la République Démocratique du Congo.

En cas de différend relatif à l'interprétation ou à l'exécution des CGU, les parties s'efforceront de trouver une solution amiable. À défaut d'accord dans un délai de trente (30) jours, le litige sera porté devant les juridictions compétentes de Kinshasa, sous réserve des dispositions d'ordre public applicables.

Si une clause des CGU est déclarée nulle ou inapplicable, les autres dispositions conservent leur plein effet.`,
  },
  {
    id: "contact",
    title: "16. Contact",
    summary:
      "Fondateur : Yannick Kilem — kilem@klambocore.com, +243844952966. Siège : Klambocore Sarl, Mont-Ngafula, Kinshasa.",
    full: `Pour toute question relative aux présentes conditions d'utilisation, aux tarifs ou à la souscription, vous pouvez contacter :

${TERMS_FOUNDER_NAME}
${TERMS_FOUNDER_ROLE}
E-mail : ${TERMS_FOUNDER_EMAIL}
Téléphone : ${TERMS_FOUNDER_PHONE}

${TERMS_COMPANY}
${TERMS_CONTACT_ADDRESS}
Contact général : ${TERMS_CONTACT_EMAIL} — ${TERMS_CONTACT_PHONE}

Plateforme : ${TERMS_PLATFORM} (${TERMS_PRODUCT})

Notre objectif est de contribuer à la modernisation du système éducatif grâce à des solutions technologiques intelligentes, accessibles et adaptées aux réalités locales.

${TERMS_COMPANY} se réserve le droit de modifier les présentes CGU. La date de dernière mise à jour est indiquée en haut de cette page. L'utilisation continue du service après publication des modifications vaut acceptation des CGU révisées.`,
  },
];
