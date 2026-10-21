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

const BACKGROUNDS = [
  ["#1c1d21", "#3a3c42", "#e8e8e8"],
  ["#e9e7e2", "#c9c6bf", "#1c1d21"],
  ["#22262e", "#4a5160", "#e8e8e8"],
];

export function carSvg(opts: { color: string; bodyType: string; title: string; variant: number }) {
  const s = SHAPES[opts.bodyType] ?? SHAPES.Sedan;
  const [bg1, bg2, fg] = BACKGROUNDS[opts.variant % BACKGROUNDS.length];
  const flip = opts.variant === 1 ? `transform="translate(1200,0) scale(-1,1)"` : "";
  const body = `M140,540 L150,470 Q170,${s.hoodY} 300,${s.hoodY - 10} L${s.roofStart - 60},${s.hoodY - 20}
    Q${s.roofStart},${s.roofY} ${s.roofStart + 60},${s.roofY} L${s.roofEnd - 40},${s.roofY}
    Q${s.roofEnd + 20},${s.roofY + 5} ${s.roofEnd + 60},${s.tailY} L1040,${s.tailY + 20}
    Q1070,${s.tailY + 30} 1070,480 L1075,540 Z`;
  const win = `M${s.roofStart - 30},${s.hoodY - 25} Q${s.roofStart + 10},${s.roofY + 15} ${s.roofStart + 65},${s.roofY + 15}
    L${s.roofEnd - 45},${s.roofY + 15} Q${s.roofEnd},${s.roofY + 20} ${s.roofEnd + 30},${s.hoodY - 25} Z`;
  const pillar = (s.roofStart + s.roofEnd) / 2 + 10;
  const wheel = (x: number) => `
    <circle cx="${x}" cy="545" r="78" fill="#0d0d0f"/>
    <circle cx="${x}" cy="545" r="50" fill="#5d6068"/>
    <circle cx="${x}" cy="545" r="16" fill="#202125"/>
    ${[0, 72, 144, 216, 288].map((a) => `<rect x="${x - 4}" y="499" width="8" height="40" fill="#2a2b30" transform="rotate(${a} ${x} 545)"/>`).join("")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${opts.color}" stop-opacity="0.85"/><stop offset="0.55" stop-color="${opts.color}"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>
    <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <ellipse cx="600" cy="625" rx="520" ry="40" fill="url(#floor)"/>
  <g ${flip}>
    <path d="${body}" fill="url(#paint)" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
    <path d="${win}" fill="#10141b" fill-opacity="0.85"/>
    <rect x="${pillar}" y="${s.roofY + 10}" width="14" height="${s.hoodY - s.roofY - 30}" fill="url(#paint)"/>
    <path d="M200,480 L1040,480" stroke="#fff" stroke-opacity="0.18" stroke-width="3"/>
    <rect x="150" y="465" width="45" height="16" rx="6" fill="#fff6d0"/>
    <rect x="1035" y="${s.tailY + 35}" width="32" height="18" rx="5" fill="#c1121f"/>
    ${wheel(320)}${wheel(910)}
  </g>
  <text x="60" y="90" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="${fg}">${escape(opts.title)}</text>
  <text x="60" y="740" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="4" fill="${fg}" fill-opacity="0.7">TEMSİLİ GÖRSEL · DEMO</text>
</svg>`;
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
