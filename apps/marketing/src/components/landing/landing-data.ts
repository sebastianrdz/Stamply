import heroShowcase from "@/assets/stamply-landing-assets-v1/images/hero-wallet-showcase.png";
import bruma from "@/assets/stamply-landing-assets-v1/images/bruma-wallet-phone.png";
import alba from "@/assets/stamply-landing-assets-v1/images/alba-wallet-phone.png";
import verde from "@/assets/stamply-landing-assets-v1/images/verde-mesa-wallet-phone.png";
import enrollment from "@/assets/stamply-landing-assets-v1/images/how-it-works-enrollment.png";
import stampUpdate from "@/assets/stamply-landing-assets-v1/images/stamp-progress-update.png";
import proximity from "@/assets/stamply-landing-assets-v1/images/proximity-reminder-phone.png";

export { heroShowcase, bruma };

export type CardKind = "stamp" | "points" | "coupon" | "membership";

/** The four card types. Copy lives in dict.landing.types.items. */
export const CARD_TYPES: readonly {
  id: CardKind;
  primary: string;
  secondary: string;
}[] = [
  { id: "stamp", primary: "#183D35", secondary: "#F3EADD" },
  { id: "points", primary: "#8A4B1F", secondary: "#FBEBD3" },
  { id: "coupon", primary: "#7A2E55", secondary: "#FBE4EE" },
  { id: "membership", primary: "#1F2F5C", secondary: "#E7ECFA" },
];

/**
 * Fictional demo businesses. Copy lives in dict.landing.examples.businesses.
 * Real wallet screenshots exist only for the stamp cafés; the rest use a
 * CSS-drawn `kind` mock.
 */
export const BUSINESSES = [
  { id: "bruma", primary: "#183D35", secondary: "#F3EADD", image: bruma },
  { id: "alba", primary: "#2448A4", secondary: "#F9EBC4", image: alba },
  { id: "verde", primary: "#415C35", secondary: "#F3DDC5", image: verde },
  { id: "pulso", primary: "#1F2F5C", secondary: "#E7ECFA", kind: "membership" },
  { id: "lila", primary: "#7A2E55", secondary: "#FBE4EE", kind: "coupon" },
  { id: "trigo", primary: "#8A4B1F", secondary: "#FBEBD3", kind: "points" },
] as const;

/** Visuals for "Cómo funciona". Copy lives in dict.landing.how.{tabs,notes}. */
export const PROCESS_VISUALS = [
  { id: "enrollment", image: enrollment },
  { id: "update", image: stampUpdate },
  { id: "proximity", image: proximity },
] as const;
