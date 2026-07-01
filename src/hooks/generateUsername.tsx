export default function generateUsername(
  userType: string,
  nom: string,
  prenom: string
): string {
  let prefix;
  switch (userType) {
    case "Parent":
      prefix = "PRT";
      break;
    case "Student":
      prefix = "ELV";
      break;
    case "Teacher":
      prefix = "ENS";
      break;
    case "Admin":
      prefix = "ADM";
      break;
    case "Personnel":
      prefix = "PRS";
      break;
    default:
      prefix = "USR"; // Unknown type
  }
  return `${prefix}-${nom.toUpperCase()}${prenom.toUpperCase()}`;
}
