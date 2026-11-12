/**
 * Read width/height from a PNG, JPEG, or WebP buffer. No dependencies.
 * Used by the splash size/width e2e guard.
 */
export function imageSize(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      // SOF markers carry the frame size
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), format: "jpeg" };
      }
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
        i += 2;
        continue;
      }
      const size = buf.readUInt16BE(i + 2);
      i += 2 + size;
    }
    return null;
  }
  if (buf.length >= 16 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const chunk = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      const data = offset + 8;
      if (chunk === "VP8X" && data + 10 <= buf.length) {
        const width = 1 + (buf[data + 4] | (buf[data + 5] << 8) | (buf[data + 6] << 16));
        const height = 1 + (buf[data + 7] | (buf[data + 8] << 8) | (buf[data + 9] << 16));
        return { width, height, format: "webp" };
      }
      if (chunk === "VP8 " && data + 10 <= buf.length) {
        const start = data + 3;
        if (buf[start] === 0x9d && buf[start + 1] === 0x01 && buf[start + 2] === 0x2a) {
          const width = buf.readUInt16LE(start + 3) & 0x3fff;
          const height = buf.readUInt16LE(start + 5) & 0x3fff;
          return { width, height, format: "webp" };
        }
      }
      if (chunk === "VP8L" && data + 5 <= buf.length && buf[data] === 0x2f) {
        const bits =
          buf[data + 1] | (buf[data + 2] << 8) | (buf[data + 3] << 16) | ((buf[data + 4] & 0x0f) << 24);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height, format: "webp" };
      }
      offset += 8 + size + (size & 1);
    }
    return null;
  }
  return null;
}
