import { Minus, Plus } from 'lucide-react';

export default function QuantityStepper({ value, onChange, min = 1, max, step = 1 }) {
  const decrease = () => onChange(Math.max(min, Number((value - step).toFixed(2))));
  const increase = () => onChange(max ? Math.min(max, Number((value + step).toFixed(2))) : Number((value + step).toFixed(2)));

  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white">
      <button
        type="button"
        onClick={decrease}
        disabled={value <= min}
        className="flex h-10 w-10 items-center justify-center rounded-full text-pine-900 transition hover:bg-mist disabled:opacity-30"
        aria-label="Diminuer la quantité"
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-16 border-0 bg-transparent text-center font-semibold text-ink focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={increase}
        disabled={max != null && value >= max}
        className="flex h-10 w-10 items-center justify-center rounded-full text-pine-900 transition hover:bg-mist disabled:opacity-30"
        aria-label="Augmenter la quantité"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
