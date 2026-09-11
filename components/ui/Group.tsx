import type { ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Text } from "./Text";

type GroupProps = {
  children: ReactNode;
  /** Optional section heading, for a group whose purpose is not self-evident. */
  title?: string;
  className?: string;
  /** Reports the group's offset within its parent, for scroll-to-field. */
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

/**
 * A hairline-outlined section of a form.
 *
 * **Why an outline and not a fill.** Depth here is tonal, and the tonal budget
 * is already spent: Polar Night is the page, Fjord Slate the content surfaces,
 * Elevated Frost the selected state, Deep Ice the tab bar. A filled grouping
 * card would have to take one of those roles and push everything else down a
 * step — which is exactly what the filled experiment did, and it cost the
 * field and chip tones. An outline groups without spending a tone at all, so
 * nothing else in the system has to move.
 *
 * Shadows were measured and rejected for this job: a black shadow at 25%
 * effective alpha over Polar Night yields **1.03:1**, weaker than the weakest
 * tonal step the palette already has (1.11:1). On a near-black ground a shadow
 * has nothing to contrast against — The Flat-By-Default Rule is a consequence
 * of the palette, not a stylistic preference. This border measures 1.29:1.
 *
 * **Padding is asymmetric on purpose.** Form fields carry their own 20px
 * bottom margin, so a symmetric `p-5` would stack that margin on top of the
 * group's own padding and leave a visibly deeper gap at the bottom of every
 * group. `pb-1` lets the last child's margin do that work.
 */
export function Group({
  children,
  title,
  className = "mb-5",
  onLayout,
  testID,
}: GroupProps) {
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      className={`rounded-xl border border-border-default px-5 pt-5 pb-1 ${className}`}
    >
      {/* **The heading is the anchor, so it stops being dimmer than what it
          anchors.** It was `text-secondary` against rows in `text-primary`,
          which is the hierarchy upside down: on a screen long enough to
          scroll, the eye looks for where a section *starts* and found the
          quietest line on the page. Tried three ways at 412dp — the grey, one
          step up to `text-primary`, and the accent — and only the accent
          actually caught the eye; brightening the grey was indistinguishable
          from leaving it.

          **Aqua Glaciar rather than Ice Blue Glacial**, because the primary
          accent means "this is the one thing to do here" and a heading is not
          an action. The quiet half of the family is already what text links
          and the met-goal bar wear, so this spends no new colour — and the
          uppercase tracking keeps it from reading as a link. */}
      {title ? (
        <Text className="mb-5 font-semibold text-xs tracking-[0.05em] text-accent-secondary uppercase">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
