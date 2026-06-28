import fabricsJson from "../data/fabrics.json";
import suppliersJson from "../data/suppliers.json";
import stylesJson from "../data/styles.json";
import manifestJson from "../data/image_manifest.json";
import type { Fabric, Supplier, StyleNote, ImageManifest } from "./types";

export const fabrics = fabricsJson.fabrics as unknown as Fabric[];
export const fabricMeta = {
  generated_at: fabricsJson.generated_at as string,
  schema_version: fabricsJson.schema_version as number,
  counts: fabricsJson.counts as Record<string, number>,
  total: fabricsJson.total as number,
};

export const suppliers = suppliersJson.suppliers as unknown as Supplier[];

export const styles = stylesJson.styles as unknown as StyleNote[];

export const imageManifest = manifestJson as unknown as ImageManifest;

export const imageIndex: Record<string, ImageManifest["items"]> = {};
for (const item of imageManifest.items) {
  const key = item.matched_fabric_id ?? item.sha1_8;
  (imageIndex[key] ||= []).push(item);
}

/** Convert a manifest archive_path (assets/fabrics/...) to a served URL.
 *  Honours the Vite base path so the same build works for project pages,
 *  user pages, and local dev. */
export function imageUrl(archivePath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const stripped = archivePath.replace(/^assets[\\/]+/, "");
  return base + "/" + stripped;
}

/** Pick a representative image for a fabric, with a deterministic fallback. */
export function fabricImage(id: string): { url: string; alt: string } | null {
  const list = imageIndex[id];
  if (list && list.length > 0) {
    const it = list[0];
    return { url: imageUrl(it.archive_path), alt: it.matched_fabric_name ?? id };
  }
  return null;
}

/** Return all images linked to a fabric id. */
export function fabricImages(id: string): { url: string; alt: string }[] {
  const list = imageIndex[id];
  if (!list) return [];
  return list.map((it) => ({ url: imageUrl(it.archive_path), alt: it.matched_fabric_name ?? id }));
}

/** All distinct fibers present in the catalogue (for filter chips). */
export function distinctFibers(): { key: string; label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const f of fabrics) {
    for (const k of Object.keys(f.composition ?? {})) {
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  const labelOf = (k: string) => {
    const map: Record<string, string> = {
      polyester: "涤纶",
      recycled_polyester: "再生涤",
      cotton: "棉",
      nylon: "锦纶",
      spandex: "氨纶",
      modal: "莫代尔",
      rayon: "粘胶",
      linen: "亚麻",
      acrylic: "腈纶",
    };
    return map[k] ?? k;
  };
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ key: k, label: labelOf(k), count: n }));
}

export function distinctSuppliers(): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const f of fabrics) {
    const s = f.supplier ?? f.supplier_brand;
    if (s) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
