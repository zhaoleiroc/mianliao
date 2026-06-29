import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { fabrics, fabricImage } from "../data";
import {
  CATEGORY_LABEL,
  FIBER_LABEL,
  type Category,
  type Fabric,
} from "../types";

const CATS: Category[] = ["knit", "woven", "pu_suede", "home_textile"];

function priceValue(
  p: number | string | null | undefined,
): number | null {
  if (p == null) return null;
  const n = typeof p === "number" ? p : parseFloat(String(p));
  return Number.isFinite(n) ? n : null;
}

function compositionText(f: Fabric): string | null {
  const entries = Object.entries(f.composition ?? {}).slice(0, 3);
  if (entries.length === 0) return null;
  return entries
    .map(
      ([k, v]) =>
        (FIBER_LABEL[k] ?? k) + (v ? " " + Math.round(v) + "%" : ""),
    )
    .join(" · ");
}

export default function Home() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: fabrics.length };
    for (const c of CATS) m[c] = 0;
    for (const f of fabrics) m[f.category] = (m[f.category] ?? 0) + 1;
    return m;
  }, []);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return fabrics.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (!ql) return true;
      const hay =
        (f.name ?? "") +
        " " +
        (f.code ?? "") +
        " " +
        (f.supplier ?? "") +
        " " +
        (f.supplier_brand ?? "") +
        " " +
        (f.composition_raw ?? "") +
        " " +
        (f.features ?? []).join(" ") +
        " " +
        (f.applications ?? []).join(" ");
      return hay.toLowerCase().includes(ql);
    });
  }, [q, cat]);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link to="/" className="text-sm font-medium tracking-tight">
            面料库
          </Link>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称 / 编号 / 成分"
            className="w-56 border-b border-neutral-200 bg-transparent py-1 text-right text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
        </div>
      </header>

      <nav className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center gap-8 overflow-x-auto px-8">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            全部 ({counts.all})
          </Chip>
          {CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {CATEGORY_LABEL[c]} ({counts[c] ?? 0})
            </Chip>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-8 pb-24 pt-16">
        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">没有匹配的面料。</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((f) => {
              const img = fabricImage(f.id);
              const comp = compositionText(f);
              const price = priceValue(f.price_rmb_per_m);
              const quoteCount = (f.supplier_quotes ?? []).length;
              return (
                <li key={f.id}>
                  <Link to={`/fabric/${f.id}`} className="group block">
                    <div className="aspect-square w-full overflow-hidden bg-neutral-100">
                      {img ? (
                        <img
                          src={img.url}
                          alt={img.alt}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:opacity-90"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          aria-hidden
                        >
                          <span className="block h-px w-8 bg-neutral-300" />
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                        {CATEGORY_LABEL[f.category]}
                      </div>
                      <div className="text-sm font-medium leading-snug text-neutral-900">
                        {f.name}
                      </div>
                      {(comp || f.weight_gsm != null) && (
                        <div className="text-xs text-neutral-500">
                          {[comp, f.weight_gsm != null ? `${f.weight_gsm} g/㎡` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      {price != null ? (
                        <div className="pt-1 text-sm font-medium tabular-nums text-neutral-900">
                          ¥{price}/m
                        </div>
                      ) : quoteCount > 0 ? (
                        <div className="pt-1 text-xs text-neutral-500 tabular-nums">
                          {quoteCount} 家报价
                        </div>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px whitespace-nowrap border-b py-3 text-xs tracking-wide transition " +
        (active
          ? "border-neutral-900 text-neutral-900"
          : "border-transparent text-neutral-500 hover:text-neutral-700")
      }
    >
      {children}
    </button>
  );
}
