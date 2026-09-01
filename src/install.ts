import { confirm } from "./prompt.ts";
import { commandExists, isMac, isWin, openUrl, runInstall } from "./platform.ts";

export async function ensurePackageManager(): Promise<"brew" | "winget" | null> {
  if (isMac && (await commandExists("brew"))) return "brew";
  if (isWin && (await commandExists("winget"))) return "winget";
  return null;
}

export async function installApp(
  title: string,
  brewArgs: string[],
  wingetId: string,
  downloadUrl: string,
): Promise<boolean> {
  if (!(await confirm(`${title} yüklü değil. Kurayım mı?`, true))) {
    openUrl(downloadUrl);
    console.log(`İndirme sayfası açıldı: ${downloadUrl}`);
    return false;
  }
  const pm = await ensurePackageManager();
  if (pm === "brew") {
    console.log(`${title} Homebrew ile kuruluyor...`);
    const result = await runInstall(["brew", ...brewArgs]);
    if (!result.ok) {
      console.log(result.output);
      openUrl(downloadUrl);
      return false;
    }
    return true;
  }
  if (pm === "winget") {
    console.log(`${title} winget ile kuruluyor...`);
    const result = await runInstall([
      "winget",
      "install",
      "-e",
      "--id",
      wingetId,
      "--accept-package-agreements",
      "--accept-source-agreements",
    ]);
    if (!result.ok) {
      console.log(result.output);
      openUrl(downloadUrl);
      return false;
    }
    return true;
  }
  console.log("Otomatik kurulum için macOS'ta Homebrew, Windows'ta winget gerekir.");
  openUrl(downloadUrl);
  return false;
}
