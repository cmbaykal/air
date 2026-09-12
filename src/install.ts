import { confirm } from "./prompt.ts";
import {
  applyKnownBinsToPath,
  brewExecutable,
  commandExists,
  isLinux,
  isMac,
  isWin,
  openUrl,
  prependToPath,
  runInstall,
  runInteractive,
} from "./platform.ts";
import fs from "node:fs";
import path from "node:path";

type LinuxPm = "apt" | "dnf" | "pacman" | "zypper";
export type LinuxPkg = string | Partial<Record<LinuxPm, string>>;
export type PkgManager = "brew" | "winget" | LinuxPm;

export const BREW_INSTALL_CMD =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

export function canUseBrewArgs(brewArgs: string[], platform = process.platform): boolean {
  if (!brewArgs.length) return false;
  if (platform === "linux" && brewArgs.includes("--cask")) return false;
  return true;
}

export function formatBrewCommand(brewArgs: string[]): string {
  return ["brew", ...brewArgs].join(" ");
}

export async function detectLinuxPm(): Promise<LinuxPm | null> {
  if (await commandExists("apt-get")) return "apt";
  if (await commandExists("dnf")) return "dnf";
  if (await commandExists("pacman")) return "pacman";
  if (await commandExists("zypper")) return "zypper";
  return null;
}

export function linuxInstallArgs(pm: LinuxPm, pkg: string): string[] {
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

export function resolveLinuxPkg(pm: LinuxPm, linuxPkg?: LinuxPkg): string | undefined {
  if (!linuxPkg) return undefined;
  if (typeof linuxPkg === "string") return linuxPkg;
  return linuxPkg[pm];
}

function applyBrewEnv(): boolean {
  const brew = brewExecutable();
  if (!brew) return false;
  prependToPath(path.dirname(brew));
  applyKnownBinsToPath();
  return true;
}

export async function brewAvailable(): Promise<boolean> {
  if (await commandExists("brew")) {
    applyBrewEnv();
    return true;
  }
  return applyBrewEnv() && (await commandExists("brew"));
}

function printBrewInstallHelp(): void {
  console.log("Homebrew kurmak için:");
  console.log(`  ${BREW_INSTALL_CMD}`);
}

export async function ensureHomebrew(assumeYes = false): Promise<boolean> {
  if (await brewAvailable()) return true;
  if (!isMac && !isLinux) return false;
  console.log("Homebrew yüklü değil. Paket kurulumları için öncelik Homebrew.");
  printBrewInstallHelp();
  if (!assumeYes && !(await confirm("Önce Homebrew kurayım mı?", true))) return false;
  console.log("Homebrew kuruluyor...");
  const code = await runInteractive("/bin/bash", [
    "-c",
    'curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | bash',
  ]);
  if (code !== 0) {
    console.log("Homebrew kurulumu başarısız.");
    printBrewInstallHelp();
    return false;
  }
  if (await brewAvailable()) return true;
  console.log("Homebrew kuruldu ama bu oturumda PATH'te yok. Yeni bir terminal açıp tekrar deneyin.");
  printBrewInstallHelp();
  return false;
}

async function offerDownloadPage(downloadUrl?: string): Promise<void> {
  if (!downloadUrl) return;
  if (!(await confirm("Kurulum sayfasını tarayıcıda açayım mı?", false))) return;
  openUrl(downloadUrl);
  console.log(`İndirme sayfası açıldı: ${downloadUrl}`);
}

async function brewPrefix(formula: string): Promise<string | null> {
  const result = await runInstall(["brew", "--prefix", formula]);
  if (!result.ok) return null;
  const prefix = result.output.split("\n")[0]?.trim();
  return prefix && fs.existsSync(prefix) ? prefix : null;
}

async function afterBrewInstall(formula?: string): Promise<void> {
  applyBrewEnv();
  if (!formula) return;
  const prefix = await brewPrefix(formula);
  if (!prefix) return;
  prependToPath(path.join(prefix, "bin"));
  const macJava = path.join(prefix, "libexec", "openjdk.jdk", "Contents", "Home");
  const linuxJava = path.join(prefix, "libexec");
  if (fs.existsSync(path.join(macJava, "bin", "java"))) {
    process.env.JAVA_HOME = macJava;
    prependToPath(path.join(macJava, "bin"));
  } else if (fs.existsSync(path.join(linuxJava, "bin", "java"))) {
    process.env.JAVA_HOME = linuxJava;
    prependToPath(path.join(linuxJava, "bin"));
  }
}

function pmLabel(pm: PkgManager): string {
  if (pm === "brew") return "Homebrew";
  return pm;
}

export type InstallOpts = {
  downloadUrl?: string;
  linuxPkg?: LinuxPkg;
  brewPathFormula?: string;
};

export async function installApp(
  title: string,
  brewArgs: string[],
  wingetId: string,
  downloadUrlOrOpts?: string | InstallOpts,
  linuxPkg?: LinuxPkg,
): Promise<boolean> {
  const opts: InstallOpts =
    typeof downloadUrlOrOpts === "string"
      ? { downloadUrl: downloadUrlOrOpts, linuxPkg }
      : (downloadUrlOrOpts ?? {});

  const brewOk = canUseBrewArgs(brewArgs);
  const linuxFallback = isLinux && Boolean(opts.linuxPkg);
  if (brewOk && (isMac || isLinux)) {
    const useBrew = await confirm(`${title} yüklü değil. Homebrew ile kurayım mı?`, true);
    if (useBrew) {
      const haveBrew = (await brewAvailable()) || (await ensureHomebrew(true));
      if (haveBrew) {
        console.log(`${title} Homebrew ile kuruluyor...`);
        const brewBin = brewExecutable() ?? "brew";
        const code = await runInteractive(brewBin, brewArgs);
        if (code === 0) {
          await afterBrewInstall(opts.brewPathFormula);
          return true;
        }
        console.log(`${title} Homebrew ile kurulamadı.`);
        console.log(`Komut: ${formatBrewCommand(brewArgs)}`);
        if (!linuxFallback) {
          await offerDownloadPage(opts.downloadUrl);
          return false;
        }
        console.log("Dağıtım paket yöneticisine geçiliyor.");
      } else if (!linuxFallback) {
        console.log(`Homebrew olmadan ${title} otomatik kurulamaz.`);
        console.log(`Kurulum: ${formatBrewCommand(brewArgs)}`);
        await offerDownloadPage(opts.downloadUrl);
        return false;
      }
    } else if (!linuxFallback) {
      console.log(`Manuel kurulum: ${formatBrewCommand(brewArgs)}`);
      if (!(await brewAvailable())) printBrewInstallHelp();
      await offerDownloadPage(opts.downloadUrl);
      return false;
    }
  }

  if (isWin && wingetId && (await commandExists("winget"))) {
    if (!(await confirm(`${title} yüklü değil. winget ile kurayım mı?`, true))) {
      console.log(`Manuel kurulum: winget install -e --id ${wingetId}`);
      await offerDownloadPage(opts.downloadUrl);
      return false;
    }
    console.log(`${title} winget ile kuruluyor...`);
    const code = await runInteractive("winget", [
      "install",
      "-e",
      "--id",
      wingetId,
      "--accept-package-agreements",
      "--accept-source-agreements",
    ]);
    if (code !== 0) {
      console.log(`${title} winget ile kurulamadı.`);
      await offerDownloadPage(opts.downloadUrl);
      return false;
    }
    applyKnownBinsToPath();
    return true;
  }

  if (isLinux) {
    const pm = await detectLinuxPm();
    const pkg = pm ? resolveLinuxPkg(pm, opts.linuxPkg) : undefined;
    if (pm && pkg) {
      if (!(await confirm(`${title} yüklü değil. ${pmLabel(pm)} ile kurayım mı?`, true))) {
        console.log(`Manuel kurulum: ${linuxInstallArgs(pm, pkg).join(" ")}`);
        await offerDownloadPage(opts.downloadUrl);
        return false;
      }
      console.log(`${title} ${pm} ile kuruluyor...`);
      const args = linuxInstallArgs(pm, pkg);
      const code = await runInteractive(args[0], args.slice(1));
      if (code !== 0) {
        console.log(`${title} ${pm} ile kurulamadı.`);
        await offerDownloadPage(opts.downloadUrl);
        return false;
      }
      return true;
    }
  }

  console.log(`${title} için bu ortamda otomatik paket kurulumu yok.`);
  if (canUseBrewArgs(brewArgs)) {
    console.log(`macOS/Linux: ${formatBrewCommand(brewArgs)}`);
    printBrewInstallHelp();
  }
  if (isWin && wingetId) console.log(`Windows: winget install -e --id ${wingetId}`);
  await offerDownloadPage(opts.downloadUrl);
  return false;
}
