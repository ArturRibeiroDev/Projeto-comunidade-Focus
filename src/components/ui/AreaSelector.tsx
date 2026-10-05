import { Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

export function AreaSelector({
  options,
  values,
  onChange,
  disabled = false,
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ above: false, height: 240 });
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const bounds = wrapper.current?.getBoundingClientRect();
    if (bounds) {
      const below = window.innerHeight - bounds.bottom - 16;
      const above = below < 240 && bounds.top > below;
      setPlacement({ above, height: Math.max(80, Math.min(240, above ? bounds.top - 16 : below)) });
    }
    wrapper.current?.querySelector<HTMLInputElement>('input')?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const toggle = (area: string) =>
    onChange(values.includes(area) ? values.filter((value) => value !== area) : [...values, area]);
  return (
    <div
      className="field area-selector"
      ref={wrapper}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const inputs = Array.from(
            wrapper.current?.querySelectorAll<HTMLInputElement>('input') ?? [],
          );
          const index = inputs.indexOf(document.activeElement as HTMLInputElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? inputs.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : inputs.length - 1)) % inputs.length;
          inputs[next]?.focus();
        }
      }}
    >
      <span id={`${id}-label`}>Áreas do projeto</span>
      <div className="area-selections">
        {values.map((area) => (
          <span className="area-chip" key={area}>
            {area}
            <Button
              disabled={disabled}
              variant="ghost"
              size="icon"
              aria-label={`Remover ${area}`}
              title={`Remover ${area}`}
              icon={<X size={14} />}
              onClick={() => toggle(area)}
            />
          </span>
        ))}
        <button
          type="button"
          className="button button-secondary button-small"
          ref={trigger}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <Plus size={15} />
          Adicionar área
        </button>
      </div>
      {open && (
        <div
          className={`area-options ${placement.above ? 'above' : ''}`}
          style={{ maxHeight: placement.height }}
          id={id}
          role="group"
          aria-labelledby={`${id}-label`}
        >
          {options.map((area) => (
            <label key={area}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={values.includes(area)}
                onChange={() => toggle(area)}
              />
              {area}
            </label>
          ))}
          {options.length === 0 && <p>Nenhuma área disponível.</p>}
        </div>
      )}
    </div>
  );
}
