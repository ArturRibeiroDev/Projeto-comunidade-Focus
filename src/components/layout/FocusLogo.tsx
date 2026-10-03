export function FocusLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <img
        className="focus-mark"
        src="/brand/focus-community-mark.png"
        alt="Comunidade Focus Tecnologia"
      />
    );
  }

  return (
    <img
      className="focus-brand"
      src="/brand/focus-community-logo.png"
      alt="Comunidade, powered by focus tech"
    />
  );
}
