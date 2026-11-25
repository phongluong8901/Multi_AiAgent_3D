// Zero-dependency ISO/IEC 18004 QR Code SVG encoder (Byte mode, ECC Level L, Versions 1..6)

interface QrVersionSpec {
  ver: number;
  totalDataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignCenters: number[];
}

const VERSION_SPECS: QrVersionSpec[] = [
  { ver: 1, totalDataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks: 1, alignCenters: [] },
  { ver: 2, totalDataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks: 1, alignCenters: [6, 18] },
  { ver: 3, totalDataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks: 1, alignCenters: [6, 22] },
  { ver: 4, totalDataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks: 1, alignCenters: [6, 26] },
  { ver: 5, totalDataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks: 1, alignCenters: [6, 30] },
  { ver: 6, totalDataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks: 2, alignCenters: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function computeFormatBits(eccBits: number, mask: number): number {
  const data = (eccBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function encodeCodewords(utf8: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode 0100 (Byte), 8-bit length for Versions 1..9
  pushBits(0b0100, 4);
  pushBits(utf8.length, 8);
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }

  const maxDataBits = spec.totalDataCodewords * 8;
  const term = Math.min(4, maxDataBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCw = new Uint8Array(spec.totalDataCodewords);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataCw[byteIdx++] = b;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (byteIdx < spec.totalDataCodewords) {
    dataCw[byteIdx++] = padBytes[padIdx % 2];
    padIdx++;
  }

  const blockDataLen = Math.floor(spec.totalDataCodewords / spec.numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.numBlocks; b++) {
    const slice = dataCw.slice(b * blockDataLen, (b + 1) * blockDataLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const out: number[] = [];
  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) out.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) out.push(ecBlocks[b][i]);
  }
  return new Uint8Array(out);
}

export function renderQrCodeSvg(text: string, sizePx = 176): string {
  const utf8 = new TextEncoder().encode(text);
  const spec = VERSION_SPECS.find((s) => utf8.length + 2 <= s.totalDataCodewords);
  if (!spec) {
    return `<div style="font-size:11px;color:#fca5a5;padding:12px;">URL quá dài cho mã QR nội bộ (${utf8.length} bytes).</div>`;
  }

  const size = spec.ver * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    isFunc[y][x] = true;
  };

  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunctionModule(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let i = 0; i < size; i++) {
    if (!isFunc[6][i]) setFunctionModule(i, 6, i % 2 === 0);
    if (!isFunc[i][6]) setFunctionModule(6, i, i % 2 === 0);
  }

  const centers = spec.alignCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cx = centers[i];
      const cy = centers[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserve format bits & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunc[8][i] = true;
      isFunc[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = true;
    isFunc[size - 1 - i][8] = true;
  }
  setFunctionModule(8, 4 * spec.ver + 9, true);

  const codewords = encodeCodewords(utf8, spec);
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!isFunc[y][x]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply mask 0: (x + y) % 2 === 0
          if ((x + y) % 2 === 0) dark = !dark;
          modules[y][x] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Write format bits for ECC Level L (01) + Mask 0 (000)
  const fmtBits = computeFormatBits(0b01, 0);
  for (let i = 0; i <= 5; i++) modules[8][i] = ((fmtBits >> i) & 1) === 1;
  modules[8][7] = ((fmtBits >> 6) & 1) === 1;
  modules[8][8] = ((fmtBits >> 7) & 1) === 1;
  modules[7][8] = ((fmtBits >> 8) & 1) === 1;
  for (let i = 9; i < 15; i++) modules[14 - i][8] = ((fmtBits >> i) & 1) === 1;

  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = ((fmtBits >> i) & 1) === 1;
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = ((fmtBits >> i) & 1) === 1;

  const margin = 3;
  const viewSize = size + margin * 2;
  let pathData = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) {
        pathData += `M${x + margin},${y + margin}h1v1h-1z`;
      }
    }
  }

  return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="border-radius:10px;background:#ffffff;display:block;margin:0 auto;"><rect width="100%" height="100%" fill="#ffffff"/><path d="${pathData}" fill="#090d16"/></svg>`;
}
