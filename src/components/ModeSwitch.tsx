type InterfaceMode = 'simple' | 'professional';

const OPTIONS: Array<{ value: InterfaceMode; label: string }> = [
  { value: 'simple', label: 'بسيط' },
  { value: 'professional', label: 'متقدم' },
];

// Segmented control for the simple / professional workspace modes.
export function ModeSwitch({ mode, onChange }: { mode: InterfaceMode; onChange: (mode: InterfaceMode) => void }) {
  return (
    <div className="qada-mode-switch" role="radiogroup" aria-label="وضع الواجهة">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          onClick={() => mode !== option.value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
