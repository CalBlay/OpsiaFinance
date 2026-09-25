import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export type ExcelSource = string | Buffer | Uint8Array;

export function readWorkbook(source: ExcelSource): XLSX.WorkBook {
  const data = typeof source === "string" ? readFileSync(source) : source;
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    const head = Buffer.from(data.slice(0, 512)).toString("utf8");
    if (head.includes(";") && !head.includes("\x00") && /[A-Za-zÀ-ÿ]/.test(head)) {
      return XLSX.read(data, { type: "buffer", FS: ";", codepage: 65001 });
    }
  }
  return XLSX.read(data);
}
