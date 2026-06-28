import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ to = "/", label = "返回" }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink"
    >
      <ArrowLeft size={14} /> {label}
    </Link>
  );
}
