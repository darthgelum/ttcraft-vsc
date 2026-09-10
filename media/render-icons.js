// Renders media/dice.svg's geometry to dice.png (96x96), the activity-bar icon.
// VS Code uses it as a CSS mask scaled to 24px, so only the alpha channel
// matters and 4x keeps it crisp on HiDPI.
//
// The shape is simple enough (a rounded-rect outline plus five pips) to sample
// analytically from signed distance fields, which antialiases better than
// supersampling and keeps this dependency-free. Run with `npm run icons`.
//
// The marketplace tile (icon.png) is a different picture — the TTCraft mark on
// the landing sky — rendered from media/icon.html with a headless browser; see
// the comment in that file.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- geometry, in the SVG's 24x24 user space --------------------------------

const PIPS = [[8, 8], [16, 8], [12, 12], [8, 16], [16, 16]];
const PIP_R = 1.2;
const STROKE = 1.6;

/** Signed distance to a rounded rect (negative inside). */
function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - (hx - r);
  const qy = Math.abs(py - cy) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Signed distance to the whole die: the stroked frame unioned with the pips. */
function sdDie(x, y) {
  // rect x=3 y=3 w=18 h=18 rx=4, stroked: the outline is the |distance| shell.
  let d = Math.abs(sdRoundRect(x, y, 12, 12, 9, 9, 4)) - STROKE / 2;
  for (const [cx, cy] of PIPS) {
    d = Math.min(d, Math.hypot(x - cx, y - cy) - PIP_R);
  }
  return d;
}

/** Edge coverage from a distance in user units, given pixels-per-unit. */
function coverage(d, ppu) {
  return Math.max(0, Math.min(1, 0.5 - d * ppu));
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 8-bit RGBA, no interlacing, one unfiltered scanline per row. */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- painting ---------------------------------------------------------------

/** Source-over of a straight (non-premultiplied) colour onto the buffer. */
function over(rgba, i, [r, g, b], a) {
  if (a <= 0) {
    return;
  }
  const dstA = rgba[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  for (let c = 0; c < 3; c++) {
    const src = [r, g, b][c];
    rgba[i + c] = Math.round((src * a + rgba[i + c] * dstA * (1 - a)) / outA);
  }
  rgba[i + 3] = Math.round(outA * 255);
}

/** The die alone on transparency — an alpha mask for the activity bar. */
function renderMask(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const ppu = size / 24;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = coverage(sdDie((x + 0.5) / ppu, (y + 0.5) / ppu), ppu);
      over(rgba, (y * size + x) * 4, [255, 255, 255], a);
    }
  }
  return rgba;
}

const outputs = [['dice.png', 96, renderMask(96)]];

for (const [name, size, rgba] of outputs) {
  const file = path.join(__dirname, name);
  fs.writeFileSync(file, encodePng(size, rgba));
  console.log(`wrote ${name} (${size}x${size})`);
}
