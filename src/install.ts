import { confirm } from "./prompt.ts";
import {
  commandExists,
  isLinux,
  isMac,
  isWin,
  openUrl,
  runInstall,
  runInteractive,
} from "./platform.ts";

type LinuxPm = "apt" | "dnf" | "pacman" | "zypper";
export type LinuxPkg = string | Partial<Record<LinuxPm, string>>;

async function detectLinuxPm(): Promise<LinuxPm | null> {
  if (await commandExists("apt-get")) return "apt";
  if (await commandExists("dnf")) return "dnf";
  if (await commandExists("pacman")) return "pacman";
  if (await commandExists("zypper")) return "zypper";
  return null;
}

function linuxInstallArgs(pm: LinuxPm, pkg: string): string[] {
  switch (pm) {
    case "apt":
      return ["sudo", "apt-get", "install", "-y", pkg];
    case "dnf":
      return ["sudo", "dnf", "install", "-y", pkg];
    case "pacman":
      return ["sudo", "pacman", "-S", "--noconfirm", pkg];
    case "zypper":
      return ["sudo", "zypper", "--non-interactive", "install", pkg];
  }
}

function resolveLinuxPkg(pm: LinuxPm, linuxPkg?: LinuxPkg): string | undefined {
  if (!linuxPkg) return undefined;
  if (typeof linuxPkg === "string") return linuxPkg;
  return linuxPkg[pm];
}

export async function ensurePackageManager(): Promise<"brew" | "winget" | LinuxPm | null> {
  if (isMac && (await commandExists("brew"))) return "brew";
  if (isWin && (await commandExists("winget"))) return "winget";
  if (isLinux) return detectLinuxPm();
  return null;
}

export async function installApp(
  title: string,
  brewArgs: string[],
  wingetId: string,
  downloadUrl: string,
  linuxPkg?: LinuxPkg,
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
  if (isLinux && pm) {
    const pkg = resolveLinuxPkg(pm, linuxPkg);
    if (pkg) {
      console.log(`${title} ${pm} ile kuruluyor...`);
      const args = linuxInstallArgs(pm, pkg);
      const code = await runInteractive(args[0], args.slice(1));
      if (code !== 0) {
        openUrl(downloadUrl);
        return false;
      }
      return true;
    }
  }
  console.log("Otomatik kurulum için macOS'ta Homebrew, Windows'ta winget, Linux'ta apt/dnf/pacman gerekir.");
  openUrl(downloadUrl);
  return false;
}
