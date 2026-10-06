import { useEffect, useRef } from 'react';

export default function Modal({ open, title, children, onClose, actions }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    const focusable = () => [...(panel?.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    (focusable()[0] || panel)?.focus();
    const handleKeyboard = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        panel?.focus();
      } else if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
        event.preventDefault();
        elements[0].focus();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => {
      window.removeEventListener('keydown', handleKeyboard);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="modal-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex="-1">
        <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button></div>
        <div className="modal-content">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </section>
    </div>
  );
}
