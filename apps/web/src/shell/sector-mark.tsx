/**
 * The Sector mark: the phased-array wedge, which is the shape of the image
 * the product is about.
 *
 * ONE definition on purpose. The rail and the sign-in screen each carried
 * their own copy of the old "SV" tile, and the two had already drifted in
 * size and weight. The favicon (`public/favicon.svg`) and the app icon
 * (`plans/…/design/sector-app-icon.svg`) draw the same path at the same
 * proportions, so every place the product names itself shows one mark.
 *
 * Orange on scan-ground rather than orange-on-parchment: that pair is the
 * only one in the token file that holds its contrast when the palette flips,
 * so the mark needs no light/dark variant.
 */
export function SectorMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-token bg-scan-ground"
      style={{ height: size, width: size }}
    >
      <svg viewBox="0 0 32 32" style={{ height: size * 0.64, width: size * 0.64 }} fill="none">
        <path
          fill="#EE7625"
          d="M14.41 6.12 L17.59 6.12 L28.26 27.06 A27 27 0 0 1 3.74 27.06 Z"
        />
      </svg>
    </span>
  );
}
