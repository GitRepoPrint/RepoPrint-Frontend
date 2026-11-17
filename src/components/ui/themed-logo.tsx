import Image from "next/image";
import lightLogo from "@/assets/logos/logo_final.png";
import darkLogo from "@/assets/logos/logo_final_branco.png";

/**
 * Mostra o logo certo para o tema só com CSS (sem JavaScript, sem "piscar"). Usado na navbar e no login/registo.
 * As classes com "!" são necessárias porque o CSS do mockup não está em nenhuma @layer
 * e ganharia às utilidades normais do Tailwind.
 */
export function ThemedLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image className={`${className} [.theme-light_&]:hidden!`} src={darkLogo} alt="RepoPrint" priority={priority} />
      <Image className={`${className} hidden! [.theme-light_&]:block!`} src={lightLogo} alt="RepoPrint" priority={priority} />
    </>
  );
}
