import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const wallpaperDir = path.join(root, "public", "brand", "wallpapers");
const logoDir = path.join(root, "public", "brand", "logos");
const masterDir = path.join(root, "public", "brand", "masters");

function ballWatermarkSvg({ width, height, opacity }) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="204 281 350 350">
      <defs>
        <clipPath id="ball-clip">
          <circle cx="379" cy="456" r="175" />
        </clipPath>
      </defs>
      <g opacity="${opacity}">
        <circle cx="379" cy="456" r="175" fill="#9BE11D" />
        <path d="M 249 261 C 304 401 494 361 504 501 C 509 616 409 636 269 616"
          fill="none" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round"
          clip-path="url(#ball-clip)" />
      </g>
    </svg>
  `);
}

function regulationCourtSvg({ width, height, orientation }) {
  const portrait = orientation === "portrait";
  const viewBox = portrait ? "-3 -3 42 84" : "-3 -3 84 42";
  const markings = portrait
    ? `
      <rect x="0" y="0" width="36" height="78" />
      <line x1="4.5" y1="0" x2="4.5" y2="78" />
      <line x1="31.5" y1="0" x2="31.5" y2="78" />
      <line x1="4.5" y1="18" x2="31.5" y2="18" />
      <line x1="4.5" y1="60" x2="31.5" y2="60" />
      <line x1="18" y1="18" x2="18" y2="60" />
      <line class="center-mark" x1="18" y1="0" x2="18" y2="0.33" />
      <line class="center-mark" x1="18" y1="77.67" x2="18" y2="78" />
      <line class="net" x1="-3" y1="39" x2="39" y2="39" />
    `
    : `
      <rect x="0" y="0" width="78" height="36" />
      <line x1="0" y1="4.5" x2="78" y2="4.5" />
      <line x1="0" y1="31.5" x2="78" y2="31.5" />
      <line x1="18" y1="4.5" x2="18" y2="31.5" />
      <line x1="60" y1="4.5" x2="60" y2="31.5" />
      <line x1="18" y1="18" x2="60" y2="18" />
      <line class="center-mark" x1="0" y1="18" x2="0.33" y2="18" />
      <line class="center-mark" x1="77.67" y1="18" x2="78" y2="18" />
      <line class="net" x1="39" y1="-3" x2="39" y2="39" />
    `;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
      <style>
        .net { stroke-width: 0.28; stroke-opacity: 0.95; }
        .center-mark { stroke-width: 0.25; }
      </style>
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.65" />
        </filter>
      </defs>
      <g fill="#020a15" opacity="0.42" filter="url(#shadow)">
        <rect x="0" y="0" width="${portrait ? 36 : 78}" height="${portrait ? 78 : 36}" rx="0.35" />
      </g>
      <g fill="none" stroke="#FFFFFF" stroke-opacity="0.78" stroke-width="0.16">
        ${markings}
      </g>
    </svg>
  `);
}

function logoClearSpaceSvg({ width, height }) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#06172F" stop-opacity="1" />
          <stop offset="55%" stop-color="#06172F" stop-opacity="1" />
          <stop offset="78%" stop-color="#06172F" stop-opacity="0.82" />
          <stop offset="100%" stop-color="#06172F" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fade)" />
    </svg>
  `);
}

const jobs = [
  {
    source: "tenaceiq-night-intelligence-phone-source.png",
    output: "tenaceiq-phone-1290x2796-night-intelligence.png",
    logo: "tenaceiq-full-transparent.png",
    width: 1290,
    height: 2796,
    logoWidth: 610,
    logoTop: 2350,
    logoLeft: 340,
  },
  {
    source: "tenaceiq-night-intelligence-desktop-source.png",
    output: "tenaceiq-desktop-4k-night-intelligence.png",
    logo: "tenaceiq-full-transparent.png",
    width: 3840,
    height: 2160,
    logoWidth: 760,
    logoTop: 1810,
    logoLeft: 1540,
  },
  {
    source: "tenaceiq-regulation-court-phone-source.png",
    output: "tenaceiq-phone-1290x2796-court-intelligence.png",
    logo: "tenaceiq-full-transparent.png",
    width: 1290,
    height: 2796,
    logoWidth: 820,
    logoTop: 1283,
    logoLeft: 235,
    logoBackdrop: {
      width: 1110,
      height: 440,
      left: 90,
      top: 1178,
    },
    court: {
      orientation: "portrait",
      width: 920,
      height: 1840,
      left: 185,
      top: 360,
    },
  },
  {
    source: "tenaceiq-regulation-court-desktop-source.png",
    output: "tenaceiq-desktop-4k-court-intelligence.png",
    logo: "tenaceiq-full-transparent.png",
    width: 3840,
    height: 2160,
    logoWidth: 1400,
    logoTop: 883,
    logoLeft: 1220,
    logoBackdrop: {
      width: 1900,
      height: 640,
      left: 970,
      top: 760,
    },
    court: {
      orientation: "landscape",
      width: 3100,
      height: 1550,
      left: 370,
      top: 100,
    },
  },
  {
    source: "tenaceiq-signature-court-phone-source.png",
    output: "tenaceiq-phone-1290x2796-signature-court.png",
    logoMaster: "tenaceiq-full-dark-ui.svg",
    width: 1290,
    height: 2796,
    logoWidth: 1050,
    ballWatermark: {
      width: 800,
      height: 800,
      left: 420,
      top: 470,
      opacity: 0.13,
    },
  },
  {
    source: "tenaceiq-signature-court-desktop-source.png",
    output: "tenaceiq-desktop-4k-signature-court.png",
    logoMaster: "tenaceiq-full-dark-ui.svg",
    width: 3840,
    height: 2160,
    logoWidth: 2050,
    ballWatermark: {
      width: 1320,
      height: 1320,
      left: 2350,
      top: 90,
      opacity: 0.13,
    },
  },
];

const requestedOutputs = new Set(process.argv.slice(2));
const jobsToBuild = requestedOutputs.size
  ? jobs.filter((job) => requestedOutputs.has(job.output))
  : jobs;

for (const job of jobsToBuild) {
  const sourcePath = path.join(wallpaperDir, job.source);
  const outputPath = path.join(wallpaperDir, job.output);
  const logoPath = job.logoMaster
    ? path.join(masterDir, job.logoMaster)
    : path.join(logoDir, job.logo);
  const logoResult = await sharp(logoPath)
    .resize({ width: job.logoWidth, withoutEnlargement: !job.logoMaster })
    .png()
    .toBuffer({ resolveWithObject: true });
  const logo = logoResult.data;
  const logoLeft = job.logoLeft ?? Math.round((job.width - logoResult.info.width) / 2);
  const logoTop = job.logoTop ?? Math.round((job.height - logoResult.info.height) / 2);

  const overlays = [];
  if (job.court) {
    overlays.push({
      input: regulationCourtSvg(job.court),
      left: job.court.left,
      top: job.court.top,
    });
  }
  if (job.logoBackdrop) {
    overlays.push({
      input: logoClearSpaceSvg(job.logoBackdrop),
      left: job.logoBackdrop.left,
      top: job.logoBackdrop.top,
    });
  }
  if (job.ballWatermark) {
    overlays.push({
      input: ballWatermarkSvg(job.ballWatermark),
      left: job.ballWatermark.left,
      top: job.ballWatermark.top,
    });
  }
  overlays.push({
    input: logo,
    left: logoLeft,
    top: logoTop,
  });

  await sharp(sourcePath)
    .resize(job.width, job.height, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .composite(overlays)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  console.log(`Built ${path.relative(root, outputPath)}`);
}
