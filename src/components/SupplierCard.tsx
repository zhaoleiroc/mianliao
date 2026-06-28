import { Link } from "react-router-dom";
import { Phone, Mail } from "lucide-react";
import type { Supplier } from "../types";

interface Props {
  supplier: Supplier;
}

export default function SupplierCard({ supplier }: Props) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{supplier.name}</h3>
          <div className="mt-1 text-xs text-stone-500">
            {supplier.fabric_count} 款面料
            {supplier.quote_count > 0 && " · " + supplier.quote_count + " 条报价"}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-stone-600">
        {supplier.phone && (
          <a
            href={"tel:" + supplier.phone}
            className="flex items-center gap-2 hover:text-ink"
          >
            <Phone size={13} className="text-stone-400" />
            <span className="font-mono text-xs">{supplier.phone}</span>
          </a>
        )}
        {supplier.email && (
          <a
            href={"mailto:" + supplier.email}
            className="flex items-center gap-2 hover:text-ink"
          >
            <Mail size={13} className="text-stone-400" />
            <span className="text-xs">{supplier.email}</span>
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link
          to={`/fabrics?supplier=${encodeURIComponent(supplier.name)}`}
          className="text-accent hover:text-accentHover"
        >
          查看面料 →
        </Link>
      </div>
    </div>
  );
}
