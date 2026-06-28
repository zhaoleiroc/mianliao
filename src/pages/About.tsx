import { fabricMeta } from "../data";
import { CATEGORY_LABEL, type Category } from "../types";

export default function About() {
  return (
    <div className="container-page py-12 max-w-3xl">
      <div className="label">About</div>
      <h1 className="font-serif text-3xl text-ink">关于这个网站</h1>

      <div className="prose prose-stone mt-6 space-y-5 text-stone-700 leading-relaxed">
        <p>
          这是一个私人面料选品库。数据全部来自本地{" "}
          <code className="font-mono text-sm bg-stone-100 px-1.5 py-0.5 rounded">
            面料推荐档案/
          </code>{" "}
          下的 Excel，通过{" "}
          <code className="font-mono text-sm bg-stone-100 px-1.5 py-0.5 rounded">
            scripts/extract_fabrics.py
          </code>{" "}
          清洗后输出 JSON，再由 Vite + React + Tailwind 渲染成静态页面。
        </p>

        <h2 className="font-serif text-xl text-ink">数据来源</h2>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {Object.entries(fabricMeta.counts).map(([k, n]) => (
            <li key={k}>
              <code className="font-mono">{k}</code> · {n as number} 条
            </li>
          ))}
        </ul>

        <h2 className="font-serif text-xl text-ink">四个品类</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <div key={c} className="surface p-4">
              <div className="text-sm font-semibold text-ink">{CATEGORY_LABEL[c]}</div>
              <div className="mt-1 text-xs text-stone-500">
                款式见左侧导航
              </div>
            </div>
          ))}
        </div>

        <h2 className="font-serif text-xl text-ink">如何更新数据</h2>
        <pre className="overflow-x-auto rounded-xl bg-stone-900 px-4 py-3 text-xs text-stone-100">
{[`# 1. 修改面料推荐档案下的源文件`, `# 2. 重新提取`, `python scripts/extract_fabrics.py`, `# 3. 重新归档图片`, `python scripts/archive_images.py --apply`, `# 4. 重新构建`, `npm run build`].join("\n")}
        </pre>

        <h2 className="font-serif text-xl text-ink">已知缺口</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-stone-600">
          <li>home_textile 的 MOQ / FOB 上海在源表里就是空白。</li>
          <li>华瑞 / 万泰 / 中涛三时没有价格和联系方式字段。</li>
          <li>22 张 PNG 默认归到 huarui（基于同目录启发式），需要逐张人工校对。</li>
        </ul>
      </div>
    </div>
  );
}
