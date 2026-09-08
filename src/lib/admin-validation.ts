import { z } from "zod";

export const adminMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    target: z.string().uuid(),
    reason: z.string().trim().min(3).max(5000),
    plan: z.enum(["devedor", "liso", "vorcaro"]),
  }),
  z.object({
    action: z.literal("ticket_create"),
    target: z.string().uuid(),
    reason: z.string().trim().min(3).max(5000),
    subject: z.string().trim().min(3).max(160),
    priority: z.enum(["normal", "high", "urgent"]),
  }),
  z.object({
    action: z.literal("ticket_status"),
    target: z.string().uuid(),
    reason: z.string().trim().min(3).max(5000),
    status: z.enum(["open", "waiting", "resolved"]),
  }),
]);

export function adminPageNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, 100000) : 1;
}
