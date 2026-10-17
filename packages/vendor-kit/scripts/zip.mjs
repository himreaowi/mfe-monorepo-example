// @ts-check
/**
 * Minimal ZIP writer (deflate, no dependencies; Node >= 22.2 for zlib.crc32). Enough for the
 * vendor kit: regular files, UTF-8 names, no zip64 (kit is far below 4 GB / 65535 files).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** @param {string} dir @returns {string[]} relative file paths, sorted */
function listFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) =>
      path
        .relative(dir, path.join(d.parentPath, d.name))
        .split(path.sep)
        .join('/'),
    )
    .sort();
}

/** DOS date/time of a Date. */
function dos(/** @type {Date} */ d) {
  return {
    time:
      (d.getHours() << 11) |
      (d.getMinutes() << 5) |
      Math.floor(d.getSeconds() / 2),
    date:
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Zip every file below `dir` into `zipFile`, under the folder `prefix/`.
 * @param {string} dir
 * @param {string} zipFile
 * @param {string} prefix
 * @returns {string[]} entry names
 */
export function zipDirectory(dir, zipFile, prefix) {
  /** @type {Buffer[]} */
  const chunks = [];
  /** @type {Buffer[]} */
  const central = [];
  let offset = 0;
  const names = [];
  for (const rel of listFiles(dir)) {
    const name = `${prefix}/${rel}`;
    names.push(name);
    const data = fs.readFileSync(path.join(dir, rel));
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const { time, date } = dos(fs.statSync(path.join(dir, rel)).mtime);
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, deflated);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(deflated.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(0, 30); // extra + comment length
    entry.writeUInt32LE(0, 34); // disk + internal attrs
    entry.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file 0644
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + deflated.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(zipFile), { recursive: true });
  fs.writeFileSync(zipFile, Buffer.concat([...chunks, centralBuf, end]));
  return names;
}
