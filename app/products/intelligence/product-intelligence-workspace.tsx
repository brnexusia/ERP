"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import styles from "./intelligence.module.css";

type Metric = "REVENUE" | "SOLD_QUANTITY" | "PAID_SALES";
type Mode = "METRICS" | "ABC" | "LOW_OUTPUT";
type ProductInfo = { id: string; name: string; sku: string; unitMeasure: string; category: { name: string } };
type Stock = { quantity: string; minimum: string; maximum: string } | null;
type BaseEntry = {
  product: ProductInfo; stock: Stock; soldQuantity: string; revenue: string;
  paidSales: number; lastSaleAt: string | null;
};
type MetricReport = { products: BaseEntry[] };
type AbcReport = {
  metric: "REVENUE" | "SOLD_QUANTITY";
  totalMetricValue: string; classificationStatus: "PENDING_THRESHOLDS" | "EXPLICIT_THRESHOLDS";
  thresholds: { classAUpToPercent: number; classBUpToPercent: number } | null;
  products: Array<BaseEntry & { rank: number; selectedMetric: {
    metric: string; value: string; sharePercent: string; cumulativeSharePercent: string;
  }; abcClass: "PENDING_THRESHOLDS" | "UNCLASSIFIED" | "A" | "B" | "C" }>;
};
type LowReport = {
  summary: { totalProducts: number; lowOutput: number; aboveThreshold: number };
  criteria: { metric: Metric; threshold: string; comparison: string; source: "EXPLICIT_REQUEST" };
  products: Array<BaseEntry & { selectedMetric: { value: string; threshold: string }; lowOutput: boolean }>;
};
const number = (value: number | string | null) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value ?? 0));
const currency = (value: string) =>
  new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(Number(value));
const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";
async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha ao consultar indicadores.");
  return data as T;
}
export function ProductIntelligenceWorkspace() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mode, setMode] = useState<Mode>("METRICS");
  const [metric, setMetric] = useState<Metric>("REVENUE");
  const [threshold, setThreshold] = useState("");
  const [abcA, setAbcA] = useState("");
  const [abcB, setAbcB] = useState("");
  const [view, setView] = useState<Mode | null>(null);
  const [metrics, setMetrics] = useState<MetricReport | null>(null);
  const [abc, setAbc] = useState<AbcReport | null>(null);
  const [low, setLow] = useState<LowReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start || !end) { setError("Informe o período completo."); return; }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) { setError("O fim do período deve ser posterior ao início."); return; }
    if (mode === "LOW_OUTPUT" && (threshold.trim() === "" ||
        !Number.isFinite(Number(threshold)) || Number(threshold) < 0)) {
      setError("Informe um limiar numérico não negativo."); return;
    }
    if (mode === "ABC" && (abcA.trim() !== "" || abcB.trim() !== "") &&
      !(abcA.trim() !== "" && abcB.trim() !== "" &&
        Number.isFinite(Number(abcA)) && Number.isFinite(Number(abcB)) &&
        Number(abcA) > 0 && Number(abcA) < Number(abcB) && Number(abcB) < 100)) {
      setError("Informe ambos os limites cumulativos com 0 < A < B < 100, ou deixe ambos em branco."); return;
    }
    setBusy(true); setError(null);
    setView(null); setMetrics(null); setAbc(null); setLow(null);
    const params = new URLSearchParams({
      start: startDate.toISOString(), end: endDate.toISOString(),
    });
    try {
      if (mode === "ABC") {
        if (metric === "PAID_SALES") { setError("A distribuição utiliza faturamento ou quantidade vendida."); return; }
        params.set("metric", metric);
        if (abcA.trim() !== "" && abcB.trim() !== "") {
          params.set("classAUpToPercent", abcA);
          params.set("classBUpToPercent", abcB);
        }
        const result = await api<{ report: AbcReport }>(`/api/reports/products/abc-distribution?${params}`);
        setAbc(result.report);
      } else if (mode === "LOW_OUTPUT") {
        params.set("metric", metric);
        params.set("threshold", threshold);
        const result = await api<{ report: LowReport }>(`/api/reports/products/low-output?${params}`);
        setLow(result.report);
      } else {
        const result = await api<{ report: MetricReport }>(`/api/reports/products?${params}`);
        setMetrics(result.report);
      }
      setView(mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar relatório.");
    } finally { setBusy(false); }
  }

  const rows = view === "ABC" ? abc?.products :
    view === "LOW_OUTPUT" ? low?.products : metrics?.products;

  return (
    <div className="erp-page">
      <header className="erp-page-header stitch-hero">
        <div><p className="erp-kicker">Produtos &amp; Estoque · Indicadores</p>
          <h1>Inteligência de produtos</h1>
          <p>Indicadores sobre vendas pagas, ranking de participação e baixa saída com critérios informados.</p>
        </div>
        <Link href="/products" className="secondary-button">Voltar aos produtos</Link>
      </header>
      {error && <div className="erp-alert error" role="alert">{error}</div>}
      <section className="erp-panel">
        <div className="panel-heading"><h2>Critérios da consulta</h2></div>
        <p className={styles.hint}>Período e métricas são informados em cada consulta. O ERP não presume limiares ou classes A/B/C. Opcionalmente, informe ambos os limites cumulativos para classificar somente este relatório.</p>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label>Tipo de relatório<select value={mode} onChange={(event) => {
            const next = event.target.value as Mode;
            setMode(next);
            if (next === "ABC" && metric === "PAID_SALES") setMetric("REVENUE");
          }}>
            <option value="METRICS">Vendas por produto</option>
            <option value="ABC">Distribuição de importância (base ABC)</option>
            <option value="LOW_OUTPUT">Baixa saída por limiar informado</option>
          </select></label>
          <label>Início do período<input required type="datetime-local" value={start}
            onChange={(event) => setStart(event.target.value)} /></label>
          <label>Fim do período<input required type="datetime-local" value={end}
            onChange={(event) => setEnd(event.target.value)} /></label>
          {mode !== "METRICS" && <label>Métrica<select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
            <option value="REVENUE">Faturamento</option>
            <option value="SOLD_QUANTITY">Quantidade vendida</option>
            {mode === "LOW_OUTPUT" && <option value="PAID_SALES">Vendas pagas</option>}
          </select></label>}
          {mode === "ABC" && <>
            <label>Classe A até (% acumulado, opcional)<input type="number" min="0.0001" max="99.9998" step="any"
              value={abcA} onChange={(event) => setAbcA(event.target.value)} placeholder="Sem padrão" /></label>
            <label>Classe B até (% acumulado, opcional)<input type="number" min="0.0002" max="99.9999" step="any"
              value={abcB} onChange={(event) => setAbcB(event.target.value)} placeholder="Sem padrão" /></label>
          </>}
          {mode === "LOW_OUTPUT" && <label>Limiar máximo informado<input required inputMode="decimal" type="number" min="0" step="any"
            value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>}
          <button type="submit" className="primary-button" disabled={busy}>{busy ? "Consultando..." : "Consultar"}</button>
        </form>
      </section>
      {view === "ABC" && abc && <section className="erp-panel">
        <div className="panel-heading"><h2>Distribuição factual de produtos</h2></div>
        <p className={styles.hint}>Total na métrica: {abc.metric === "REVENUE" ? currency(abc.totalMetricValue) : number(abc.totalMetricValue)}.
          Percentuais e participação acumulada são calculados somente das vendas pagas.
          {abc.classificationStatus === "EXPLICIT_THRESHOLDS" && abc.thresholds
            ? ` Classificação apenas desta consulta: A até ${number(abc.thresholds.classAUpToPercent)}%, B até ${number(abc.thresholds.classBUpToPercent)}%, C acima disso. Sem vendas: não classificado.`
            : " Faixas A/B/C não informadas: classificação pendente."}</p>
      </section>}
      {view === "LOW_OUTPUT" && low && <div className="metric-grid">
        <div className="metric-card"><span>Produtos analisados</span><strong>{low.summary.totalProducts}</strong></div>
        <div className="metric-card"><span>Até o limiar escolhido</span><strong>{low.summary.lowOutput}</strong></div>
        <div className="metric-card"><span>Acima do limiar</span><strong>{low.summary.aboveThreshold}</strong></div>
        <div className="metric-card"><span>Limiar informado</span><strong>{number(low.criteria.threshold)}</strong></div>
      </div>}
      {view && <section className="erp-panel">
        <div className="panel-heading"><h2>{view === "ABC" ? "Participação por produto" :
          view === "LOW_OUTPUT" ? "Produtos por baixa saída" : "Indicadores por produto"}</h2></div>
        <div className="client-table-wrap">
          <table className="client-table">
            <thead><tr><th>Produto</th><th>Quantidade vendida</th><th>Faturamento</th><th>Vendas pagas</th>
              <th>Última venda</th>{view === "ABC" && <><th>Participação</th><th>Acumulado</th><th>Classe</th></>}
              {view === "LOW_OUTPUT" && <><th>Métrica observada</th><th>Resultado</th></>}
            </tr></thead>
            <tbody>{view === "ABC" ? abc?.products.map((row) =>
              <tr key={row.product.id}><td>{row.rank}. {row.product.name}<small>{row.product.sku}</small></td>
                <td>{number(row.soldQuantity)}</td><td>{currency(row.revenue)}</td>
                <td>{row.paidSales}</td><td>{date(row.lastSaleAt)}</td>
                <td>{number(row.selectedMetric.sharePercent)}%</td>
                <td>{number(row.selectedMetric.cumulativeSharePercent)}%</td>
                <td>{row.abcClass === "PENDING_THRESHOLDS" ? "Sem faixas" :
                  row.abcClass === "UNCLASSIFIED" ? "Sem vendas" : row.abcClass}</td></tr>) :
            view === "LOW_OUTPUT" ? low?.products.map((row) =>
              <tr key={row.product.id}><td>{row.product.name}<small>{row.product.sku}</small></td>
                <td>{number(row.soldQuantity)}</td><td>{currency(row.revenue)}</td><td>{row.paidSales}</td>
                <td>{date(row.lastSaleAt)}</td><td>{number(row.selectedMetric.value)}</td>
                <td><span className={`status-chip ${row.lowOutput ? "warning" : "success"}`}>{row.lowOutput ? "Até o limiar" : "Acima do limiar"}</span></td></tr>) :
            metrics?.products.map((row) =>
              <tr key={row.product.id}><td>{row.product.name}<small>{row.product.sku}</small></td>
                <td>{number(row.soldQuantity)}</td><td>{currency(row.revenue)}</td><td>{row.paidSales}</td>
                <td>{date(row.lastSaleAt)}</td></tr>)}
            </tbody>
          </table>
          {rows?.length === 0 && <p className="empty-state">Nenhum produto neste relatório.</p>}
        </div>
      </section>}
    </div>
  );
}
