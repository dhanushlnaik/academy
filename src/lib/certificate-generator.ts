/**
 * Certificate Generator
 *
 * Generates unique on-brand SVG certificates for every recipient.
 *
 * Uniqueness axes:
 *  1. Background gradient  — derived deterministically from wallet address
 *     (same technique used by ENS for avatar gradients).
 *  2. Accent / border colour — one accent hue per course slug.
 *  3. Recipient name        — ENS subdomain or display name, embedded in the image.
 *  4. Serial number         — token ID or a short hash burned into the footer.
 *  5. Completion date       — embedded in the footer.
 *
 * Output: an SVG Buffer (image/svg+xml) ready to be uploaded to IPFS via Pinata.
 * No external dependencies required — pure Node.js string generation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CertificateType = "course-completion" | "pioneer";

export interface CertificateParams {
  type: CertificateType;
  /** ENS name (e.g. "vitalik.ayushetty.eth") or fallback display name */
  recipientName: string;
  /** Wallet address used to derive a unique colour palette */
  walletAddress?: string;
  /** Human-readable course title */
  courseName?: string;
  /** Course slug — used to pick the per-course accent hue */
  courseSlug?: string;
  /** ISO date string of completion */
  completionDate: string;
  /** e.g. "Beginner" */
  courseLevel?: string;
  /**
   * Token ID (or any short unique identifier) burned into the serial field.
   * If omitted, a deterministic fallback is derived from the params.
   */
  serialNumber?: string;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic hue (0–359) from a wallet address string.
 * Uses a simple djb2-style hash so the output is always the same for the
 * same address — giving every user their own "colour identity".
 */
function addressToHue(address: string): number {
  const clean = address.replace(/^0x/i, "").toLowerCase().padStart(40, "0");
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash + clean.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Build a CSS hsl() string */
function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360},${s}%,${l}%)`;
}

/**
 * Per-course accent hues — each course has its own recognisable colour.
 * Courses not listed fall back to the user's personal hue.
 */
const COURSE_ACCENT_HUES: Record<string, number> = {
  "eips-101":         220,  // Blue   — Ethereum Governance
  "ens-101":          165,  // Teal   — Naming Service
  "0g-101":           280,  // Violet — AI Infrastructure
  "blockchain-basics": 38,  // Amber  — Fundamentals
  "solidity-dev":     200,  // Cyan   — Development
  "defi-protocols":   145,  // Green  — DeFi
  "nft-ecosystem":    320,  // Pink   — NFTs
  "web3-security":    355,  // Red    — Security
};

/** Pioneer badge always uses a gold/amber accent */
const PIONEER_ACCENT_HUE = 42;

// ---------------------------------------------------------------------------
// XML sanitiser — prevent injected SVG/XML from user-supplied strings
// ---------------------------------------------------------------------------

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate a string to maxLen characters, appending "…" if trimmed */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

// ---------------------------------------------------------------------------
// Serial helper
// ---------------------------------------------------------------------------

function buildSerial(
  serialNumber: string | undefined,
  walletAddress: string,
  courseName: string
): string {
  if (serialNumber) {
    // Prefer token ID — shorten long off-chain IDs like "off-172…xyz"
    const cleaned = serialNumber.startsWith("off-")
      ? serialNumber.slice(4, 12).toUpperCase()
      : serialNumber.slice(0, 8).toUpperCase();
    return `#${cleaned}`;
  }
  // Deterministic fallback from wallet + course
  const raw = (walletAddress + courseName)
    .split("")
    .reduce((acc, c) => ((acc << 5) + acc + c.charCodeAt(0)) | 0, 5381);
  return `#${Math.abs(raw).toString(16).slice(0, 6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// SVG builders
// ---------------------------------------------------------------------------

function buildCourseCompletionSVG(params: CertificateParams): string {
  const {
    recipientName,
    walletAddress = "0x0000000000000000000000000000000000000000",
    courseName = "EIPsInsight Academy Course",
    courseSlug = "",
    completionDate,
    courseLevel = "Beginner",
    serialNumber,
  } = params;

  const userHue    = addressToHue(walletAddress);
  const accentHue  = COURSE_ACCENT_HUES[courseSlug] ?? userHue;

  // Background: two dark tones based on user's unique hue
  const bg1        = hsl(userHue, 28, 7);
  const bg2        = hsl((userHue + 35) % 360, 22, 12);
  // Accent gradient: course-specific
  const accent1    = hsl(accentHue, 82, 62);
  const accent2    = hsl((accentHue + 45) % 360, 76, 56);
  // Text tones
  const textPrimary   = "#F1F5F9";
  const textSecondary = hsl(accentHue, 65, 82);
  const textMuted     = hsl(userHue, 18, 60);

  const serial  = buildSerial(serialNumber, walletAddress, courseName);
  const date    = new Date(completionDate).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const addrSnip = `${walletAddress.slice(0, 10)}…${walletAddress.slice(-6)}`;

  const safeName   = xmlEscape(truncate(recipientName, 30));
  const safeCourse = xmlEscape(truncate(courseName, 44));
  const safeLevel  = xmlEscape(courseLevel.toUpperCase());
  const safeDate   = xmlEscape(date);
  const safeSerial = xmlEscape(serial);
  const safeAddr   = xmlEscape(addrSnip);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="500" viewBox="0 0 800 500"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent1}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="500" rx="16" fill="url(#bg)"/>

  <!-- Decorative ambient circles (unique placement via hue offsets) -->
  <circle cx="70"  cy="70"  r="90"  fill="${accent1}" opacity="0.05"/>
  <circle cx="730" cy="430" r="120" fill="${accent2}" opacity="0.05"/>
  <circle cx="720" cy="80"  r="50"  fill="${accent2}" opacity="0.04"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="800" height="4" rx="0" fill="url(#accent)"/>
  <!-- Left side accent bar -->
  <rect x="0" y="0" width="4" height="500" rx="0" fill="url(#accent)" opacity="0.5"/>

  <!-- Inner frame border -->
  <rect x="22" y="22" width="756" height="456" rx="10"
        fill="none" stroke="${accent1}" stroke-width="0.8" stroke-opacity="0.2"/>

  <!-- EIPsInsight Academy wordmark -->
  <text x="400" y="70"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="16" font-weight="700" letter-spacing="3"
        fill="url(#accent)" text-anchor="middle" filter="url(#glow)">EIPsInsight Academy</text>

  <!-- Thin divider under brand -->
  <rect x="350" y="80" width="100" height="1" fill="url(#accent)" opacity="0.4"/>

  <!-- CERTIFICATE OF COMPLETION label -->
  <text x="400" y="122"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="11" font-weight="500" letter-spacing="5"
        fill="${textMuted}" text-anchor="middle">CERTIFICATE OF COMPLETION</text>

  <!-- "This certifies that" -->
  <text x="400" y="175"
        font-family="Georgia,'Times New Roman',serif"
        font-size="15" font-style="italic"
        fill="${textMuted}" text-anchor="middle">This certifies that</text>

  <!-- Recipient name — most prominent element -->
  <text x="400" y="238"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="38" font-weight="700"
        fill="${textPrimary}" text-anchor="middle" filter="url(#glow)">${safeName}</text>

  <!-- Accent line under name -->
  <rect x="180" y="252" width="440" height="2" rx="1"
        fill="url(#accent)" opacity="0.75"/>

  <!-- "has successfully completed" -->
  <text x="400" y="290"
        font-family="Georgia,'Times New Roman',serif"
        font-size="14" font-style="italic"
        fill="${textMuted}" text-anchor="middle">has successfully completed</text>

  <!-- Course name -->
  <text x="400" y="344"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="22" font-weight="600"
        fill="${textSecondary}" text-anchor="middle">${safeCourse}</text>

  <!-- Level pill -->
  <rect x="360" y="356" width="80" height="20" rx="10"
        fill="${accent1}" opacity="0.12"/>
  <text x="400" y="370"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="9" font-weight="600" letter-spacing="2"
        fill="${accent1}" text-anchor="middle">${safeLevel}</text>

  <!-- Footer divider -->
  <rect x="40" y="415" width="720" height="1" fill="${accent1}" opacity="0.18"/>

  <!-- Footer: issued date -->
  <text x="56" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textMuted}">Issued ${safeDate}</text>

  <!-- Footer: chain label -->
  <text x="400" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textMuted}" text-anchor="middle">Polygon Amoy · On-Chain</text>

  <!-- Footer: serial -->
  <text x="744" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textMuted}" text-anchor="end">${safeSerial}</text>

  <!-- Watermark: truncated wallet address -->
  <text x="400" y="470"
        font-family="'Courier New',Courier,monospace"
        font-size="8" fill="${textMuted}" text-anchor="middle" opacity="0.25">${safeAddr}</text>
</svg>`;
}

function buildPioneerSVG(params: CertificateParams): string {
  const {
    recipientName,
    walletAddress = "0x0000000000000000000000000000000000000000",
    completionDate,
    serialNumber,
  } = params;

  const userHue   = addressToHue(walletAddress);
  const accentHue = PIONEER_ACCENT_HUE; // gold

  // Background: dark, unique tint from wallet
  const bg1       = hsl(userHue, 25, 6);
  const bg2       = hsl((userHue + 30) % 360, 20, 10);
  // Gold accent
  const accent1   = hsl(accentHue, 90, 58);
  const accent2   = hsl((accentHue + 20) % 360, 85, 50);
  // Text
  const textPrimary   = "#F8FAFC";
  const textSecondary = hsl(accentHue, 75, 85);
  const textMuted     = hsl(userHue, 16, 58);

  const serial  = buildSerial(serialNumber, walletAddress, "pioneer");
  const date    = new Date(completionDate).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const addrSnip = `${walletAddress.slice(0, 10)}…${walletAddress.slice(-6)}`;

  const safeName   = xmlEscape(truncate(recipientName, 30));
  const safeDate   = xmlEscape(date);
  const safeSerial = xmlEscape(serial);
  const safeAddr   = xmlEscape(addrSnip);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="500" viewBox="0 0 800 500"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent1}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <linearGradient id="accentV" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${accent1}"/>
      <stop offset="100%" stop-color="${accent2}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="500" rx="16" fill="url(#bg)"/>

  <!-- Ambient glow blobs -->
  <circle cx="400" cy="-30" r="200" fill="${accent1}" opacity="0.04"/>
  <circle cx="60"  cy="460" r="100" fill="${accent2}" opacity="0.05"/>
  <circle cx="740" cy="460" r="100" fill="${accent1}" opacity="0.05"/>

  <!-- Top + bottom accent bars -->
  <rect x="0" y="0"   width="800" height="4" fill="url(#accent)"/>
  <rect x="0" y="496" width="800" height="4" fill="url(#accent)" opacity="0.6"/>

  <!-- Inner frame -->
  <rect x="22" y="22" width="756" height="456" rx="10"
        fill="none" stroke="${accent1}" stroke-width="0.8" stroke-opacity="0.25"/>
  <!-- Second inner frame (double-border = prestige) -->
  <rect x="30" y="30" width="740" height="440" rx="8"
        fill="none" stroke="${accent2}" stroke-width="0.4" stroke-opacity="0.15"/>

  <!-- Diamond / star motif at top -->
  <polygon points="400,44 408,56 400,68 392,56"
           fill="${accent1}" filter="url(#glow)" opacity="0.9"/>

  <!-- EIPsInsight Academy wordmark -->
  <text x="400" y="95"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="18" font-weight="700" letter-spacing="3"
        fill="url(#accent)" text-anchor="middle" filter="url(#glow)">EIPsInsight Academy</text>

  <!-- Subtitle -->
  <text x="400" y="126"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" font-weight="400" letter-spacing="6"
        fill="${textMuted}" text-anchor="middle">GENESIS PIONEER AWARD</text>

  <!-- Divider -->
  <rect x="300" y="137" width="200" height="1" fill="url(#accent)" opacity="0.45"/>

  <!-- Presented to -->
  <text x="400" y="185"
        font-family="Georgia,'Times New Roman',serif"
        font-size="14" font-style="italic"
        fill="${textMuted}" text-anchor="middle">Presented to</text>

  <!-- Recipient name — hero element -->
  <text x="400" y="252"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="42" font-weight="800"
        fill="${textPrimary}" text-anchor="middle" filter="url(#glow)">${safeName}</text>

  <!-- Gold underline -->
  <rect x="160" y="264" width="480" height="2.5" rx="1.25"
        fill="url(#accent)" opacity="0.85"/>

  <!-- Description -->
  <text x="400" y="306"
        font-family="Georgia,'Times New Roman',serif"
        font-size="14" font-style="italic"
        fill="${textMuted}" text-anchor="middle">
    for being an early EIPsInsight Academy Pioneer and completing the onboarding journey
  </text>

  <!-- Star rank indicators -->
  <text x="400" y="352"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="18" fill="${accent1}" text-anchor="middle" filter="url(#glow)"
        letter-spacing="8">★  ★  ★</text>

  <!-- Footer divider -->
  <rect x="40" y="415" width="720" height="1" fill="${accent1}" opacity="0.2"/>

  <!-- Footer: date -->
  <text x="56" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textMuted}">Issued ${safeDate}</text>

  <!-- Footer: chain -->
  <text x="400" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textSecondary}" text-anchor="middle">Polygon Amoy · On-Chain</text>

  <!-- Footer: serial -->
  <text x="744" y="440"
        font-family="'SF Pro Display','Inter','Helvetica Neue',sans-serif"
        font-size="10" fill="${textMuted}" text-anchor="end">${safeSerial}</text>

  <!-- Watermark: wallet address -->
  <text x="400" y="470"
        font-family="'Courier New',Courier,monospace"
        font-size="8" fill="${textMuted}" text-anchor="middle" opacity="0.25">${safeAddr}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a unique SVG certificate as a UTF-8 Buffer.
 *
 * The resulting SVG can be directly uploaded to IPFS (via Pinata) as
 * `image/svg+xml` and referenced in the NFT metadata `image` field.
 */
export function generateCertificateSVG(params: CertificateParams): Buffer {
  const svgString =
    params.type === "pioneer"
      ? buildPioneerSVG(params)
      : buildCourseCompletionSVG(params);

  return Buffer.from(svgString, "utf-8");
}
