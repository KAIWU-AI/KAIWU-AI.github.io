export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.1.2/MindMotion_0.1.2_x64-setup.exe";
export const MACOS_DOWNLOAD_URL =
  "https://github.com/KAIWU-AI/KAIWU-AI.github.io/releases/download/desktop-v0.1.2/MindMotion_0.1.2_aarch64.dmg";

export function detectDesktopPlatform(navigatorLike = {}) {
  const userAgent = String(navigatorLike.userAgent || "").trim().toLowerCase();
  const platform = String(navigatorLike.platform || "").trim().toLowerCase();
  const userAgentDataPlatform = String(navigatorLike.userAgentData?.platform || "")
    .trim()
    .toLowerCase();
  const isTouchMac = platform === "macintel" && Number(navigatorLike.maxTouchPoints || 0) > 1;

  if (isTouchMac || navigatorLike.userAgentData?.mobile === true) {
    return "other";
  }

  const classifyUserAgentData = (value) => {
    if (!value) return null;
    if (value === "windows") return "windows";
    if (value === "macos") return "macos";
    return "other";
  };

  const classifyNavigatorPlatform = (value) => {
    if (!value) return null;
    if (/^(?:win32|win64|windows|winnt)$/.test(value)) return "windows";
    if (/^(?:macintel|macppc|mac68k)$/.test(value)) return "macos";
    return "other";
  };

  const classifyUserAgent = (value) => {
    if (!value) return null;

    const commentMatch = /^mozilla\/5\.0 \(([^)]*)\)/.exec(value);
    if (!commentMatch) return "other";

    const suffix = value.slice(commentMatch[0].length).trim();
    const version = "\\d+(?:\\.\\d+)*";
    let browserFamily = null;
    if (suffix === "") {
      browserFamily = "bare";
    } else if (new RegExp(`^gecko\\/\\d+ firefox\\/${version}$`).test(suffix)) {
      browserFamily = "firefox";
    } else if (
      new RegExp(
        `^applewebkit\\/${version} \\(khtml, like gecko\\) chrome\\/${version} safari\\/${version}(?: edg\\/${version})?$`,
      ).test(suffix)
    ) {
      browserFamily = "chromium";
    } else if (
      new RegExp(
        `^applewebkit\\/${version} \\(khtml, like gecko\\) version\\/${version} safari\\/${version}$`,
      ).test(suffix)
    ) {
      browserFamily = "safari";
    }
    if (!browserFamily) return "other";

    const tokens = commentMatch[1].split(";").map((token) => token.trim());
    const windowsVersion = tokens[0] === "windows nt 10.0";
    const windowsExtras = tokens
      .slice(1)
      .every((token) => /^(?:win64|x64|wow64|arm64|rv:\d+(?:\.\d+)*)$/.test(token));
    if (windowsVersion && windowsExtras && browserFamily !== "safari") return "windows";

    const macFamily = tokens[0] === "macintosh";
    const macVersion = /^(?:intel|ppc) mac os x \d+(?:[._]\d+)*$/.test(tokens[1] || "");
    const macExtras = tokens
      .slice(2)
      .every((token) => /^rv:\d+(?:\.\d+)*$/.test(token));
    if (macFamily && macVersion && macExtras) return "macos";

    return "other";
  };

  const signals = [
    classifyUserAgentData(userAgentDataPlatform),
    classifyNavigatorPlatform(platform),
    classifyUserAgent(userAgent),
  ].filter(Boolean);

  if (signals.length === 0 || signals.includes("other")) {
    return "other";
  }

  const desktopPlatforms = new Set(signals);
  return desktopPlatforms.size === 1 ? signals[0] : "other";
}

export function configurePlatformDownload(button, navigatorLike = {}) {
  if (!button) {
    return "other";
  }

  const platform = detectDesktopPlatform(navigatorLike);
  const label = button.querySelector("[data-download-label]");
  const icon = button.querySelector("[data-download-icon]");
  const windowsDownloadUrl = button.dataset.windowsDownloadUrl || WINDOWS_DOWNLOAD_URL;
  const macosDownloadUrl = button.dataset.macosDownloadUrl || MACOS_DOWNLOAD_URL;

  button.dataset.platform = platform;
  button.addEventListener("click", (event) => {
    if (button.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
    }
  });

  const enableDownload = ({ url, filename, ariaLabel, title, labelText }) => {
    button.setAttribute("href", url);
    button.setAttribute("download", filename);
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("title", title);
    button.removeAttribute("aria-disabled");
    button.removeAttribute("tabindex");
    button.classList.remove("is-disabled");
    if (label) label.textContent = labelText;
    if (icon) icon.textContent = "↓";
  };

  if (platform === "windows") {
    enableDownload({
      url: windowsDownloadUrl,
      filename: "MindMotion_0.1.2_x64-setup.exe",
      ariaLabel: "下载 MindMotion 0.1.2 Windows x64 安装包",
      title: "下载 MindMotion 0.1.2 Windows x64 安装包",
      labelText: "下载 Windows 版",
    });
    return platform;
  }

  if (platform === "macos") {
    enableDownload({
      url: macosDownloadUrl,
      filename: "MindMotion_0.1.2_aarch64.dmg",
      ariaLabel: "下载 MindMotion 0.1.2 macOS Apple 芯片安装包",
      title: "下载 MindMotion 0.1.2 macOS Apple 芯片安装包",
      labelText: "下载 macOS 版",
    });
    return platform;
  }

  button.removeAttribute("href");
  button.removeAttribute("download");
  button.setAttribute("aria-disabled", "true");
  button.setAttribute("tabindex", "-1");
  button.setAttribute("aria-label", "MindMotion 暂不支持当前系统");
  button.setAttribute("title", "MindMotion 暂不支持当前系统");
  button.classList.add("is-disabled");
  if (label) label.textContent = "暂不支持当前系统";
  if (icon) icon.textContent = "…";
  return platform;
}

if (typeof document !== "undefined" && typeof navigator !== "undefined") {
  configurePlatformDownload(document.querySelector("[data-platform-download]"), navigator);
}
