import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * The way back and the name of where you are, on a screen the tabs do not reach.
 *
 * **Two screens had invented it separately.** Ajustes stacked a link labelled
 * "Perfil" above its title; the treatment history put an arrow beside its
 * title. Both worked and the pair read as two different apps, which is the
 * cost of letting a header be each screen's own business.
 *
 * **The arrow is beside the title, and the destination is in the label.** The
 * side-by-side layout won because it spends one line where the stack spends
 * two, on screens whose content is the point — and the name of where back goes
 * is not lost, it moves to the accessible name, which is the reader who
 * actually needs it. A sighted tutor pressing back on a screen they opened
 * thirty seconds ago knows where it goes.
 */
export function ScreenHeader({
  title,
  backTo,
  onBack,
  className = "mb-6",
  testID,
  backTestID,
}: {
  title: string;
  /** Where back goes, for the accessible name: "Volver a Perfil". */
  backTo: string;
  onBack: () => void;
  className?: string;
  testID?: string;
  backTestID?: string;
}) {
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <Pressable
        testID={backTestID}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={`Volver a ${backTo}`}
        // Pulled left by its own optical padding so the arrow lines up with
        // the page's gutter rather than the touch target's edge.
        style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
        className="-ml-3 items-center justify-center active:opacity-70"
      >
        <ChevronLeft size={24} color={colors.textSecondary} />
      </Pressable>
      <Text
        testID={testID}
        accessibilityRole="header"
        className="min-w-0 flex-1 font-bold text-2xl text-text-primary"
      >
        {title}
      </Text>
    </View>
  );
}
