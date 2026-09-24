import { z } from "zod";
import { isFutureDateMYT } from "@/lib/dates";

export const PaymentMethod = z.enum(["Cash", "eWallet", "Card"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const Lang = z.enum(["en", "zh", "ms"]);
export type Lang = z.infer<typeof Lang>;

/**
 * A draft is what the Confirmation Card edits. Money in integer sen.
 */
export const Draft = z.object({
  clientId: z.string().uuid(),
  type: z.enum(["expense", "income"]),
  amountSen: z.number().int().positive().max(99_999_999),
  categoryId: z.string().uuid(),
  paymentMethod: PaymentMethod.nullable(),
  merchant: z.string().max(80).nullable(),
  itemLabel: z.string().max(40).nullable(),
  note: z.string().max(200).nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .refine((d) => !isFutureDateMYT(d), {
      message: "Date cannot be in the future",
    }),
  isEssential: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  currencyWarning: z.boolean().optional(),
});
export type Draft = z.infer<typeof Draft>;

export const SaveInput = z.object({
  drafts: z
    .array(Draft.extend({ paymentMethod: PaymentMethod }))
    .min(1)
    .max(20),
  receiptPath: z.string().nullable(),
});
export type SaveInput = z.infer<typeof SaveInput>;

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["expense", "income"]),
  defaultEssential: z.boolean().default(true),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const RenameCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
});
export type RenameCategoryInput = z.infer<typeof RenameCategorySchema>;

export const ArchiveCategorySchema = z.object({
  id: z.string().uuid(),
});
export type ArchiveCategoryInput = z.infer<typeof ArchiveCategorySchema>;

// Upper bound is RM 999,999.99 — a ceiling for a personal monthly budget, tighter than the
// numeric(10,2) column's own RM 99,999,999.99 capacity.
export const UpdateBudgetInput = z.object({
  budgetSen: z.number().int().min(0).max(99_999_999),
});
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInput>;

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "AI_LIMIT"
  | "AI_FAILED"
  | "NOT_RECEIPT"
  | "NOT_FOUND"
  | "CONFLICT";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };
