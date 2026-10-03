import { X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  addTag,
  canAddCustomTag,
  normalizeTag,
  tagKey,
  tagSuggestions,
} from '../../utils/profileFields';

export function TagSelector({
  label,
  values,
  suggestions,
  onChange,
  helper,
  allowCustom = true,
}: {
  label: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
  helper?: string;
  allowCustom?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const candidates = tagSuggestions(values, suggestions, query);
  const custom =
    allowCustom && candidates.length === 0 && canAddCustomTag(values, suggestions, query);
  const options = [...candidates, ...(custom ? [normalizeTag(query)] : [])];
  const select = (value: string) => {
    onChange(addTag(values, value));
    setQuery('');
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
      event.preventDefault();
      setOpen(true);
      setActive((current) =>
        event.key === 'ArrowDown'
          ? (current + 1) % options.length
          : current <= 0
            ? options.length - 1
            : current - 1,
      );
    } else if (event.key === 'Enter' && open && options.length) {
      event.preventDefault();
      select(options[active < 0 ? 0 : Math.min(active, options.length - 1)]);
    } else if (event.key === 'Escape') setOpen(false);
    else if (event.key === 'Backspace' && !query && values.length) onChange(values.slice(0, -1));
  };
  return (
    <div className="field field-wide tag-field">
      <label htmlFor={`${id}-input`}>{label}</label>
      {helper && <small className="field-help">{helper}</small>}
      <div className="tag-selector">
        {values.map((value) => (
          <span className="tag-chip" key={tagKey(value)}>
            {value}
            <button
              aria-label={`Remover ${value}`}
              onClick={() => onChange(values.filter((item) => tagKey(item) !== tagKey(value)))}
              type="button"
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-expanded={open && options.length > 0}
          aria-activedescendant={
            open && active >= 0 && options.length
              ? `${id}-option-${Math.min(active, options.length - 1)}`
              : undefined
          }
          autoComplete="off"
          id={`${id}-input`}
          maxLength={80}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keyDown}
          ref={inputRef}
          role="combobox"
          value={query}
        />
      </div>
      {open && options.length > 0 && (
        <div className="tag-options" id={`${id}-list`} role="listbox">
          {options.map((option, index) => (
            <button
              aria-selected={index === active}
              className={index === active ? 'active' : ''}
              id={`${id}-option-${index}`}
              key={tagKey(option)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option)}
              role="option"
              type="button"
            >
              {custom && index === options.length - 1 ? `Adicionar “${option}”` : option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
