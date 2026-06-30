// src/admin/FabricForm.tsx
// Create / edit fabric form. Loads detail if /admin/fabrics/:id/edit.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminCreateFabric, adminUpdateFabric } from '../api/admin';
import { fetchDictionaries, fetchFabricDetail } from '../api/fabrics';
import type {
  Category,
  CreateFabricRequest,
  DictionaryBundle,
  FabricStatus,
} from '../types';
import { CATEGORY_LABEL } from '../types';

const FIBERS = [
  { code: 'polyester', label: '涤纶' },
  { code: 'cotton', label: '棉' },
  { code: 'spandex', label: '氨纶' },
  { code: 'nylon', label: '锦纶' },
  { code: 'recycled_polyester', label: '再生涤' },
  { code: 'modal', label: '莫代尔' },
  { code: 'rayon', label: '粘胶' },
  { code: 'linen', label: '亚麻' },
  { code: 'acrylic', label: '腈纶' },
  { code: 'wool', label: '羊毛' },
];

export default function FabricForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const nav = useNavigate();
  const [bundle, setBundle] = useState<DictionaryBundle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFabricRequest>({
    code: null,
    name: '',
    category: 'knit' as Category,
    supplierId: '',
    supplierBrand: null,
    compositionRaw: '',
    specRaw: '',
    widthCm: null,
    weightGsm: null,
    structure: '',
    finishRaw: '',
    texture: '',
    color: '',
    flameRetardant: false,
    frStandard: '',
    edge: '',
    moq: '',
    fobUsdPerM: null,
    priceRmbPerM: null,
    sellingPoints: '',
    notes: '',
    compositions: [],
    seasons: [],
    garmentStyles: [],
    featureTags: [],
    finishes: [],
    status: 'active' as FabricStatus,
  });

  useEffect(() => {
    fetchDictionaries().then(setBundle).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    fetchFabricDetail(id)
      .then((d) => {
        setForm({
          code: d.code,
          name: d.name,
          category: d.category,
          supplierId: '', // will be resolved below
          supplierBrand: d.supplierBrand,
          compositionRaw: d.compositionRaw,
          specRaw: d.specRaw,
          widthCm: d.widthCm,
          weightGsm: d.weightGsm,
          structure: d.structure,
          finishRaw: d.finishRaw,
          texture: d.texture,
          color: d.color,
          flameRetardant: d.flameRetardant,
          frStandard: d.frStandard,
          edge: d.edge,
          moq: d.moq,
          fobUsdPerM: d.fobUsdPerM,
          priceRmbPerM: d.priceRmbPerM,
          sellingPoints: d.sellingPoints,
          notes: d.notes,
          compositions: d.compositions.map((c: any) => ({ fiberCode: c.fiberCode, percentage: c.percentage })),
          seasons: d.seasons.map((s: any) => s.code),
          garmentStyles: d.garmentStyles.map((s: any) => s.code),
          featureTags: d.featureTags.map((s: any) => s.code),
          finishes: [],
          status: d.status,
        });
        // also resolve supplierId from bundle after bundle loads
      })
      .catch((e) => setError(e?.message ?? '加载失败'));
  }, [id, isEdit]);

  function set<K extends keyof CreateFabricRequest>(key: K, value: CreateFabricRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(field: 'seasons' | 'garmentStyles' | 'featureTags' | 'finishes', code: string) {
    setForm((prev) => {
      const arr = prev[field] ?? [];
      const next = arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code];
      return { ...prev, [field]: next };
    });
  }

  function setComposition(fiberCode: string, percentage: number) {
    setForm((prev) => {
      const arr = (prev.compositions ?? []).filter((c) => c.fiberCode !== fiberCode);
      if (percentage > 0) arr.push({ fiberCode, percentage });
      return { ...prev, compositions: arr };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && id) {
        await adminUpdateFabric(id, form);
      } else {
        await adminCreateFabric(form);
      }
      nav('/admin/fabrics');
    } catch (e: any) {
      setError(e?.message ?? '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-medium mb-6">{isEdit ? '编辑面料' : '新增面料'}</h1>
      {error && (
        <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-6">
        <Section title="基本信息">
          <div className="grid grid-cols-2 gap-4">
            <Field label="名称" required>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="编号">
              <input
                value={form.code ?? ''}
                onChange={(e) => set('code', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="品类" required>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as Category)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="供应商" required>
              <select
                value={form.supplierId}
                onChange={(e) => set('supplierId', e.target.value)}
                required
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              >
                <option value="">— 选择 —</option>
                {bundle?.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="供应商品牌">
              <input
                value={form.supplierBrand ?? ''}
                onChange={(e) => set('supplierBrand', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="状态">
              <select
                value={form.status ?? 'active'}
                onChange={(e) => set('status', e.target.value as FabricStatus)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              >
                <option value="active">在售</option>
                <option value="inactive">下架</option>
                <option value="draft">草稿</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="规格">
          <div className="grid grid-cols-2 gap-4">
            <Field label="幅宽 (cm)">
              <input
                type="number"
                value={form.widthCm ?? ''}
                onChange={(e) => set('widthCm', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="克重 (g/㎡)">
              <input
                type="number"
                value={form.weightGsm ?? ''}
                onChange={(e) => set('weightGsm', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="成分描述">
              <input
                value={form.compositionRaw ?? ''}
                onChange={(e) => set('compositionRaw', e.target.value || null)}
                placeholder="例：94%涤纶 + 6%氨纶"
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="规格原文">
              <input
                value={form.specRaw ?? ''}
                onChange={(e) => set('specRaw', e.target.value || null)}
                placeholder="例：165cm×380g/㎡"
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="组织">
              <input
                value={form.structure ?? ''}
                onChange={(e) => set('structure', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="后整理">
              <input
                value={form.finishRaw ?? ''}
                onChange={(e) => set('finishRaw', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
          </div>
        </Section>

        <Section title="成分百分比（可选）">
          <div className="grid grid-cols-2 gap-3">
            {FIBERS.map((f) => {
              const cur = form.compositions?.find((c) => c.fiberCode === f.code);
              return (
                <div key={f.code} className="flex items-center gap-2 text-sm">
                  <span className="w-24 text-neutral-600">{f.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={cur?.percentage ?? ''}
                    onChange={(e) => setComposition(f.code, Number(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-neutral-300"
                    placeholder="0"
                  />
                  <span className="text-xs text-neutral-400">%</span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="多选属性">
          <MultiChips
            label="适用季节"
            options={bundle?.seasons.map((s) => ({ code: s.code, label: s.label })) ?? []}
            selected={form.seasons ?? []}
            onToggle={(c) => toggleArrayItem('seasons', c)}
          />
          <MultiChips
            label="推荐款式"
            options={bundle?.garmentStyles.map((s) => ({ code: s.code, label: s.label })) ?? []}
            selected={form.garmentStyles ?? []}
            onToggle={(c) => toggleArrayItem('garmentStyles', c)}
          />
          <MultiChips
            label="特性标签"
            options={bundle?.featureTags.map((s) => ({ code: s.code, label: s.label })) ?? []}
            selected={form.featureTags ?? []}
            onToggle={(c) => toggleArrayItem('featureTags', c)}
          />
          <MultiChips
            label="后整理"
            options={bundle?.finishes.map((s) => ({ code: s.code, label: s.label })) ?? []}
            selected={form.finishes ?? []}
            onToggle={(c) => toggleArrayItem('finishes', c)}
          />
        </Section>

        <Section title="价格 / MOQ / 阻燃">
          <div className="grid grid-cols-2 gap-4">
            <Field label="RMB 价格 (元/m)">
              <input
                type="number"
                step="0.01"
                value={form.priceRmbPerM ?? ''}
                onChange={(e) => set('priceRmbPerM', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="FOB 价格 (USD/m)">
              <input
                type="number"
                step="0.01"
                value={form.fobUsdPerM ?? ''}
                onChange={(e) => set('fobUsdPerM', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="起订量">
              <input
                value={form.moq ?? ''}
                onChange={(e) => set('moq', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="布边">
              <input
                value={form.edge ?? ''}
                onChange={(e) => set('edge', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
            <Field label="阻燃">
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.flameRetardant ?? false}
                  onChange={(e) => set('flameRetardant', e.target.checked)}
                />
                阻燃面料
              </label>
            </Field>
            <Field label="阻燃标准">
              <input
                value={form.frStandard ?? ''}
                onChange={(e) => set('frStandard', e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300"
              />
            </Field>
          </div>
        </Section>

        <Section title="文案 / 备注">
          <Field label="卖点文案（30-80 字）">
            <textarea
              value={form.sellingPoints ?? ''}
              onChange={(e) => set('sellingPoints', e.target.value || null)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-neutral-300"
            />
          </Field>
          <Field label="备注">
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-neutral-300"
            />
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-neutral-900 text-white text-sm hover:bg-neutral-700 disabled:opacity-50"
          >
            {submitting ? '保存中…' : isEdit ? '保存修改' : '创建面料'}
          </button>
          <button
            type="button"
            onClick={() => nav('/admin/fabrics')}
            className="px-4 py-2 text-sm border border-neutral-300 hover:bg-neutral-100"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-600">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function MultiChips({
  label, options, selected, onToggle,
}: { label: string; options: { code: string; label: string }[]; selected: string[]; onToggle: (code: string) => void }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-neutral-600 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 ? (
          <span className="text-xs text-neutral-400">（字典未加载）</span>
        ) : options.map((o) => {
          const on = selected.includes(o.code);
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => onToggle(o.code)}
              className={`px-2 py-0.5 text-xs border ${on ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
