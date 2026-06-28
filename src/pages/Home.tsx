import { Link } from "react-router-dom";
import { ArrowRight, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { fabrics, fabricMeta } from "../data";
import { CATEGORY_LABEL, CATEGORY_DESC, type Category } from "../types";
import FabricCard from "../components/FabricCard";

const CATEGORY_ORDER: Category[] = ["knit", "woven", "pu_suede", "home_textile"];

export default function Home() {
  const featured = fabrics
    .filter((f) => f.supplier_quotes && f.supplier_quotes.length > 0)
    .slice(0, 4);

  const supplierCount = new Set<string>();
  for (const f of fabrics) {
    for (const q of f.supplier_quotes ?? []) {
      if (q.supplier) supplierCount.add(q.supplier);
    }
  }

  const fibers = (() => {
    const m = new Map<string, number>();
    for (const f of fabrics) {
      for (const k of Object.keys(f.composition ?? {})) {
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    const labelOf = (k: string) => {
      const map: Record<string, string> = {
        polyester: "涤纶",
        recycled_polyester: "再生涤",
        cotton: "棉",
        nylon: "锦纶",
        spandex: "氨纶",
        modal: "莫代尔",
        rayon: "粘胶",
        linen: "亚麻",
        acrylic: "腈纶",
      };
      return map[k] ?? k;
    };
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, n]) => ({ key: k, label: labelOf(k), count: n }));
  })();

  const categoryCount = (c: Category) => fabrics.filter((f) => f.category === c).length;

  return (
    <>
      <section className="container-page pt-16 pb-12 sm:pt-24 sm:pb-20">
        <div className="grid items-end gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="label">Fabric Atlas · 面料图鉴</div>
            <h1 className="display mt-3 text-ink">
              把每一块面料
              <br />
              <span className="italic text-accent">都讲清楚。</span>
            </h1>
            <p className="mt-6 max-w-xl text-stone-600 leading-relaxed">
              一个私人选品库，覆盖 {fabricMeta.total} 款针织、化纤、PU 与家纺阻燃面料；
              来自 {Object.keys(fabricMeta.counts).length} 个数据源、{supplierCount.size} 家供应商的报价对比。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/fabrics" className="btn-primary">
                浏览面料库 <ArrowRight size={14} />
              </Link>
              <Link to="/compare" className="btn-ghost">
                查看报价对比
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_ORDER.map((c) => (
              <Link
                key={c}
                to={`/fabrics?category=${c}`}
                className="surface group p-5 transition hover:-translate-y-0.5"
              >
                <div className="label">{CATEGORY_LABEL[c]}</div>
                <div className="mt-1 text-2xl font-serif text-ink">{categoryCount(c)}</div>
                <div className="mt-1 text-xs text-stone-500">{CATEGORY_DESC[c]}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page border-t border-stone-200/70 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "规格透明",
              body: "克重、幅宽、成分、阻燃标准、供应商联系方式一站可查。",
            },
            {
              icon: Flame,
              title: "多供应商比价",
              body: "同一款 3S-AVVA 针织面料自动比 7 家供应商，差价直观可见。",
            },
            {
              icon: Sparkles,
              title: "可复用的清洗流水线",
              body: "原始 Excel 改一遍即可重跑 scripts/extract_fabrics.py，全站自动更新。",
            },
          ].map((p) => (
            <div key={p.title} className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-200/60 text-ink">
                <p.icon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">{p.title}</h3>
                <p className="mt-1 text-sm text-stone-600 leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="label">Featured</div>
            <h2 className="mt-1 font-serif text-2xl text-ink">多供应商报价精选</h2>
          </div>
          <Link to="/compare" className="text-sm text-accent hover:text-accentHover">
            全部 13 款 →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((f) => (
            <FabricCard key={f.id} fabric={f} />
          ))}
        </div>
      </section>

      <section className="container-page py-12">
        <div className="label">Composition</div>
        <h2 className="mt-1 mb-5 font-serif text-2xl text-ink">主要纤维分布</h2>
        <div className="flex flex-wrap gap-2">
          {fibers.map((f) => (
            <Link
              key={f.key}
              to={`/fabrics?fiber=${f.key}`}
              className="chip hover:border-ink hover:text-ink"
            >
              {f.label} <span className="text-stone-400">· {f.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
