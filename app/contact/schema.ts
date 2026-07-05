import { z } from "zod";

export const contactSchema = z.object({
  recipientId: z.string().optional(),

  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(3),
  message: z.string().min(10),
});

export type ContactInput = z.infer<typeof contactSchema>;
