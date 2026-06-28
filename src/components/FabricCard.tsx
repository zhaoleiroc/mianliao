import { Link } from "react-router-dom";
import { Flame, ImageOff } from "lucide-react";
import type { Fabric } from "../types";
import { CATEGORY_LABEL, FIBER_LABEL } from "../types";
import { fabricImage } from "../data";

interface Props {
  fabric: Fabric;
}

function compPills(fabric: Fabric): { label: string; pct?: number }[] {
  const c = fabric.composition ?? {};
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ label: FIBER_LABEL[k] ?? k, pct: v }));
}

export default function FabricCard({ fabric }: Props) {
  const img = fabricImage(fabric.id);
  const supplier = fabric.supplier ?? fabric.supplier_brand ?? "—";

  return (
    <Link
      to={`/fabrics/${fabric.id}`}
      className="surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        {img ? (
          <img
            src={img.url}
            alt={img.alt}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <ImageOff size={40} />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
            {CATEGORY_LABEL[fabric.category]}
          </span>
          {fabric.flame_retardant && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/95 px-2.5 py-1 text-[11px] font-medium text-amber-900">
              <Flame size={11} /> FR
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <div className="label">{supplier}</div>
          <h3 className="mt-0.5 text-base font-semibold text-ink line-clamp-1">
            {fabric.name}
          </h3>
          {fabric.code && (
            <div className="mt-0.5 text-xs text-stone-400 font-mono">{fabric.code}</div>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {compPills(fabric).map((p) => (
            <span key={p.label} className="chip">
              {p.label}
              {p.pct != null ? " " + Math.round(p.pct) + "%" : ""}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-stone-500">
          {fabric.weight_gsm != null && <span>{fabric.weight_gsm} g/㎡</span>}
          {fabric.width_cm != null && <span>{fabric.width_cm} cm</span>}
          {fabric.price_rmb_per_m != null && (
            <span className="text-accent">¥{fabric.price_rmb_per_m}/m</span>
          )}
          {fabric.supplier_quotes && fabric.supplier_quotes.length > 0 && (
            <span className="text-accent">{fabric.supplier_quotes.length} 家报价</span>
          )}
        </div>
      </div>
    </Link>
  );
}
