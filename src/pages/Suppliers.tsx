import { suppliers } from "../data";
import { Link } from "react-router-dom";
import SupplierCard from "../components/SupplierCard";

export default function Suppliers() {
  const sorted = suppliers
    .slice()
    .sort((a, b) => b.fabric_count - a.fabric_count || b.quote_count - a.quote_count);

  const withQuotes = sorted.filter((s) => s.phone || s.email);
  const others = sorted.filter((s) => !s.phone && !s.email);

  return (
    <div className="container-page py-10">
      <div className="label">Directory</div>
      <h1 className="font-serif text-3xl text-ink">供应商目录</h1>
      <p className="mt-1 text-sm text-stone-500">
        共 {suppliers.length} 家 · 联系方式仅在 3S-AVVA 多供应商报价中提供
      </p>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg text-ink">含联系方式</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withQuotes.map((s) => (
            <SupplierCard key={s.name} supplier={s} />
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-lg text-ink">仅出现在面料记录中</h2>
          <div className="surface divide-y divide-stone-200/70">
            {others.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium text-ink">{s.name}</div>
                  <div className="text-xs text-stone-500">{s.fabric_count} 款面料</div>
                </div>
                <Link
                  to={`/fabrics?supplier=${encodeURIComponent(s.name)}`}
                  className="text-xs text-accent hover:text-accentHover"
                >
                  查看 →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
