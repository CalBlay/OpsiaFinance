import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export type ExcelSource = string | Buffer | Uint8Array;

export function readWorkbook(source: ExcelSource): XLSX.WorkBook {
  const data = typeof source === "string" ? readFileSync(source) : source;
  return XLSX.read(data);
}
