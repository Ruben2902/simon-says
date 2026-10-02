import { GameExperience } from "@/components/game-experience";
import { I18nProvider } from "@/i18n/i18n-provider";

export default function Home() {
  return (
    <I18nProvider>
      <GameExperience />
    </I18nProvider>
  );
}
