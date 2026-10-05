import { deflateSync } from "node:zlib";

const NAVY = { r: 24, g: 43, b: 83 };
const ORANGE = { r: 237, g: 76, b: 20 };

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export function createBrandIconPng(size: number): Buffer {
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(rowBytes * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * 0.28;

  for (let y = 0; y < size; y++) {
    const row = y * rowBytes;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const color = dx * dx + dy * dy <= radius * radius ? ORANGE : NAVY;
      const index = row + 1 + x * 3;
      raw[index] = color.r;
      raw[index + 1] = color.g;
      raw[index + 2] = color.b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
