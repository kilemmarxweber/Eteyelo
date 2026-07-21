let cachedTemplateDataUrl: string | null = null;

export async function loadBrevetCertificateTemplate(): Promise<string> {
  if (cachedTemplateDataUrl) {
    return cachedTemplateDataUrl;
  }

  const response = await fetch("/uploads/certificat.jpeg");
  if (!response.ok) {
    throw new Error("Impossible de charger le modele de certificat");
  }

  const blob = await response.blob();
  cachedTemplateDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du modele de certificat impossible"));
    reader.readAsDataURL(blob);
  });

  return cachedTemplateDataUrl;
}
