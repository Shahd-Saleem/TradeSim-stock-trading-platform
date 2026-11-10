import type { AccountData } from "@/lib/account-types";
import { aed } from "@/lib/money";
import { percentLabel } from "@/lib/portfolio";
import s from "./Dashboard.module.css";
export function ProfitLoss({
  value,
  basisPoints,
}: {
  value: number | null;
  basisPoints?: number | null;
}) {
  if (value === null) return <span>Unavailable · missing quote</span>;
  return (
    <span className={value > 0 ? s.positive : value < 0 ? s.negative : s.muted}>
      {value > 0 ? "Gain +" : value < 0 ? "Loss " : "Break-even "}
      {aed(value)}
      {basisPoints !== undefined && <> · {percentLabel(basisPoints)}</>}
    </span>
  );
}
export function ProfitSummary({ account }: { account: AccountData }) {
  return (
    <section
      className={`${s.panel} ${s.profitSummary}`}
      aria-label="Realized and unrealized returns"
    >
      <div>
        <h2>Realized profit / loss</h2>
        <strong>
          <ProfitLoss value={account.realizedProfitLossFils} />
        </strong>
        <p>Completed sales, after allocated purchase cost.</p>
      </div>
      <div>
        <h2>Unrealized profit / loss</h2>
        <strong>
          <ProfitLoss value={account.unrealizedProfitLossFils} />
        </strong>
        <p>Open holdings at current simulated quotes.</p>
      </div>
      <div>
        <h2>Total profit / loss</h2>
        <strong>
          <ProfitLoss
            value={account.profitLossFils}
            basisPoints={account.returnBasisPoints}
          />
        </strong>
        <p>Realized plus unrealized. Virtual funds; no fees.</p>
      </div>
      {!account.valuationComplete && (
        <p role="status">
          A holding has no simulated quote. Full equity and unrealized totals
          are unavailable; available cash and realized returns remain accurate.
        </p>
      )}
      {account.cashAdjustmentFils !== 0 && (
        <p role="status">
          Cash outside the trade ledger: {aed(account.cashAdjustmentFils)}. This
          adjustment is excluded from investment returns.
        </p>
      )}
    </section>
  );
}
export function PortfolioHoldings({ account }: { account: AccountData }) {
  return (
    <>
      <ProfitSummary account={account} />
      {account.holdings.length > 0 && (
        <section aria-label="Your holdings" className={s.holdingsGrid}>
          {account.holdings.map((holding) => (
            <article
              key={`${holding.exchange}:${holding.symbol}`}
              className={`${s.panel} ${s.holdingCard}`}
            >
              <header>
                <div>
                  <span className={s.eyebrow}>
                    {holding.exchange} · {holding.symbol}
                  </span>
                  <h2>{holding.name}</h2>
                </div>
                <span className={s.tag}>SIMULATED</span>
              </header>
              <dl>
                <div>
                  <dt>Shares owned</dt>
                  <dd>{holding.quantity.toLocaleString("en-AE")}</dd>
                </div>
                <div>
                  <dt>Average purchase price ≈</dt>
                  <dd>{aed(holding.averagePriceFils)}</dd>
                </div>
                <div>
                  <dt>Remaining cost basis</dt>
                  <dd>{aed(holding.costBasisFils)}</dd>
                </div>
                <div>
                  <dt>Simulated price per share</dt>
                  <dd>
                    {holding.priceFils === null
                      ? "Quote unavailable"
                      : aed(holding.priceFils)}
                  </dd>
                </div>
                <div>
                  <dt>Current market value</dt>
                  <dd>
                    {holding.valueFils === null
                      ? "Unavailable"
                      : aed(holding.valueFils)}
                  </dd>
                </div>
                <div>
                  <dt>Unrealized profit / loss</dt>
                  <dd>
                    <ProfitLoss
                      value={holding.unrealizedProfitLossFils}
                      basisPoints={holding.unrealizedReturnBasisPoints}
                    />
                  </dd>
                </div>
              </dl>
              <div className={s.saleEstimate}>
                <h3>
                  If you sold all {holding.quantity.toLocaleString("en-AE")}{" "}
                  shares
                </h3>
                <dl>
                  <div>
                    <dt>Estimated sale proceeds</dt>
                    <dd>
                      {holding.estimatedSaleProceedsFils === null
                        ? "Unavailable"
                        : aed(holding.estimatedSaleProceedsFils)}
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated sale profit / loss</dt>
                    <dd>
                      <ProfitLoss value={holding.estimatedSaleProfitLossFils} />
                    </dd>
                  </div>
                </dl>
                <p>
                  This is the open holding’s unrealized return, not an
                  additional gain. No fees or real money.
                </p>
              </div>
              <p className={s.inputHelp}>
                {holding.quoteSnapshotAt
                  ? `Fixed simulated snapshot · ${holding.quoteSnapshotAt.slice(0, 10)}. Not live prices.`
                  : "A simulated quote is required to value this holding."}
              </p>
            </article>
          ))}
        </section>
      )}
      <p className={s.inputHelp}>
        Average purchase price is rounded to the nearest fil for display;
        remaining cost basis retains exact integer fils. Partial sales allocate
        proportional cost, rounded down; closing sales release any residual
        fils.
      </p>
    </>
  );
}
