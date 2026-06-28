import { useMemo, useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { fabrics as allFabrics, distinctFibers, distinctSuppliers } from "../data";
import { CATEGORY_LABEL, type Category } from "../types";
import FabricCard from "../components/FabricCard";

const CATS: Category[] = ["knit", "woven", "pu_suede", "home_textile"];

export default function Fabrics() {
  const [params, setParams] = useSearchParams();
  const initialCat = (params.get("category") as Category | null) ?? null;
  const initialFiber = params.get("fiber");
  const initialSupplier = params.get("supplier");
  const initialQ = params.get("q") ?? "";

  const [category, setCategory] = useState<Category | null>(initialCat);
  const [fiber, setFiber] = useState<string | null>(initialFiber);
  const [supplier, setSupplier] = useState<string | null>(initialSupplier);
  const [q, setQ] = useState(initialQ);
  const [maxWeight, setMaxWeight] = useState<number>(500);

  useEffect(() => {
    setCategory((params.get("category") as Category | null) ?? null);
    setFiber(params.get("fiber"));
    setSupplier(params.get("supplier"));
    setQ(params.get("q") ?? "");
  }, [params]);

  const fibers = distinctFibers();
  const suppliers = distinctSuppliers();

  const filtered = useMemo(() => {
    return allFabrics.filter((f) => {
      if (category && f.category !== category) return false;
      if (fiber && !Object.keys(f.composition ?? {}).includes(fiber)) return false;
      if (supplier) {
        const s = f.supplier ?? f.supplier_brand;
        if (s !== supplier) return false;
      }
      if (q) {
        const hay = (
          f.name +
          " " +
          (f.code ?? "") +
          " " +
          (f.composition_raw ?? "") +
          " " +
          (f.supplier ?? "")
        ).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if ((f.weight_gsm ?? 0) > maxWeight) return false;
      return true;
    });
  }, [category, fiber, supplier, q, maxWeight]);

  const setQuery = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const reset = () => {
    setParams(new URLSearchParams(), { replace: true });
    setCategory(null);
    setFiber(null);
    setSupplier(null);
    setQ("");
  };

  const activeFilters = [
    category ? { k: "category", label: CATEGORY_LABEL[category] } : null,
    fiber ? { k: "fiber", label: fibers.find((x) => x.key === fiber)?.label ?? fiber } : null,
    supplier ? { k: "supplier", label: supplier } : null,
    q ? { k: "q", label: `"${q}"` } : null,
  ].filter(Boolean) as { k: string; label: string }[];

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="label">Library</div>
          <h1 className="font-serif text-3xl text-ink">面料库</h1>
          <p className="mt-1 text-sm text-stone-500">共 {filtered.length} / {allFabrics.length} 款</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setQuery("q", e.target.value || null);
            }}
            placeholder="搜索名称、编号、成分..."
            className="w-full rounded-full border border-stone-300 bg-white/80 py-2 pl-8 pr-3 text-sm placeholder:text-stone-400 focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-6">
          <div>
            <div className="label mb-2">品类</div>
            <div className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap">
              <button
                onClick={() => { setCategory(null); setQuery("category", null); }}
                className={"chip justify-start " + (category === null ? "chip-active" : "")}
              >
                全部
              </button>
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setQuery("category", c); }}
                  className={"chip justify-start " + (category === c ? "chip-active" : "")}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label mb-2">纤维</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setFiber(null); setQuery("fiber", null); }}
                className={"chip " + (fiber === null ? "chip-active" : "")}
              >
                全部
              </button>
              {fibers.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setFiber(f.key); setQuery("fiber", f.key); }}
                  className={"chip " + (fiber === f.key ? "chip-active" : "")}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label mb-2">供应商</div>
            <select
              value={supplier ?? ""}
              onChange={(e) => { setSupplier(e.target.value || null); setQuery("supplier", e.target.value || null); }}
              className="w-full rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-sm focus:border-ink focus:outline-none"
            >
              <option value="">全部</option>
              {suppliers.map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label mb-2">克重上限 {maxWeight} g/㎡</div>
            <input
              type="range"
              min={80}
              max={500}
              step={10}
              value={maxWeight}
              onChange={(e) => setMaxWeight(parseInt(e.target.value))}
              className="w-full accent-ink"
            />
          </div>

          {activeFilters.length > 0 && (
            <button onClick={reset} className="text-xs text-stone-500 hover:text-ink">
              清除全部筛选
            </button>
          )}
        </aside>

        <div>
          {activeFilters.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500">已选：</span>
              {activeFilters.map((f) => (
                <button
                  key={f.k}
                  onClick={() => {
                    if (f.k === "category") setCategory(null);
                    if (f.k === "fiber") setFiber(null);
                    if (f.k === "supplier") setSupplier(null);
                    if (f.k === "q") setQ("");
                    setQuery(f.k, null);
                  }}
                  className="chip chip-active"
                >
                  {f.label} <X size={11} />
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="surface grid place-items-center py-20 text-center text-stone-500">
              <p>没有匹配的面料</p>
              <button onClick={reset} className="mt-3 text-sm text-accent">重置筛选</button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((f) => (
                <FabricCard key={f.id} fabric={f} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
