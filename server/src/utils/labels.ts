// src/utils/labels.ts
// Chinese label dictionaries for category/season/style/feature/finish/fiber.
// Mirrors src/types.ts CATEGORY_LABEL/FIBER_LABEL on the frontend.

import type { Category } from '../types/api.js';

export const CATEGORY_LABEL: Record<Category, string> = {
  knit: '针织',
  woven: '化纤梭织',
  pu_suede: 'PU 麂皮',
  home_textile: '家纺阻燃',
};

export const CATEGORY_DESC: Record<Category, string> = {
  knit: '摇粒绒 / 卫衣 / Polo / 网眼',
  woven: '裤料 / 外套 / 防晒 / 冲锋衣',
  pu_suede: '鞋面 / 箱包 / 装饰面料',
  home_textile: 'EN13773 阻燃窗帘与沙发布',
};

export const FIBER_LABEL: Record<string, string> = {
  polyester: '涤纶',
  recycled_polyester: '再生涤',
  cotton: '棉',
  nylon: '锦纶',
  spandex: '氨纶',
  modal: '莫代尔',
  rayon: '粘胶',
  linen: '亚麻',
  acrylic: '腈纶',
  wool: '羊毛',
  tencel: '天丝',
  other: '其他',
};

export function categoryLabel(c: Category): string {
  return CATEGORY_LABEL[c] ?? c;
}

export function fiberLabel(code: string): string {
  return FIBER_LABEL[code] ?? code;
}
