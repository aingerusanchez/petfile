import { Bug, Syringe, Worm } from "lucide-react-native";

/**
 * A glyph per kind, and it is teaching rather than decoration.
 *
 * **The two dewormings are the pair nobody can tell apart**, which is why the
 * labels carry "(Int.)" and "(Ext.)" at all — so the icons name what each one
 * is *for* rather than what it looks like: a worm for what lives inside, a
 * tick for what lives on the outside. The vaccine keeps the syringe, and the
 * section's own button gives it up for a shield, because an action button
 * wearing one of its three options' marks reads as a shortcut to that option.
 */
export const TREATMENT_ICONS = {
  vaccine: Syringe,
  deworming: Worm,
  antiparasitic: Bug,
} as const;
