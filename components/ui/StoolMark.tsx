import Svg, { Circle, G, Path } from "react-native-svg";
import type { StoolValue } from "../../lib/stools";

/**
 * The five consistencies, drawn.
 *
 * **Numbers and words were the first version and they were placeholders.** A
 * scale of five reads faster as a shape than as a digit, and a tutor comparing
 * today with three days ago is comparing *how it held together*, which is a
 * picture. The words survive where there is room to read them — on a collected
 * one, and in every accessible name.
 *
 * **Lucide's own idiom, because they sit beside Lucide's own icons.** A 24-unit
 * grid, a 2-unit stroke, round caps and joins, no fills: the walk's footprints
 * and the medication's pill are drawn that way, and a mark from a different
 * family would read as a sticker dropped on the form. `currentColor` is not a
 * thing here — the colour arrives as a prop, the way `lucide-react-native`
 * takes one.
 *
 * The progression is **how the mass holds together**: separate pellets, one
 * segmented log, a log that has slumped into a single smooth mass, a mass that
 * has spread and torn, and a puddle with something still dropping into it.
 *
 * **Four drafts died at 18dp, which is the size that decides.** The marks are
 * read at 26 in the walk's palette and at 18 in the day's log, where detail is
 * gone and only the silhouette survives — so the five differ by *outline*, not
 * by ornament. Two of the first drafts (a bumpy mound for 3, a ruffled one for
 * 4) both rendered as **clouds**, and as each other; the rounded bumps were the
 * cause, so 3 lost them and 4 got angular tears instead. Diarrhoea's first
 * draft put two matched drops above the puddle and read as a **face** at every
 * size — one large drop and one small, off-centre, breaks the symmetry that
 * made eyes. Rendered side by side at 72/40/26/18 before choosing.
 */
export function StoolMark({
  value,
  size = 26,
  color,
}: {
  value: StoolValue;
  size?: number;
  color: string;
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {value === 1 ? (
        // Dura: three separate pellets. Hard means it never became one thing.
        <>
          <Circle cx="7" cy="14.8" r="3.2" {...stroke} />
          <Circle cx="16.6" cy="15.6" r="3" {...stroke} />
          <Circle cx="12.6" cy="7.4" r="2.8" {...stroke} />
        </>
      ) : null}

      {value === 2 ? (
        // Perfecta: one log, segmented, one end tapered. The bowed divisions
        // are what keep it from reading as a pill — and they are the point:
        // this is the shape that picks up clean.
        <G transform="rotate(-6 12 13)">
          <Path
            d="M3.6 13.1C4.8 10.8 6.4 9.9 8.4 9.9H16.4a3.2 3.2 0 0 1 0 6.4H8.4C6.4 16.3 4.8 15.4 3.6 13.1Z"
            {...stroke}
          />
          <Path d="M10.8 10.2c-.9 1.9-.9 4 0 5.8" {...stroke} />
          <Path d="M14.2 10.2c-.9 1.9-.9 4 0 5.8" {...stroke} />
        </G>
      ) : null}

      {value === 3 ? (
        // Blanda: the same mass with its edges gone. One smooth outline, still
        // longer than tall — it holds a shape, it just no longer holds a form.
        <Path
          d="M3.6 14.4c0-2.6 2.4-4.6 5.6-4.6 3.4 0 4.6 1.4 7 2.2 2.4.8 3.6 2 3.2 3.4-.4 1.6-2.8 2.4-7.2 2.4-5.6 0-8.6-1.2-8.6-3.4Z"
          {...stroke}
        />
      ) : null}

      {value === 4 ? (
        // Sin forma: spread flat, and torn along the top. Angular rather than
        // bumpy, which is what separates it from the one above at 18dp.
        <Path
          d="M3.2 16.6 L5.4 13.8 L7.2 15.4 L9.4 12.4 L11.4 14.8 L14.2 13 L15.6 14.6 L18 13.6c1.8 2 .6 4-4 4.2-5.8.3-10.2.2-11.8-.2-1.6-.4-1.8-1-.2-1.6Z"
          {...stroke}
        />
      ) : null}

      {value === 5 ? (
        // Diarrea: a puddle, and it has not finished arriving.
        <>
          <Path
            d="M2.8 17.2c1.4-1.4 4-1.2 5.6-.6 1.6.6 3 .2 4.6-.4 1.8-.7 4-.6 5.4.2 1.6.9 2.6 2.2 1 2.8-2.4.9-13 .9-15.4.2-1.4-.4-1.8-1.4-1.2-2.2Z"
            {...stroke}
          />
          <Path
            d="M11 9.2c0 1.1-.8 1.9-1.8 1.9s-1.8-.8-1.8-1.9S9.2 5.4 9.2 5.4 11 8.1 11 9.2Z"
            {...stroke}
          />
          <Path
            d="M16.6 11.6c0 .7-.5 1.2-1.1 1.2s-1.1-.5-1.1-1.2 1.1-2.3 1.1-2.3 1.1 1.6 1.1 2.3Z"
            {...stroke}
          />
        </>
      ) : null}
    </Svg>
  );
}
