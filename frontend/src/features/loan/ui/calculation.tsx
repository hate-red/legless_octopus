import { loanCalculation, money } from "@/shared/lib/format";
import type { Product } from "@/shared/api/contracts";
export function Calculation({
  amount,
  months,
  product,
}: {
  amount: number;
  months: number;
  product: Product;
}) {
  const calc = loanCalculation(
    amount,
    months,
    product.base_rate,
    product.repayment_type,
  );
  return (
    <>
      <dl className="calculation">
        <div>
          <dt>
            {product.repayment_type === "differentiated"
              ? "Первый платёж в месяц"
              : "Платёж в месяц"}
          </dt>
          <dd>{money(calc.monthly)}</dd>
          <small>оценка, до проверки</small>
        </div>
        <div>
          <dt>Ставка от</dt>
          <dd>{product.base_rate.toLocaleString("ru-RU")}%</dd>
          <small>годовых</small>
        </div>
        <div>
          <dt>Переплата*</dt>
          <dd>{money(calc.overpayment)}</dd>
          <small>примерно за весь срок</small>
        </div>
      </dl>
      <p className="fine-print">
        * Предварительный расчёт. Итоговые условия банк определит после проверки
        финансовых данных и кредитной истории.
      </p>
    </>
  );
}
