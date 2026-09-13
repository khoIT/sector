/**
 * The Sector mark: the phased-array wedge, which is the shape of the image
 * the product is about.
 *
 * ONE definition on purpose. The rail and the sign-in screen each carried
 * their own copy of the old "SV" tile and the two had already drifted in size
 * and weight. This draws the same geometry at the same proportions as
 * public/favicon.svg, so the rail and the browser tab carry one mark rather
 * than two cousins of one. The 512px app icon in the design folder is the same
 * path with more padding, which is what platform icon grids expect.
 *
 * The tile is scan-ground and the wedge is the accent: that pair is the only
 * one in the token file that holds its contrast when the palette flips, so the
 * mark needs no light/dark variant. The tile reads the token (it is a shade
 * darker in dark mode); the favicon cannot, and hard-codes the light value.
 *
 * Inlined rather than <img src="/favicon.svg">, because an <img> cannot take
 * the token and costs a request for 300 bytes.
 */
export function SectorMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
      role="presentation"
    >
      <rect width="32" height="32" rx="6" fill="var(--scan-ground)" />
      <path
        fill="var(--accent)"
        transform="translate(16 16) scale(0.95) translate(-16 -16.5)"
        d="M14.41 6.12 L17.59 6.12 L28.26 27.06 A27 27 0 0 1 3.74 27.06 Z"
      />
    </svg>
  );
}
