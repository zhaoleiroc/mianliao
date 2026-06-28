import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <div className="label">404</div>
      <h1 className="mt-2 font-serif text-5xl text-ink">页面未找到</h1>
      <p className="mt-3 text-stone-500">你访问的链接可能已失效。</p>
      <Link to="/" className="btn-primary mt-8">返回首页</Link>
    </div>
  );
}
