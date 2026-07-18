export type StudentAnnouncementScope = "all" | "class";

export type StudentAnnouncementItem = {
  id: string;
  title: string;
  description: string | null;
  dateStartLabel: string;
  dateEndLabel: string | null;
  location: string | null;
  audienceLabel: string;
  audienceScope: StudentAnnouncementScope;
  eventTypeName: string | null;
  image: string | null;
};

export type StudentAnnouncementsData = {
  items: StudentAnnouncementItem[];
};
