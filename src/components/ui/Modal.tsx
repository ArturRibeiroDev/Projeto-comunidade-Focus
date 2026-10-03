import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

const dialogStack: HTMLDivElement[] = [];

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  variant = 'dialog',
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  variant?: 'dialog' | 'drawer';
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const closeTimer = useRef<number | undefined>(undefined);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (variant !== 'drawer') {
      closeRef.current();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280;
    closeTimer.current = window.setTimeout(() => closeRef.current(), delay);
  }, [variant]);

  useEffect(() => {
    if (!open) {
      window.clearTimeout(closeTimer.current);
      closingRef.current = false;
      setClosing(false);
    }
    return () => window.clearTimeout(closeTimer.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog) dialogStack.push(dialog);
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialogRef.current) return;
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = dialog ? dialogStack.indexOf(dialog) : -1;
      if (index >= 0) dialogStack.splice(index, 1);
      if (dialogStack.length === 0) document.body.classList.remove('modal-open');
      previous?.focus();
    };
  }, [open, requestClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal-backdrop${variant === 'drawer' ? ' drawer-backdrop' : ''}${closing ? ' is-closing' : ''}`}
      onMouseDown={requestClose}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal${variant === 'drawer' ? ' modal-drawer' : ''}${closing ? ' is-closing' : ''}`}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <Button
            aria-label="Fechar"
            icon={<X size={17} />}
            onClick={requestClose}
            size="icon"
            variant="ghost"
          />
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
