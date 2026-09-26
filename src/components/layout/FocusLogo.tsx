export function FocusLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <img className="focus-mark" src="/brand/focus-mark.png" alt="Focus Tecnologia" />;
  }

  return (
    <div className="focus-brand" aria-label="Focus Tecnologia, FocusEdu">
      <img src="/brand/focus-logo.png" alt="Focus Tecnologia" />
      <span><i aria-hidden="true" />FocusEdu</span>
    </div>
  );
}
