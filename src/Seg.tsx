/** Nút chọn một trong vài phương án, luôn hiện đủ các lựa chọn (dễ hiểu hơn nút bật/tắt). */
export function Seg<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
