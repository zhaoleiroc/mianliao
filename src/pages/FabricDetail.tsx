import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { fabrics, fabricImage, fabricImages } from "../data";
import {
  CATEGORY_LABEL,
  FIBER_LABEL,
  type Fabric,
} from "../types";

function priceValue(
  p: number | string | null | undefined,
): number | null {
  if (p == null) return null;
  const n = typeof p === "number" ? p : parseFloat(String(p));
  return Number.isFinite(n) ? n : null;
}

function moneyText(
  p: number | string | null | undefined,
  prefix = "¥",
): string | null {
  const v = priceValue(p);
  return v == null ? null : `${prefix}${v}`;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center px-8 py-4">
          <Link to="/" className="text-sm font-medium tracking-tight">
            面料库
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-8 py-32">
        <p className="text-sm text-neutral-500">该面料不存在。</p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-neutral-900 underline-offset-4 hover:underline"
        >
          ← 返回面料库
        </Link>
      </div>
    </div>
  );
}

function SpecList({ fabric }: { fabric: Fabric }) {
  const fobStr = (() => {
    const v = moneyText(fabric.fob_usd_per_m, "$");
    return v == null ? null : `${v}/m`;
  })();
  const rows: [string, string | null][] = [
    ["规格", fabric.spec_raw ?? null],
    ["成分", fabric.composition_raw ?? null],
    [
      "克重",
      fabric.weight_gsm != null
        ? `${fabric.weight_gsm} g/㎡` +
          (fabric.weight_range
            ? ` (${fabric.weight_range.min}–${fabric.weight_range.max})`
            : "")
        : null,
    ],
    ["幅宽", fabric.width_cm != null ? `${fabric.width_cm} cm` : null],
    ["纱线", fabric.weave ?? null],
    ["组织", fabric.structure ?? null],
    ["后整理", fabric.finish ?? null],
    ["阻燃标准", fabric.fr_standard ?? null],
    ["布边", fabric.edge ?? null],
    [
      "起订量",
      fabric.moq != null && fabric.moq !== "" ? String(fabric.moq) : null,
    ],
    ["FOB 上海", fobStr],
    ["质感", fabric.texture ?? null],
    ["颜色", fabric.color ?? null],
  ];
  const visible = rows.filter(([, v]) => v != null && v !== "");
  if (visible.length === 0) return null;
  return (
    <dl>
      {visible.map(([k, v]) => (
        <div
          key={k}
          className="flex items-baseline justify-between gap-6 border-b border-neutral-100 py-3 text-sm last:border-0"
        >
          <dt className="text-neutral-500">{k}</dt>
          <dd className="text-right text-neutral-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function FiberChips({ fabric }: { fabric: Fabric }) {
  const entries = Object.entries(fabric.composition ?? {});
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="border border-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
        >
          {(FIBER_LABEL[k] ?? k) + (v ? ` ${Math.round(v)}%` : "")}
        </span>
      ))}
    </div>
  );
}

function QuoteTable({ fabric }: { fabric: Fabric }) {
  const quotes = fabric.supplier_quotes ?? [];
  if (quotes.length === 0) return null;
  const numerics = quotes.map((q) => ({
    ...q,
    num: priceValue(q.price_rmb_per_m),
  }));
  const minPrice = numerics.reduce<number | null>((acc, q) => {
    if (q.num == null) return acc;
    if (acc == null || q.num < acc) return q.num;
    return acc;
  }, null);
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
          供应商报价
        </h2>
        <span className="text-xs tabular-nums text-neutral-400">
          {quotes.length} 家
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              <th className="py-2 pr-6 font-normal">供应商</th>
              <th className="py-2 px-6 font-normal text-right">单价</th>
              <th className="py-2 px-6 font-normal">起订量</th>
              <th className="py-2 pl-6 font-normal">联系方式</th>
            </tr>
          </thead>
          <tbody>
            {numerics.map((q, i) => {
              const price = moneyText(q.price_rmb_per_m);
              const isMin =
                price != null && minPrice != null && q.num === minPrice;
              const contact = [q.phone, q.email].filter(Boolean).join(" · ");
              const moqStr =
                q.moq != null && q.moq !== "" ? String(q.moq) : null;
              return (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pr-6 align-top text-neutral-900">
                    <span className={isMin ? "font-medium" : undefined}>
                      {q.supplier}
                    </span>
                  </td>
                  <td className="py-3 px-6 align-top text-right">
                    {price ? (
                      <span
                        className={
                          isMin
                            ? "font-medium tabular-nums text-neutral-900"
                            : "tabular-nums text-neutral-900"
                        }
                      >
                        {price}
                        <span className="ml-1 text-xs text-neutral-500">/m</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 px-6 align-top tabular-nums text-neutral-600">
                    {moqStr}
                  </td>
                  <td className="py-3 pl-6 align-top text-xs text-neutral-600">
                    {contact || null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FabricDetail() {
  const { id } = useParams();
  const fabric = fabrics.find((f) => f.id === id);
  if (!fabric) return <NotFound />;

  const imgs = fabricImages(fabric.id);
  const main0 = fabricImage(fabric.id);
  const [activeIdx, setActiveIdx] = useState(0);
  const main = imgs[activeIdx] ?? main0;

  const price = priceValue(fabric.price_rmb_per_m);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link to="/" className="text-sm font-medium tracking-tight">
            面料库
          </Link>
          <Link
            to="/"
            className="text-xs text-neutral-500 transition hover:text-neutral-900"
          >
            ← 返回
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 pb-24 pt-16">
        <div className="grid gap-16 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100">
              {main ? (
                <img
                  src={main.url}
                  alt={main.alt}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  aria-hidden
                >
                  <span className="block h-px w-12 bg-neutral-300" />
                </div>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-6 gap-2">
                {imgs.slice(0, 6).map((it, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`第 ${i + 1} 张图`}
                    className={
                      "aspect-square overflow-hidden bg-neutral-100 transition " +
                      (i === activeIdx
                        ? "outline outline-1 outline-neutral-900"
                        : "opacity-70 hover:opacity-100")
                    }
                  >
                    <img
                      src={it.url}
                      alt={it.alt}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title + meta + specs */}
          <div className="space-y-10">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <span>{CATEGORY_LABEL[fabric.category]}</span>
                {fabric.flame_retardant && <span>· 阻燃</span>}
                {fabric.weight_gsm != null && (
                  <span className="text-neutral-400">
                    · {fabric.weight_gsm} g/㎡
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-medium leading-snug tracking-tight text-neutral-900">
                {fabric.name}
              </h1>
              {fabric.code && (
                <p className="mt-1.5 text-sm tabular-nums text-neutral-500">
                  {fabric.code}
                </p>
              )}
              {price != null && (
                <p className="mt-4 text-base font-medium tabular-nums text-neutral-900">
                  ¥{price}/m
                </p>
              )}
            </div>

            <SpecList fabric={fabric} />

            <FiberChips fabric={fabric} />

            {fabric.features && fabric.features.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                  面料特点
                </h2>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {fabric.features.map((f, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2 h-px w-3 flex-none bg-neutral-300"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {fabric.applications && fabric.applications.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                  适用产品
                </h2>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {fabric.applications.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2 h-px w-3 flex-none bg-neutral-300"
                      />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {(fabric.supplier_quotes ?? []).length > 0 && (
          <div className="mt-20">
            <QuoteTable fabric={fabric} />
          </div>
        )}
      </main>
    </div>
  );
}
