/**
 * Matematika penempatan tab aktif pada `SegmentedTabs` yang bisa di-scroll.
 *
 * Dipakai bersama web dan native supaya perilakunya identik: tab aktif selalu
 * ditarik ke tengah viewport, tetapi tidak pernah melewati batas awal maupun
 * akhir konten. Tanpa ini, tab yang berada di luar layar tidak pernah terbaca
 * dan strip-nya terlihat terpotong, bukan terlihat bisa digeser.
 *
 * Murni dan bebas platform: web memberi `offsetLeft`/`clientWidth`, native
 * memberi hasil `onLayout`/`onContentSizeChange`.
 */
export function calculateCenteredScrollLeft({
  itemLeft,
  itemWidth,
  viewportWidth,
  scrollWidth,
}: {
  readonly itemLeft: number;
  readonly itemWidth: number;
  readonly viewportWidth: number;
  readonly scrollWidth: number;
}): number {
  const centered = itemLeft - (viewportWidth - itemWidth) / 2;
  return Math.min(Math.max(centered, 0), Math.max(scrollWidth - viewportWidth, 0));
}
