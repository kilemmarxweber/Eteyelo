export const INVITATION_MESSAGES = {
  disabled:
    "Les invitations ne sont pas activées pour cette organisation.",
  roleRequired: "Le rôle est obligatoire pour envoyer une invitation.",
  roleInvalid: "Rôle d’organisation invalide ou non autorisé pour l’invitation.",
  alreadyMember: "Cet utilisateur est déjà membre de cette organisation.",
  alreadyInvited: "Une invitation est déjà en attente pour cet email.",
  mustChangePasswordFirst:
    "Cet utilisateur doit d’abord changer son mot de passe temporaire avant d’être invité dans une autre organisation.",
  acceptMustChangePassword:
    "Changez votre mot de passe temporaire avant d’accepter cette invitation.",
  orgNotFound: "Organisation introuvable.",
  notOwner: "Seul le super administrateur peut gérer les invitations.",
  inviteSent: "Invitation envoyée.",
  inviteCancelled: "Invitation annulée.",
  configSaved: "Configuration des invitations enregistrée.",
  acceptNeedsLogin: "Connectez-vous avec l’email invité pour accepter.",
  acceptEmailMismatch:
    "Cette invitation est destinée à une autre adresse email.",
  acceptSuccess: "Vous avez rejoint l’organisation.",
  acceptFailed: "Impossible d’accepter l’invitation.",
  notFoundOrExpired: "Invitation introuvable, expirée ou déjà traitée.",
} as const;
