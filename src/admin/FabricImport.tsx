// src/admin/FabricImport.tsx
// Bulk import via CSV/XLSX upload.

import { useState } from 'react';
import { adminImportFabrics } from '../api/admin';
import type { ImportResultDto } from '../types';

export default function FabricImport() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await adminImportFabrics(file);
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? '导入失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-medium">批量导入面料</h1>
      <p className="text-sm text-neutral-600">
        支持 .csv / .xlsx 文件。字段需匹配 25 列钉钉 AI 表格模板（编号、名称、品类、供应商、成分描述、纤维百分比、规格、克重、季节、款式、特性等）。
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm"
        />
        <button
          type="submit"
          disabled={!file || submitting}
          className="px-4 py-2 bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? '导入中…' : '开始导入'}
        </button>
      </form>

      {error && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="border border-neutral-200 bg-white p-5 space-y-3">
          <div className="text-sm font-medium">导入结果</div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div><span className="text-neutral-500">文件</span><div className="truncate">{result.filename}</div></div>
            <div><span className="text-neutral-500">总行数</span><div className="tabular-nums">{result.totalRows}</div></div>
            <div className="text-green-700"><span className="text-neutral-500">成功</span><div className="tabular-nums">{result.successCount}</div></div>
            <div className="text-red-700"><span className="text-neutral-500">失败</span><div className="tabular-nums">{result.failedCount}</div></div>
          </div>
          <div className="text-xs text-neutral-500">耗时 {result.durationMs}ms</div>
          {result.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-red-700">查看错误明细（{result.errors.length} 条）</summary>
              <pre className="mt-3 p-3 bg-red-50 text-xs overflow-auto max-h-80">
                {JSON.stringify(result.errors, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
