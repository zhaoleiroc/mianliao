import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/fabrics", label: "面料库" },
  { to: "/suppliers", label: "供应商" },
  { to: "/compare", label: "报价对比" },
  { to: "/about", label: "关于" },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-canvas/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-canvas font-serif text-lg">
              织
            </span>
            <span className="font-serif text-xl tracking-wide">面料图鉴</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-stone-400 sm:inline">
              Fabric Atlas
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  "rounded-full px-4 py-2 text-sm font-medium transition " +
                  (isActive ? "bg-ink text-canvas" : "text-stone-600 hover:text-ink")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <button
            className="md:hidden rounded-full p-2 text-ink hover:bg-stone-200/60"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-stone-200/70 bg-canvas">
            <div className="container-page flex flex-col py-3">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    "rounded-lg px-3 py-3 text-sm font-medium " +
                    (isActive ? "bg-ink text-canvas" : "text-stone-700 hover:bg-stone-200/60")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main key={pathname} className="flex-1 animate-fade-in">
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-stone-200/70 py-10">
        <div className="container-page flex flex-col items-start gap-3 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-serif text-base text-ink">面料图鉴</span>
            <span className="ml-2">· Fabric Atlas</span>
          </div>
          <div className="text-xs">
            私人选品库 · 数据源自{" "}
            <a
              className="text-ink underline-offset-4 hover:underline"
              href="https://github.com/zhaoleiroc/mianliao"
              target="_blank"
              rel="noreferrer"
            >
              zhaoleiroc/mianliao
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
