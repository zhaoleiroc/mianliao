import { useMemo, useState } from "react";
import { fabrics } from "../data";
import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";

interface Row {
  fabricId: string;
  name: string;
  prices: Record<string, number | null>;
  min: number;
  max: number;
  spread: number;
}

export default function Compare() {
  const products = useMemo(
    () => fabrics.filter((f) => f.supplier_brand === "3S-AVVA" && (f.supplier_quotes ?? []).length > 0),
    []
  );

  const supplierNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const q of p.supplier_quotes!) if (q.supplier) set.add(q.supplier);
    return Array.from(set);
  }, [products]);

  const rows: Row[] = useMemo(() => {
    return products.map((p) => {
      const prices: Record<string, number | null> = {};
      for (const s of supplierNames) prices[s] = null;
      let min = Infinity, max = -Infinity;
      for (const q of p.supplier_quotes!) {
        const n = typeof q.price_rmb_per_m === "number" ? q.price_rmb_per_m : parseFloat(String(q.price_rmb_per_m ?? ""));
        if (isNaN(n)) { prices[q.supplier] = null; continue; }
        prices[q.supplier] = n;
        if (n < min) min = n;
        if (n > max) max = n;
      }
      return {
        fabricId: p.id,
        name: p.name,
        prices,
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        spread: max === -Infinity ? 0 : max - min,
      };
    });
  }, [products, supplierNames]);

  const [sortBy, setSortBy] = useState<"name" | "min" | "spread">("name");
  const sorted = rows.slice().sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "zh");
    if (sortBy === "min") return a.min - b.min;
    return b.spread - a.spread;
  });

  return (
    <div className="container-page py-10">
      <div className="label">Pricing</div>
      <h1 className="font-serif text-3xl text-ink">3S-AVVA 多供应商比价</h1>
      <p className="mt-1 text-sm text-stone-500">
        {products.length} 款针织面料 · {supplierNames.length} 家供应商 · 报价日期 2026 年 3 月 9 日
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-stone-500">排序：</span>
        {([
          { k: "name", l: "名称" },
          { k: "min", l: "最低价" },
          { k: "spread", l: "价差" },
        ] as const).map((s) => (
          <button
            key={s.k}
            onClick={() => setSortBy(s.k)}
            className={"chip " + (sortBy === s.k ? "chip-active" : "")}
          >
            {s.l} <ArrowUpDown size={10} />
          </button>
        ))}
      </div>

      <div className="surface mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="sticky left-0 z-10 bg-stone-50 px-4 py-3">面料</th>
              {supplierNames.map((s) => (
                <th key={s} className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[10px] font-normal normal-case">{s}</div>
                  <div className="mt-0.5">¥/m</div>
                </th>
              ))}
              <th className="px-3 py-3 text-right">最低</th>
              <th className="px-3 py-3 text-right">最高</th>
              <th className="px-3 py-3 text-right">价差</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/70">
            {sorted.map((r) => (
              <tr key={r.fabricId} className="hover:bg-stone-50/60">
                <td className="sticky left-0 z-10 bg-white px-4 py-3">
                  <Link to={`/fabrics/${r.fabricId}`} className="font-medium text-ink hover:text-accent">
                    {r.name}
                  </Link>
                </td>
                {supplierNames.map((s) => {
                  const v = r.prices[s];
                  const isMin = v != null && v === r.min && r.min > 0;
                  return (
                    <td
                      key={s}
                      className={"px-3 py-3 text-right tabular-nums " + (isMin ? "bg-amber-50/60 font-semibold text-accent" : "text-stone-700")}
                    >
                      {v != null ? v : <span className="text-stone-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right tabular-nums text-stone-700">{r.min || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-stone-700">{r.max || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-accent">
                  {r.spread > 0 ? "¥" + r.spread : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-stone-400">
        提示：橙色单元格为该面料的最低供应商报价。点击面料名称查看详情。数据来源：
        <code className="ml-1 font-mono">面料推荐档案/家纺/3S-AVVA_针织面料报价单_多供应商版_新增网址.xlsx</code>
      </p>
    </div>
  );
}
