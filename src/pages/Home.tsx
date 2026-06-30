import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchFabrics, imageUrl } from "../api/fabrics";
import {
  CATEGORY_LABEL,
  type Category,
  type FabricListItemDto,
} from "../types";

const CATS: Category[] = ["knit", "woven", "pu_suede", "home_textile"];

export default function Home() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [items, setItems] = useState<FabricListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load on mount + when category changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFabrics({ category: cat === "all" ? undefined : cat, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cat]);

  // Local search filter on top of the server-filtered list
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return items;
    return items.filter((f) => {
      const hay = (f.name + " " + (f.code ?? "") + " " + (f.supplierName ?? "") + " " +
        (f.compositionLabel ?? "")).toLowerCase();
      return hay.includes(ql);
    });
  }, [q, items]);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link to="/" className="text-sm font-medium tracking-tight">
            面料库
          </Link>
          <div className="flex items-center gap-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索名称 / 编号 / 成分"
              className="w-56 border-b border-neutral-200 bg-transparent py-1 text-right text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
            />
            <Link
              to="/admin"
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              后台
            </Link>
          </div>
        </div>
      </header>

      <nav className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center gap-8 overflow-x-auto px-8">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            全部 ({total})
          </Chip>
          {CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-8 pb-24 pt-16">
        {error && (
          <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-neutral-500">加载中…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-neutral-500">没有匹配的面料。</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((f) => {
              const cover = imageUrl(f.coverImageUrl);
              return (
                <li key={f.id}>
                  <Link to={`/fabric/${f.id}`} className="group block">
                    <div className="aspect-square w-full overflow-hidden bg-neutral-100">
                      {cover ? (
                        <img
                          src={cover}
                          alt={f.name}
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
                        {f.categoryLabel}
                      </div>
                      <div className="text-sm font-medium leading-snug text-neutral-900">
                        {f.name}
                      </div>
                      {(f.compositionLabel || f.weightGsm != null) && (
                        <div className="text-xs text-neutral-500">
                          {[f.compositionLabel, f.weightGsm != null ? `${f.weightGsm} g/㎡` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      {f.priceRmbPerM != null ? (
                        <div className="pt-1 text-sm font-medium tabular-nums text-neutral-900">
                          ¥{f.priceRmbPerM}/m
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
