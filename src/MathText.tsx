/** Hiển thị công thức: phần trong {…} là biến, in nghiêng kiểu chữ toán. */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return <span className="math">{parts.map((p, i) => (p.startsWith('{') ? <i key={i}>{p.slice(1, -1)}</i> : p))}</span>;
}
