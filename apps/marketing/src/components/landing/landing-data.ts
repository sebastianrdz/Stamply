import heroShowcase from "@/assets/stamply-landing-assets-v1/images/hero-wallet-showcase.png";
import bruma from "@/assets/stamply-landing-assets-v1/images/bruma-wallet-phone.png";
import alba from "@/assets/stamply-landing-assets-v1/images/alba-wallet-phone.png";
import verde from "@/assets/stamply-landing-assets-v1/images/verde-mesa-wallet-phone.png";
import enrollment from "@/assets/stamply-landing-assets-v1/images/how-it-works-enrollment.png";
import stampUpdate from "@/assets/stamply-landing-assets-v1/images/stamp-progress-update.png";
import proximity from "@/assets/stamply-landing-assets-v1/images/proximity-reminder-phone.png";

export { heroShowcase, bruma };

/** Fictional demo businesses. Copy lives in dict.landing.examples.businesses. */
export const BUSINESSES = [
  { id: "bruma", primary: "#183D35", secondary: "#F3EADD", image: bruma },
  { id: "alba", primary: "#2448A4", secondary: "#F9EBC4", image: alba },
  { id: "verde", primary: "#415C35", secondary: "#F3DDC5", image: verde },
] as const;

/** Visuals for "Cómo funciona". Copy lives in dict.landing.how.{tabs,notes}. */
export const PROCESS_VISUALS = [
  { id: "enrollment", image: enrollment },
  { id: "update", image: stampUpdate },
  { id: "proximity", image: proximity },
] as const;
