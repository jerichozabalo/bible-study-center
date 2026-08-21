/**
 * The open-book mark in its blue well, as drawn on every artboard: 64px on the
 * sign-in screen, 30px in the app header.
 *
 * Inline SVG rather than the logo kit's files. The kit is right for anything
 * with the wordmark in it — those have outlined text and measured minimum sizes
 * (`design/logo3d/usage.html`) — but at 30px in a header the boards use this
 * bare glyph, below the 32px floor the kit's emblem sets for itself. Drawing it
 * here keeps the stroke crisp at that size and keeps the kit's rules intact
 * instead of quietly breaking them.
 */
export function Emblem({ size = 64 }: { size?: number }) {
  // The proportions the boards use: a squircle well, the glyph at ~53% of it.
  const radius = Math.round(size * 0.34);
  const glyph = Math.round(size * 0.53);

  return (
    <span
      className="flex shrink-0 items-center justify-center bg-blue"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={size >= 48 ? 1.9 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
      </svg>
    </span>
  );
}
