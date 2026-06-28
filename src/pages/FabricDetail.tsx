import { useParams, Link } from "react-router-dom";
import { Phone, Mail, Flame, ImageOff } from "lucide-react";
import { fabrics, fabricImages, fabricImage } from "../data";
import { CATEGORY_LABEL, FIBER_LABEL } from "../types";
import BackButton from "../components/BackButton";

export default function FabricDetail() {
  const { id } = useParams();
  const fabric = fabrics.find((f) => f.id === id);

  if (!fabric) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-serif text-2xl text-ink">未找到该面料</h1>
        <BackButton to="/fabrics" label="返回面料库" />
      </div>
    );
  }

  const imgs = fabricImages(fabric.id);
  const mainImg = imgs[0] ?? fabricImage(fabric.id);
  const supplier = fabric.supplier ?? fabric.supplier_brand ?? "—";

  const quotes = (fabric.supplier_quotes ?? []).slice();
  const numericQuotes = quotes
    .map((q) => ({
      ...q,
      num: typeof q.price_rmb_per_m === "number"
        ? q.price_rmb_per_m
        : parseFloat(String(q.price_rmb_per_m ?? "")) || NaN,
    }))
    .filter((q) => !isNaN(q.num));
  const minPrice = numericQuotes.length ? Math.min(...numericQuotes.map((q) => q.num)) : null;

  return (
    <div className="container-page py-10">
      <BackButton to="/fabrics" label="返回面料库" />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="surface aspect-[4/3] overflow-hidden bg-stone-100">
            {mainImg ? (
              <img src={mainImg.url} alt={mainImg.alt} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-stone-300">
                <ImageOff size={64} />
              </div>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {imgs.slice(0, 5).map((it, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                  <img src={it.url} alt={it.alt} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{CATEGORY_LABEL[fabric.category]}</span>
            {fabric.flame_retardant && (
              <span className="chip bg-amber-100/70 border-amber-200 text-amber-900">
                <Flame size={11} /> FR 阻燃
              </span>
            )}
            {fabric.code && <span className="chip font-mono">{fabric.code}</span>}
          </div>
          <h1 className="mt-3 font-serif text-3xl text-ink">{fabric.name}</h1>
          <Link
            to={`/fabrics?supplier=${encodeURIComponent(supplier)}`}
            className="mt-1 inline-block text-sm text-stone-500 hover:text-ink"
          >
            {supplier} →
          </Link>

          {minPrice != null && (
            <div className="surface mt-6 p-4">
              <div className="label">最低报价</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-3xl text-accent">¥{minPrice.toFixed(0)}</span>
                <span className="text-sm text-stone-500">/米 · {numericQuotes.length} 家供应商</span>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="label">规格</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {fabric.weight_gsm != null && (
                <Spec k="克重" v={fabric.weight_gsm + " g/㎡" + (fabric.weight_range ? " (" + fabric.weight_range.min + "-" + fabric.weight_range.max + ")" : "")} />
              )}
              {fabric.width_cm != null && <Spec k="幅宽" v={fabric.width_cm + " cm"} />}
              {fabric.spec_raw && <Spec k="原始规格" v={fabric.spec_raw} />}
              {fabric.weave && <Spec k="纱线" v={fabric.weave} />}
              {fabric.structure && <Spec k="组织" v={fabric.structure} />}
              {fabric.finish && <Spec k="后整理" v={fabric.finish} />}
              {fabric.fr_standard && <Spec k="阻燃标准" v={fabric.fr_standard} />}
              {fabric.edge && <Spec k="布边" v={fabric.edge} />}
              {fabric.moq != null && fabric.moq !== "" && <Spec k="起订量" v={String(fabric.moq)} />}
              {fabric.fob_usd_per_m != null && fabric.fob_usd_per_m !== "" && (
                <Spec k="FOB 上海" v={"$" + fabric.fob_usd_per_m + "/m"} />
              )}
              {fabric.price_rmb_per_m != null && <Spec k="单价" v={"¥" + fabric.price_rmb_per_m + "/m"} />}
            </dl>
          </div>

          {fabric.composition && Object.keys(fabric.composition).length > 0 && (
            <div className="mt-6">
              <div className="label">成分</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(fabric.composition)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span key={k} className="chip">
                      {FIBER_LABEL[k] ?? k} {Math.round(v)}%
                    </span>
                  ))}
              </div>
              {fabric.composition_raw && (
                <div className="mt-2 text-xs text-stone-500">原文：{fabric.composition_raw}</div>
              )}
            </div>
          )}

          {(fabric.texture || fabric.color) && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {fabric.texture && <Spec k="纹理" v={fabric.texture} />}
              {fabric.color && <Spec k="色系" v={fabric.color} />}
            </div>
          )}

          {fabric.features && fabric.features.length > 0 && (
            <div className="mt-6">
              <div className="label">核心特点</div>
              <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
                {fabric.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fabric.applications && fabric.applications.length > 0 && (
            <div className="mt-6">
              <div className="label">推荐用途</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {fabric.applications.map((a) => (
                  <span key={a} className="chip">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {quotes.length > 0 && (
        <section className="mt-14">
          <div className="mb-4">
            <div className="label">Pricing</div>
            <h2 className="mt-1 font-serif text-2xl text-ink">多供应商报价</h2>
          </div>
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">供应商</th>
                  <th className="px-4 py-3 text-right">单价 (¥/m)</th>
                  <th className="px-4 py-3 text-right">起订量</th>
                  <th className="px-4 py-3">联系方式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70">
                {quotes
                  .slice()
                  .sort((a, b) => {
                    const an = typeof a.price_rmb_per_m === "number" ? a.price_rmb_per_m : parseFloat(String(a.price_rmb_per_m)) || 1e9;
                    const bn = typeof b.price_rmb_per_m === "number" ? b.price_rmb_per_m : parseFloat(String(b.price_rmb_per_m)) || 1e9;
                    return an - bn;
                  })
                  .map((q) => {
                    const n = typeof q.price_rmb_per_m === "number" ? q.price_rmb_per_m : parseFloat(String(q.price_rmb_per_m));
                    const isMin = minPrice != null && !isNaN(n) && n === minPrice;
                    return (
                      <tr key={q.supplier} className={isMin ? "bg-amber-50/60" : ""}>
                        <td className="px-4 py-3 font-medium text-ink">
                          {q.supplier}
                          {isMin && <span className="ml-2 text-xs text-accent">最低</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {q.price_rmb_per_m != null ? "¥" + q.price_rmb_per_m : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-stone-500">{q.moq ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {q.phone && (
                            <a href={"tel:" + q.phone} className="mr-3 inline-flex items-center gap-1 hover:text-ink">
                              <Phone size={11} /> {q.phone}
                            </a>
                          )}
                          {q.email && (
                            <a href={"mailto:" + q.email} className="inline-flex items-center gap-1 hover:text-ink">
                              <Mail size={11} /> {q.email}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-12 text-xs text-stone-400">
        <div className="label">Source</div>
        <div className="mt-1">
          {fabric.source_file}
          {fabric.source_row ? " · row " + fabric.source_row : ""}
        </div>
      </section>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{k}</dt>
      <dd className="text-sm text-ink">{v}</dd>
    </div>
  );
}
