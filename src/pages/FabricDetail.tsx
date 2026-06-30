import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchFabricDetail, imageUrl } from "../api/fabrics";
import { CATEGORY_LABEL, type FabricDetailDto } from "../types";

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

function SpecList({ fabric }: { fabric: FabricDetailDto }) {
  const fobStr =
    fabric.fobUsdPerM != null ? `$${fabric.fobUsdPerM}/m` : null;
  const rows: [string, string | null][] = [
    ["规格", fabric.specRaw],
    ["成分", fabric.compositionRaw],
    [
      "克重",
      fabric.weightGsm != null
        ? `${fabric.weightGsm} g/㎡` +
          (fabric.weightRangeMin != null && fabric.weightRangeMax != null
            ? ` (${fabric.weightRangeMin}–${fabric.weightRangeMax})`
            : "")
        : null,
    ],
    ["幅宽", fabric.widthCm != null ? `${fabric.widthCm} cm` : null],
    ["组织", fabric.structure],
    ["后整理", fabric.finishRaw],
    ["阻燃标准", fabric.frStandard],
    ["布边", fabric.edge],
    ["起订量", fabric.moq != null && fabric.moq !== "" ? fabric.moq : null],
    ["FOB 上海", fobStr],
    ["质感", fabric.texture],
    ["颜色", fabric.color],
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

function FiberChips({ fabric }: { fabric: FabricDetailDto }) {
  if (fabric.compositions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fabric.compositions.map((c) => (
        <span
          key={c.fiberCode}
          className="border border-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
        >
          {c.fiberLabel} {Math.round(c.percentage)}%
        </span>
      ))}
    </div>
  );
}

function QuoteTable({ fabric }: { fabric: FabricDetailDto }) {
  const quotes = fabric.supplierQuotes;
  if (quotes.length === 0) return null;
  const minPrice = quotes.reduce<number | null>((acc, q) => {
    if (q.priceRmbPerM == null) return acc;
    if (acc == null || q.priceRmbPerM < acc) return q.priceRmbPerM;
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
            {quotes.map((q) => {
              const isMin =
                q.priceRmbPerM != null && minPrice != null && q.priceRmbPerM === minPrice;
              const contact = [q.phone, q.email].filter(Boolean).join(" · ");
              return (
                <tr key={q.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pr-6 align-top text-neutral-900">
                    <span className={isMin ? "font-medium" : undefined}>
                      {q.supplierName}
                    </span>
                  </td>
                  <td className="py-3 px-6 align-top text-right">
                    {q.priceRmbPerM != null ? (
                      <span
                        className={
                          isMin
                            ? "font-medium tabular-nums text-neutral-900"
                            : "tabular-nums text-neutral-900"
                        }
                      >
                        ¥{q.priceRmbPerM}
                        <span className="ml-1 text-xs text-neutral-500">/m</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 px-6 align-top tabular-nums text-neutral-600">
                    {q.moq ?? null}
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

function SimilarFabrics({ list }: { list: FabricDetailDto["similarFabrics"] }) {
  if (list.length === 0) return null;
  return (
    <section className="mt-20">
      <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
        相似款
      </h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
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
                      className="h-full w-full object-cover transition group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" aria-hidden>
                      <span className="block h-px w-6 bg-neutral-300" />
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-neutral-700 truncate">{f.name}</div>
                {f.weightGsm != null && (
                  <div className="text-[10px] text-neutral-400">{f.weightGsm} g/㎡</div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function FabricDetail() {
  const { id } = useParams();
  const [fabric, setFabric] = useState<FabricDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchFabricDetail(id)
      .then((data) => {
        if (cancelled) return;
        setFabric(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 404) setNotFound(true);
        else setNotFound(true); // treat as not found to keep UI simple
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) return <NotFound />;

  if (loading || !fabric) {
    return (
      <div className="min-h-screen bg-white text-neutral-900">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-6xl items-center px-8 py-4">
            <Link to="/" className="text-sm font-medium tracking-tight">
              面料库
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-8 py-32 text-sm text-neutral-500">加载中…</div>
      </div>
    );
  }

  const imgs = fabric.images;
  const main = imgs[activeIdx] ?? imgs[0];
  const mainSrc = imageUrl(main?.url);

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
              {mainSrc ? (
                <img
                  src={mainSrc}
                  alt={main?.alt ?? fabric.name}
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
                {imgs.slice(0, 6).map((it, i) => {
                  const src = imageUrl(it.url);
                  return (
                    <button
                      key={it.id}
                      onClick={() => setActiveIdx(i)}
                      aria-label={`第 ${i + 1} 张图`}
                      className={
                        "aspect-square overflow-hidden bg-neutral-100 transition " +
                        (i === activeIdx
                          ? "outline outline-1 outline-neutral-900"
                          : "opacity-70 hover:opacity-100")
                      }
                    >
                      {src && <img src={src} alt={it.alt ?? ''} className="h-full w-full object-cover" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title + meta + specs */}
          <div className="space-y-10">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <span>{CATEGORY_LABEL[fabric.category]}</span>
                {fabric.flameRetardant && <span>· 阻燃</span>}
                {fabric.weightGsm != null && (
                  <span className="text-neutral-400">· {fabric.weightGsm} g/㎡</span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-medium leading-snug tracking-tight text-neutral-900">
                {fabric.name}
              </h1>
              {fabric.code && (
                <p className="mt-1.5 text-sm tabular-nums text-neutral-500">{fabric.code}</p>
              )}
              {fabric.priceRmbPerM != null && (
                <p className="mt-4 text-base font-medium tabular-nums text-neutral-900">
                  ¥{fabric.priceRmbPerM}/m
                </p>
              )}
              {fabric.sellingPoints && (
                <p className="mt-3 text-sm text-neutral-600">{fabric.sellingPoints}</p>
              )}
            </div>

            <SpecList fabric={fabric} />
            <FiberChips fabric={fabric} />

            {(fabric.seasons.length > 0 ||
              fabric.garmentStyles.length > 0 ||
              fabric.featureTags.length > 0) && (
              <section className="space-y-2 text-sm">
                {fabric.seasons.length > 0 && (
                  <div className="flex gap-3">
                    <span className="w-16 text-neutral-500">季节</span>
                    <div className="flex flex-wrap gap-1.5">
                      {fabric.seasons.map((s) => (
                        <span key={s.code} className="border border-neutral-200 px-2 py-0.5 text-xs">{s.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {fabric.garmentStyles.length > 0 && (
                  <div className="flex gap-3">
                    <span className="w-16 text-neutral-500">款式</span>
                    <div className="flex flex-wrap gap-1.5">
                      {fabric.garmentStyles.map((s) => (
                        <span key={s.code} className="border border-neutral-200 px-2 py-0.5 text-xs">{s.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {fabric.featureTags.length > 0 && (
                  <div className="flex gap-3">
                    <span className="w-16 text-neutral-500">特性</span>
                    <div className="flex flex-wrap gap-1.5">
                      {fabric.featureTags.map((s) => (
                        <span key={s.code} className="border border-neutral-200 px-2 py-0.5 text-xs">{s.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {fabric.supplierQuotes.length > 0 && (
          <div className="mt-20">
            <QuoteTable fabric={fabric} />
          </div>
        )}

        <SimilarFabrics list={fabric.similarFabrics} />
      </main>
    </div>
  );
}
