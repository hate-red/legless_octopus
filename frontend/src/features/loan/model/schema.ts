import { z } from "zod";
import type { Product } from "@/shared/api/contracts";
export function loanSchema(products: Product[]) {
  return z
    .object({
      purpose: z
        .string()
        .trim()
        .min(5, "Опишите цель: минимум 5 символов")
        .max(1000, "Не более 1000 символов"),
      product_id: z.number().int().positive("Выберите продукт"),
      amount: z.number({ error: "Укажите сумму" }).positive("Укажите сумму"),
      term_months: z.number().int().positive(),
    })
    .superRefine((value, ctx) => {
      const product = products.find((p) => p.id === value.product_id);
      if (!product) {
        ctx.addIssue({
          code: "custom",
          path: ["product_id"],
          message: "Выберите продукт",
        });
        return;
      }
      if (
        value.amount < product.min_amount ||
        value.amount > product.max_amount
      )
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: `Сумма от ${product.min_amount.toLocaleString("ru-RU")} до ${product.max_amount.toLocaleString("ru-RU")} ₽`,
        });
      if (
        value.term_months < product.min_term_months ||
        value.term_months > product.max_term_months
      )
        ctx.addIssue({
          code: "custom",
          path: ["term_months"],
          message: `Срок от ${product.min_term_months} до ${product.max_term_months} месяцев`,
        });
    });
}
