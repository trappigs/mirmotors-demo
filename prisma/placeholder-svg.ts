// Demo stokları için temsili araç illüstrasyonları üretir (gerçek araç fotoğrafı değildir).

type Shape = { roofY: number; roofStart: number; roofEnd: number; hoodY: number; tailY: number };

const SHAPES: Record<string, Shape> = {
  Sedan: { roofY: 330, roofStart: 470, roofEnd: 790, hoodY: 430, tailY: 425 },
  Hatchback: { roofY: 320, roofStart: 460, roofEnd: 900, hoodY: 435, tailY: 380 },
  SUV: { roofY: 270, roofStart: 430, roofEnd: 930, hoodY: 400, tailY: 330 },
  Coupe: { roofY: 350, roofStart: 500, roofEnd: 740, hoodY: 440, tailY: 440 },
  Cabrio: { roofY: 400, roofStart: 520, roofEnd: 700, hoodY: 440, tailY: 440 },
  "Station Wagon": { roofY: 325, roofStart: 460, roofEnd: 960, hoodY: 430, tailY: 345 },
};

// [arka duvar üst, arka duvar alt, zemin, spot ışığı, yazı rengi]
const STUDIOS = [
  ["#15181f", "#232833", "#0d0f14", "#ffffff", "#e8e8e8"],
  ["#e8e4dc", "#d3cdc2", "#bfb8ab", "#ffffff", "#2a2c31"],
  ["#111a2b", "#1d2a42", "#0b111c", "#c9a56b", "#e8e8e8"],
];

export function carSvg(opts: { color: string; bodyType: string; title: string; variant: number }) {
  const s = SHAPES[opts.bodyType] ?? SHAPES.Sedan;
  const [wall1, wall2, floor, spot, fg] = STUDIOS[opts.variant % STUDIOS.length];
  const flip = opts.variant === 1 ? `transform="translate(1200,0) scale(-1,1)"` : "";
  const body = `M140,540 L150,470 Q170,${s.hoodY} 300,${s.hoodY - 10} L${s.roofStart - 60},${s.hoodY - 20}
    Q${s.roofStart},${s.roofY} ${s.roofStart + 60},${s.roofY} L${s.roofEnd - 40},${s.roofY}
    Q${s.roofEnd + 20},${s.roofY + 5} ${s.roofEnd + 60},${s.tailY} L1040,${s.tailY + 20}
    Q1070,${s.tailY + 30} 1070,480 L1075,540 Z`;
  const win = `M${s.roofStart - 30},${s.hoodY - 25} Q${s.roofStart + 10},${s.roofY + 15} ${s.roofStart + 65},${s.roofY + 15}
    L${s.roofEnd - 45},${s.roofY + 15} Q${s.roofEnd},${s.roofY + 20} ${s.roofEnd + 30},${s.hoodY - 25} Z`;
  const pillar = (s.roofStart + s.roofEnd) / 2 + 10;
  const wheel = (x: number) => `
    <circle cx="${x}" cy="545" r="78" fill="#0a0b0d"/>
    <circle cx="${x}" cy="545" r="54" fill="url(#rim)"/>
    <circle cx="${x}" cy="545" r="54" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="3"/>
    ${[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => `<rect x="${x - 2.5}" y="495" width="5" height="44" rx="2" fill="#1a1c20" fill-opacity="0.85" transform="rotate(${a} ${x} 545)"/>`).join("")}
    <circle cx="${x}" cy="545" r="14" fill="#2b2e34" stroke="#9aa0a8" stroke-opacity="0.5" stroke-width="2"/>`;
  const car = `
    <path d="${body}" fill="url(#paint)"/>
    <path d="${body}" fill="url(#sheen)"/>
    <path d="${body}" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2.5"/>
    <path d="${win}" fill="url(#glass)"/>
    <rect x="${pillar}" y="${s.roofY + 10}" width="14" height="${s.hoodY - s.roofY - 30}" fill="url(#paint)"/>
    <path d="M190,478 Q600,470 1045,482" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2"/>
    <path d="M150,470 L205,466 L205,482 L152,486 Z" fill="#fff7dc"/>
    <rect x="1036" y="${s.tailY + 35}" width="32" height="14" rx="4" fill="#d01c2a"/>
    ${wheel(320)}${wheel(910)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall1}"/><stop offset="1" stop-color="${wall2}"/></linearGradient>
    <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall2}"/><stop offset="1" stop-color="${floor}"/></linearGradient>
    <radialGradient id="spot" cx="0.5" cy="0" r="0.75"><stop offset="0" stop-color="${spot}" stop-opacity="0.22"/><stop offset="1" stop-color="${spot}" stop-opacity="0"/></radialGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${opts.color}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${opts.color}"/><stop offset="1" stop-color="${opts.color}" stop-opacity="0.75"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4558"/><stop offset="0.6" stop-color="#0c1018"/></linearGradient>
    <radialGradient id="rim" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#c9ced6"/><stop offset="1" stop-color="#4a4f57"/></radialGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="reflMask"><rect x="0" y="623" width="1200" height="177" fill="url(#fade)"/></mask>
  </defs>
  <rect width="1200" height="800" fill="url(#wall)"/>
  <rect y="560" width="1200" height="240" fill="url(#floorG)"/>
  <rect width="1200" height="800" fill="url(#spot)"/>
  <path d="M0,560 L1200,560" stroke="#fff" stroke-opacity="0.06"/>
  <g ${flip}>
    <g mask="url(#reflMask)"><g transform="translate(0,1246) scale(1,-1)" opacity="0.5">${car}</g></g>
    <ellipse cx="615" cy="622" rx="520" ry="26" fill="url(#shadow)"/>
    ${car}
  </g>
  <text x="600" y="770" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="5" fill="${fg}" fill-opacity="0.55">TEMSİLİ GÖRSEL · DEMO</text>
</svg>`;
}

export function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
