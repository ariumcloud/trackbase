import { Info, Medal } from "lucide-react";
import {
  formatCurrencyAmount,
  normalizeCurrency,
  type ExchangeRates,
} from "@/lib/currency";
import {
  convertLifetimeRevenue,
  resolveRevenueMilestone,
} from "@/lib/revenue-milestones";
import type { LifetimeRevenueByCurrency } from "@/lib/types";
import { memo, useMemo } from "react";

type Props = {
  defaultCurrency?: string;
  revenueByCurrency: LifetimeRevenueByCurrency[];
  exchangeRates: ExchangeRates | null;
};

export const RevenueMilestoneBadge = memo(function RevenueMilestoneBadge({
  defaultCurrency = "BRL",
  revenueByCurrency,
  exchangeRates,
}: Props) {
  const displayCurrency = normalizeCurrency(defaultCurrency) || "BRL";
  const total = useMemo(
    () => convertLifetimeRevenue(revenueByCurrency, displayCurrency, exchangeRates),
    [displayCurrency, exchangeRates, revenueByCurrency],
  );
  const milestone = useMemo(() => resolveRevenueMilestone(total), [total]);
  const tooltip = `Faturamento bruto de vendas aprovadas desde o início do workspace, convertido para ${displayCurrency}.`;
  const amountLabel = formatCurrencyAmount(total, displayCurrency);
  const targetLabel = formatCurrencyAmount(milestone.target, displayCurrency);

  return (
    <div
      className="revenue-milestone-badge"
      title={tooltip}
      aria-label={`Prêmios: ${amountLabel} de ${targetLabel}. ${tooltip}`}
      aria-busy={total === null}
    >
      <Medal className="revenue-milestone-icon" size={17} aria-hidden="true" />
      <span className="revenue-milestone-copy">
        <strong className="revenue-milestone-label">Prêmios</strong>
        <span className="revenue-milestone-values">
          {amountLabel} / {targetLabel}
        </span>
      </span>
      <span
        className="revenue-milestone-info"
        title={tooltip}
        aria-label={tooltip}
        role="img"
      >
        <Info size={13} aria-hidden="true" />
      </span>
      <span className="revenue-milestone-track" aria-hidden="true">
        <span
          className="revenue-milestone-progress"
          style={{ width: `${total === null ? 0 : milestone.progress}%` }}
        />
      </span>
    </div>
  );
});
