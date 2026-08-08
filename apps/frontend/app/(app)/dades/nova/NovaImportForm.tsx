"use client";

import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FDLC_LN_CODI } from "@/lib/fdlc/constants";
import {
  aliasLnDesDelNomFitxer,
  classificacioDesDelNomFitxer,
  codiLnDelNomFitxer,
} from "@/lib/nom-fitxer";
import { TIPUS_INFORME_LABELS, type TipusInforme } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BulkFileResult, BulkImportState, CreateImportState } from "./actions";
import styles from "./page.module.css";

export type LnOption = { id: string; codi: string; nom: string };

const TIPUS_OPTIONS = Object.entries(TIPUS_INFORME_LABELS) as [TipusInforme, string][];

const ANYS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);
const MESOS = [
  [1, "Gener"],
  [2, "Febrer"],
  [3, "Març"],
  [4, "Abril"],
  [5, "Maig"],
  [6, "Juny"],
  [7, "Juliol"],
  [8, "Agost"],
  [9, "Setembre"],
  [10, "Octubre"],
  [11, "Novembre"],
  [12, "Desembre"],
] as [number, string][];
const MES_NOMS = MESOS.map(([, n]) => n);

const EXT_OK = ["xlsx", "xls"];
const esExcel = (nom: string) => EXT_OK.includes(nom.split(".").pop()?.toLowerCase() ?? "");

function deduirPeriodeLabel(nom: string): string {
  const p = classificacioDesDelNomFitxer(nom);
  if (!p) return "?";
  return `${MES_NOMS[p.mes - 1]} ${p.any}`;
}

function deduirLnLabel(nom: string, linies: LnOption[]): string | null {
  const p = classificacioDesDelNomFitxer(nom);
  if (!p?.codiLn) return null;
  const ln = linies.find((l) => l.codi === p.codiLn);
  if (ln) return `${ln.codi} · ${ln.nom}`;
  if (p.codiLn === FDLC_LN_CODI) return `${FDLC_LN_CODI} · EMPRESA FDLC`;
  return p.codiLn;
}

function lnIdDesDelNom(nom: string, linies: LnOption[]): string {
  const codi = codiLnDelNomFitxer(nom) ?? aliasLnDesDelNomFitxer(nom);
  if (!codi) return "";
  return linies.find((l) => l.codi === codi)?.id ?? "";
}

export function NovaImportForm({ linies }: { linies: LnOption[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [lnId, setLnId] = useState("");
  const [bulkLnFallback, setBulkLnFallback] = useState("");
  const [tipusInforme, setTipusInforme] = useState<TipusInforme | "">("");

  const esFdlc = tipusInforme === "PYG_FDLC";
  const esExerciciAnual = tipusInforme === "PYG_FDLC" || tipusInforme === "PYG_EXERCICI_LN";
  const esHistoricLn = tipusInforme === "PYG_EXERCICI_LN";
  const fdlcLn = linies.find((l) => l.codi === FDLC_LN_CODI);

  const bulkMode = files.length > 1;

  const [result, setResult] = useState<CreateImportState>({ status: "idle" });
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"auto" | "update" | "create">("auto");
  const [targetId, setTargetId] = useState("");
  const [newName, setNewName] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const showDuplicate = result.status === "duplicate" && !dismissed;

  useEffect(() => {
    if (esFdlc && fdlcLn) setLnId(fdlcLn.id);
  }, [esFdlc, fdlcLn]);

  useEffect(() => {
    if (esFdlc) return;
    if (files.length === 1 && !bulkMode) {
      const detected = lnIdDesDelNom(files[0].name, linies);
      if (detected) setLnId((prev) => prev || detected);
    }
  }, [files, bulkMode, linies, esFdlc]);

  const lnMismatch =
    !esFdlc && files.length === 1 && !bulkMode && lnId && files[0]
      ? (() => {
          const codiFitxer = codiLnDelNomFitxer(files[0].name);
          const codiSeleccionat = linies.find((l) => l.id === lnId)?.codi;
          return codiFitxer && codiSeleccionat && codiFitxer !== codiSeleccionat
            ? { codiFitxer, codiSeleccionat }
            : null;
        })()
      : null;

  async function submitSingle(overrides?: {
    mode?: "auto" | "update" | "create";
    targetId?: string;
    newName?: string;
  }) {
    if (!files[0]) {
      setClientError("Has de seleccionar un fitxer Excel.");
      return;
    }
    setClientError(null);
    setIsPending(true);

    const form = formRef.current;
    const fd = new FormData();
    fd.append("file", files[0]);
    if (form) {
      const tipus = (form.elements.namedItem("formatInformeId") as HTMLSelectElement)?.value;
      const any = (form.elements.namedItem("any") as HTMLSelectElement)?.value;
      const mes = (form.elements.namedItem("mes") as HTMLSelectElement)?.value;
      const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement)?.value;
      if (tipus) fd.append("formatInformeId", tipus);
      if (any) fd.append("any", any);
      if (mes) fd.append("mes", mes);
      if (notes) fd.append("notes", notes);
    }
    if (lnId) fd.append("liniaNegociId", lnId);
    fd.append("mode", overrides?.mode ?? mode);
    fd.append("targetId", overrides?.targetId ?? targetId);
    fd.append("newName", overrides?.newName ?? newName);

    try {
      const res = await fetch("/api/dades/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CreateImportState;
      setResult(data);
      setDismissed(false);
      if (data.status === "duplicate") {
        setNewName(data.suggestedName);
        setTargetId(data.existingId);
      } else if (data.status === "success") {
        router.push(`/dades/${data.importId}`);
      } else {
        setMode("auto");
      }
    } catch {
      setResult({
        status: "error",
        message:
          "No s'ha pogut connectar amb el servidor. Comprova la connexió i torna-ho a provar.",
      });
    } finally {
      setIsPending(false);
    }
  }

  function chooseUpdate() {
    submitSingle({ mode: "update", targetId });
  }
  function chooseCreate() {
    if (!newName.trim()) return;
    submitSingle({ mode: "create", newName: newName.trim() });
  }
  function cancelDuplicate() {
    setDismissed(true);
    setMode("auto");
  }

  const [bulkResult, setBulkResult] = useState<BulkImportState>({ status: "idle" });
  const [bulkPending, setBulkPending] = useState(false);
  const [autoConfirmar, setAutoConfirmar] = useState(true);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    nom: string;
  } | null>(null);
  const bulkFormRef = useRef<HTMLFormElement>(null);

  async function submitBulk() {
    if (files.length === 0) {
      setClientError("Has de seleccionar almenys un fitxer.");
      return;
    }

    const form = bulkFormRef.current;
    const tipus = (form?.elements.namedItem("formatInformeId") as HTMLSelectElement)?.value;
    const politica = (form?.elements.namedItem("politica") as HTMLSelectElement)?.value ?? "versio";
    const notes = (form?.elements.namedItem("notes") as HTMLTextAreaElement)?.value ?? "";

    if (!tipus) {
      setClientError("Has de seleccionar el tipus d'informe.");
      return;
    }

    setClientError(null);
    setBulkPending(true);
    setBulkResult({ status: "idle" });

    const resultats: BulkFileResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBulkProgress({ current: i + 1, total: files.length, nom: file.name });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("formatInformeId", tipus);
      fd.append("politica", politica);
      fd.append("autoConfirmar", autoConfirmar ? "true" : "false");
      if (notes) fd.append("notes", notes);
      const parsed = classificacioDesDelNomFitxer(file.name);
      if (!parsed?.codiLn && bulkLnFallback) fd.append("liniaNegociId", bulkLnFallback);

      try {
        const res = await fetch("/api/dades/upload-bulk-item", { method: "POST", body: fd });
        if (!res.ok) {
          resultats.push({
            nom: file.name,
            periode: deduirPeriodeLabel(file.name),
            ln: deduirLnLabel(file.name, linies),
            ok: false,
            confirmat: false,
            missatge: `Error del servidor (${res.status}).`,
          });
          continue;
        }
        resultats.push((await res.json()) as BulkFileResult);
      } catch {
        resultats.push({
          nom: file.name,
          periode: deduirPeriodeLabel(file.name),
          ln: deduirLnLabel(file.name, linies),
          ok: false,
          confirmat: false,
          missatge: "Error de connexió en aquest fitxer.",
        });
      }
    }

    setBulkProgress(null);
    setBulkResult({ status: "done", resultats });
    setBulkPending(false);
  }

  const anyPending = isPending || bulkPending;

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => esExcel(f.name));
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      return merged;
    });
    setMode("auto");
  }
  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setMode("auto");
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  const bulkResum =
    bulkResult.status === "done"
      ? {
          ok: bulkResult.resultats.filter((r) => r.ok).length,
          confirmats: bulkResult.resultats.filter((r) => r.confirmat).length,
          error: bulkResult.resultats.filter((r) => !r.ok && !r.missatge.startsWith("Omès")).length,
          omes: bulkResult.resultats.filter((r) => r.missatge.startsWith("Omès")).length,
          resultats: bulkResult.resultats,
        }
      : null;

  const lnSelect = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    disabled: boolean,
    required?: boolean
  ) => (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Línia de negoci{" "}
        {required ? (
          <span className={styles.required}>*</span>
        ) : (
          <span className={styles.optional}>(o al nom: 01_2025_00)</span>
        )}
      </label>
      <select
        id={id}
        name="liniaNegociId"
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Deduir del nom del fitxer…</option>
        {linies.map((ln) => (
          <option key={ln.id} value={ln.id}>
            {ln.codi} · {ln.nom}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <DadesPageShell
      narrow
      backHref="/dades"
      backLabel="Importacions"
      title="Nova importació"
      description={
        <>
          Puja un o diversos informes Excel. Conveni de nom recomanat:{" "}
          <span className="font-mono text-sm">mes_any_XX</span> (p.ex.{" "}
          <span className="font-mono text-sm">01_2025_00</span> = gener 2025, LN00000).
        </>
      }
    >
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Fitxers Excel</p>
        <label
          className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${files.length ? styles.hasFile : ""}`}
          htmlFor="nova-importacio-fitxers"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{ cursor: "pointer" }}
        >
          {files.length ? (
            <div className="flex w-full flex-col gap-2">
              {files.map((f, i) => {
                const lnLabel = deduirLnLabel(f.name, linies);
                return (
                  <div key={`${f.name}-${i}`} className={styles.fileSelected} style={{ margin: 0 }}>
                    <FileSpreadsheet size={20} className={styles.fileIcon} />
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{f.name}</span>
                      <span className={styles.fileSize}>
                        {(f.size / 1024).toFixed(0)} KB · {deduirPeriodeLabel(f.name)}
                        {lnLabel ? ` · ${lnLabel}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAt(i);
                      }}
                      aria-label="Treure fitxer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-muted-foreground">
                Fes clic per afegir-ne més o arrossega'ls aquí.
              </p>
            </div>
          ) : (
            <div className={styles.dropPrompt}>
              <Upload size={28} strokeWidth={1.5} className={styles.uploadIcon} />
              <p className={styles.dropTitle}>Arrossega aquí o fes clic per seleccionar</p>
              <p className={styles.dropHint}>Un o diversos fitxers · .xlsx, .xls</p>
            </div>
          )}
        </label>
        <input
          id="nova-importacio-fitxers"
          ref={pickerRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {clientError && <p className={styles.error}>{clientError}</p>}

      {bulkMode ? (
        <form
          ref={bulkFormRef}
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submitBulk();
          }}
        >
          {bulkResult.status === "error" && <p className={styles.error}>{bulkResult.message}</p>}

          <div className={styles.section}>
            <p className={styles.sectionLabel}>
              <Layers size={14} className="mr-1 inline" /> Càrrega massiva · {files.length} fitxers
            </p>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="bulkTipus" className={styles.label}>
                  Tipus d'informe <span className={styles.required}>*</span>
                </label>
                <select
                  id="bulkTipus"
                  name="formatInformeId"
                  className={styles.select}
                  defaultValue=""
                  required
                  disabled={bulkPending}
                  onChange={(e) => setTipusInforme(e.target.value as TipusInforme)}
                >
                  <option value="" disabled>
                    Selecciona un tipus…
                  </option>
                  {TIPUS_OPTIONS.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="politica" className={styles.label}>
                  Si ja existeix (mateix període + LN)
                </label>
                <select
                  id="politica"
                  name="politica"
                  className={styles.select}
                  defaultValue="versio"
                  disabled={bulkPending}
                >
                  <option value="versio">Crear una versió nova (renombrar)</option>
                  <option value="actualitzar">Actualitzar l'existent</option>
                  <option value="ometre">Ometre'l</option>
                </select>
              </div>
              {lnSelect("bulkLn", bulkLnFallback, setBulkLnFallback, bulkPending)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              El mes, l'any i la LN es dedueixen del nom de cada fitxer (
              <span className="font-mono">01_2025_00</span>). Si algun fitxer no porta sufix de LN,
              s'usa la línia seleccionada a dalt.
            </p>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>
              Notes <span className={styles.optional}>(opcional, s'apliquen a tots)</span>
            </p>
            <textarea
              name="notes"
              className={styles.textarea}
              placeholder="Observacions…"
              rows={2}
              disabled={bulkPending}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={autoConfirmar}
              onChange={(e) => setAutoConfirmar(e.target.checked)}
              disabled={bulkPending}
            />
            <span>
              Confirmar automàticament després de processar
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Les importacions correctes passaran directament a l'estat «Confirmat», sense revisió
                manual.
              </span>
            </span>
          </label>

          {bulkProgress && (
            <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                Processant {bulkProgress.current} de {bulkProgress.total}…
              </p>
              <p className="mt-0.5 truncate text-muted-foreground">{bulkProgress.nom}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {bulkResum && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Resultat</p>
              <div className="mb-3 flex flex-wrap gap-3 text-sm">
                {bulkResum.ok > 0 && (
                  <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 size={14} />
                    {bulkResum.ok} processats
                    {bulkResum.confirmats > 0 ? ` · ${bulkResum.confirmats} confirmats` : ""}
                  </span>
                )}
                {bulkResum.omes > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {bulkResum.omes} omesos
                  </span>
                )}
                {bulkResum.error > 0 && (
                  <span className="flex items-center gap-1 font-medium text-destructive">
                    <XCircle size={14} />
                    {bulkResum.error} amb error
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {bulkResum.resultats.map((r) => (
                  <div
                    key={`${r.nom}-${r.periode}-${r.ln ?? "sense-ln"}`}
                    className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    {r.ok ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">{r.nom}</span>
                      <span className="text-muted-foreground"> · {r.periode}</span>
                      {r.ln && <span className="text-muted-foreground"> · {r.ln}</span>}
                      <p className="text-xs text-muted-foreground">{r.missatge}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button asChild variant="outline">
                  <Link href="/dades">Anar a la llista d'importacions</Link>
                </Button>
              </div>
            </div>
          )}

          {bulkResult.status !== "done" && (
            <div className={styles.actions}>
              <Button type="submit" disabled={bulkPending}>
                {bulkPending
                  ? bulkProgress
                    ? `Processant ${bulkProgress.current}/${bulkProgress.total}…`
                    : "Iniciant…"
                  : autoConfirmar
                    ? `Pujar, processar i confirmar ${files.length} fitxers`
                    : `Pujar i processar ${files.length} fitxers`}
              </Button>
              <Button asChild variant="outline" disabled={bulkPending}>
                <Link href="/dades">Cancel·lar</Link>
              </Button>
            </div>
          )}
        </form>
      ) : (
        <form
          ref={formRef}
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submitSingle();
          }}
        >
          {result.status === "error" && <p className={styles.error}>{result.message}</p>}

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Classificació</p>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="formatInformeId" className={styles.label}>
                  Tipus d'informe <span className={styles.required}>*</span>
                </label>
                <select
                  id="formatInformeId"
                  name="formatInformeId"
                  className={styles.select}
                  defaultValue=""
                  required
                  disabled={isPending}
                  onChange={(e) => setTipusInforme(e.target.value as TipusInforme)}
                >
                  <option value="" disabled>
                    Selecciona un tipus…
                  </option>
                  {TIPUS_OPTIONS.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {lnSelect("lnId", lnId, setLnId, isPending || esFdlc, !esFdlc)}
              {esFdlc && (
                <p className="col-span-full text-xs text-muted-foreground">
                  Puja l&apos;Excel amb les columnes mensuals (Gener, Febrer…). El sistema importa
                  <strong> tots els mesos amb dades</strong> de l&apos;exercici seleccionat i
                  actualitza la C. d&apos;explotació FDLC.
                </p>
              )}
              {esHistoricLn && (
                <p className="col-span-full text-xs text-muted-foreground">
                  Històric Cal Blay (Hoja1 des de la fila 49: Gener…Desembre). Un fitxer = un any
                  per LN. Vendes a cada LN; Central amb totals de compres/salaris/gestió. Es carrega
                  com a <strong>Directe</strong> (sense repartiment).
                </p>
              )}
              {lnMismatch && (
                <p className="col-span-full text-xs text-amber-700">
                  El fitxer «{files[0]?.name}» indica {lnMismatch.codiFitxer}, però has seleccionat{" "}
                  {lnMismatch.codiSeleccionat}. Reanomena el fitxer o corregeix la LN abans de
                  pujar.
                </p>
              )}
              <div className={styles.field}>
                <label htmlFor="any" className={styles.label}>
                  Any (exercici) <span className={styles.required}>*</span>
                </label>
                <select
                  id="any"
                  name="any"
                  className={styles.select}
                  defaultValue={new Date().getFullYear()}
                  disabled={isPending}
                >
                  {ANYS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {!esExerciciAnual && (
                <div className={styles.field}>
                  <label htmlFor="mes" className={styles.label}>
                    Mes <span className={styles.required}>*</span>
                  </label>
                  <select
                    id="mes"
                    name="mes"
                    className={styles.select}
                    defaultValue={new Date().getMonth() + 1}
                    disabled={isPending}
                  >
                    {MESOS.map(([num, nom]) => (
                      <option key={num} value={num}>
                        {nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>
              Notes <span className={styles.optional}>(opcional)</span>
            </p>
            <textarea
              name="notes"
              className={styles.textarea}
              placeholder="Observacions sobre aquesta càrrega…"
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className={styles.actions}>
            <Button type="submit" disabled={isPending || files.length === 0}>
              {isPending ? "Pujant…" : "Pujar i classificar"}
            </Button>
            <Button asChild variant="outline" disabled={isPending}>
              <Link href="/dades">Cancel·lar</Link>
            </Button>
          </div>
        </form>
      )}

      {showDuplicate && result.status === "duplicate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Ja existeix una importació per aquest període i LN
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ja hi ha «{result.existingName}» per {result.existingPeriod} · {result.existingLn}
                  . Vols actualitzar-la amb aquest fitxer o crear-ne una de nova?
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">Nom per a la nova importació</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Format recomanat: <span className="font-mono">mes_any_XX</span> (p. ex. 01_2026_00).
              </p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={cancelDuplicate} disabled={anyPending}>
                Cancel·lar
              </Button>
              <Button type="button" variant="outline" onClick={chooseUpdate} disabled={anyPending}>
                {isPending ? "Actualitzant…" : "Actualitzar l'existent"}
              </Button>
              <Button type="button" onClick={chooseCreate} disabled={anyPending || !newName.trim()}>
                {isPending ? "Creant…" : "Crear nova"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DadesPageShell>
  );
}
