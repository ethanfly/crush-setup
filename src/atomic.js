"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * Write data atomically: temp file in the same directory, then rename.
 * On Windows, replacing an existing dest via rename can fail; fall back to
 * unlink+rename. Never leaves a truncated dest from this process's write.
 */
function atomicWriteFile(dest, data, { mode = 0o600 } = {}) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  const token = crypto.randomBytes(6).toString("hex");
  const tmp = path.join(dir, `${path.basename(dest)}.${token}.tmp`);
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
  try {
    const fd = fs.openSync(tmp, "w", mode);
    try {
      fs.writeFileSync(fd, payload);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.renameSync(tmp, dest);
    } catch (err) {
      if (process.platform === "win32") {
        try {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
        } catch {
          // dest may be locked; last-ditch copy then unlink tmp
        }
        try {
          fs.renameSync(tmp, dest);
        } catch {
          fs.copyFileSync(tmp, dest);
          fs.unlinkSync(tmp);
        }
      } else {
        throw err;
      }
    }
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore cleanup
    }
    throw err;
  }
}

module.exports = { atomicWriteFile };
