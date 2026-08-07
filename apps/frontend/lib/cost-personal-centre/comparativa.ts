/**
 * Comparativa centre × mes (i agregat per LN): SAP directe (sense ajustos) vs Nòmina + Millores.
 * Objectiu: detectar desviacions (N+M) − SAP en sous i SS per separat.
 * Gestió no forma part d’aquesta vista.
 */

import { carregarBaseSapNomesPersonal } from "@/lib/cost-personal-centre/base-gestio";
import { desglossarFilaPayroll } from "@/lib/cost-personal-centre/payroll-imports";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";

export type ImportsSousSs = {
  sous: number;
  ss: number;
  /** sous + ss */
  total: number;
};

export type FilComparativaPersonal = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  liniaCodi: string | null;
  sap: ImportsSousSs;
  nomina: ImportsSousSs;
  millores: ImportsSousSs;
  /** Nòmina + millores importades. */
  payroll: ImportsSousSs;
  /** (N+M) − SAP directe: sous i SS per separat. */
  deltaPayrollSap: ImportsSousSs;
  tePayroll: boolean;
};

export type FilComparativaPersonalLn = {
  liniaCodi: string;
  sap: ImportsSousSs;
  nomina: ImportsSousSs;
  millores: ImportsSousSs;
  payroll: ImportsSousSs;
  deltaPayrollSap: ImportsSousSs;
  centres: number;
};

export type ComparativaPersonalMes = {
  any: number;
  mes: number;
  periodNom: string;
  files: FilComparativaPersonal[];
  /** Agregat per LN (suma dels centres). */
  perLn: FilComparativaPersonalLn[];
  totals: {
    sap: ImportsSousSs;
    nomina: ImportsSousSs;
    millores: ImportsSousSs;
    payroll: ImportsSousSs;
    deltaPayrollSap: ImportsSousSs;
  };
  resum: {
    centresAmbPayroll: number;
    centresNomesSap: number;
    centresAmbDiferencia: number;
  };
};

function empty(): ImportsSousSs {
  return { sous: 0, ss: 0, total: 0 };
}

function add(a: ImportsSousSs, b: ImportsSousSs): ImportsSousSs {
  return {
    sous: a.sous + b.sous,
    ss: a.ss + b.ss,
    total: a.total + b.total,
  };
}

function fromSapSigns(sousCompte: number, ssCompte: number): ImportsSousSs {
  const sous = Math.abs(sousCompte);
  const ss = Math.abs(ssCompte);
  return { sous, ss, total: sous + ss };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundImp(i: ImportsSousSs): ImportsSousSs {
  return {
    sous: round2(i.sous),
    ss: round2(i.ss),
    total: round2(i.total),
  };
}

/** Diferència (N+M) − SAP en sous i SS. */
function deltaImp(payroll: ImportsSousSs, sap: ImportsSousSs): ImportsSousSs {
  const sous = round2(payroll.sous - sap.sous);
  const ss = round2(payroll.ss - sap.ss);
  return { sous, ss, total: round2(sous + ss) };
}

function teDiferencia(d: ImportsSousSs): boolean {
  return Math.abs(d.sous) > 0.5 || Math.abs(d.ss) > 0.5;
}

export async function getComparativaPersonalMes(
  any: number,
  mes: number
): Promise<ComparativaPersonalMes> {
  const [sapBase, payrollRows, centres] = await Promise.all([
    carregarBaseSapNomesPersonal({ any, mes }),
    db.costPersonalCentre.findMany({
      where: { period: { any, mes } },
      select: {
        centreId: true,
        origen: true,
        importBrut: true,
        segSocialEmpresa: true,
        totalSegSocial: true,
        costPersonal: true,
      },
    }),
    db.centre.findMany({
      where: { isActive: true },
      select: {
        id: true,
        codi: true,
        nom: true,
        liniaNegoci: { select: { codi: true } },
      },
      orderBy: { codi: "asc" },
    }),
  ]);

  const centreById = new Map(centres.map((c) => [c.id, c]));

  const nominaByCentre = new Map<string, ImportsSousSs>();
  const milloresByCentre = new Map<string, ImportsSousSs>();

  for (const f of payrollRows) {
    const d = desglossarFilaPayroll(f);
    const imp: ImportsSousSs = {
      sous: d.sous,
      ss: d.seguretatSocial,
      total: d.sous + d.seguretatSocial,
    };
    const map = f.origen === "MILLORES" ? milloresByCentre : nominaByCentre;
    map.set(f.centreId, add(map.get(f.centreId) ?? empty(), imp));
  }

  const centreIds = new Set<string>([
    ...sapBase.keys(),
    ...nominaByCentre.keys(),
    ...milloresByCentre.keys(),
  ]);

  const files: FilComparativaPersonal[] = [];
  let centresAmbPayroll = 0;
  let centresNomesSap = 0;
  let centresAmbDiferencia = 0;

  let totSap = empty();
  let totNomina = empty();
  let totMillores = empty();
  let totPayroll = empty();

  for (const centreId of centreIds) {
    const meta = centreById.get(centreId);
    if (!meta) continue;

    const sapCel = sapBase.get(centreId)?.get(mes);
    const sap = sapCel
      ? fromSapSigns(sapCel.imports.importBrut, sapCel.imports.totalSegSocial)
      : empty();
    const nomina = roundImp(nominaByCentre.get(centreId) ?? empty());
    const millores = roundImp(milloresByCentre.get(centreId) ?? empty());
    const payroll = roundImp(add(nomina, millores));
    const deltaPayrollSap = deltaImp(payroll, sap);

    const tePayroll = payroll.total > 0.005;
    if (tePayroll) centresAmbPayroll++;
    else if (sap.total > 0.005) centresNomesSap++;
    if (teDiferencia(deltaPayrollSap)) {
      centresAmbDiferencia++;
    }

    files.push({
      centreId,
      centreCodi: meta.codi,
      centreNom: meta.nom,
      liniaCodi: meta.liniaNegoci?.codi ?? null,
      sap: roundImp(sap),
      nomina,
      millores,
      payroll,
      deltaPayrollSap,
      tePayroll,
    });

    totSap = add(totSap, sap);
    totNomina = add(totNomina, nomina);
    totMillores = add(totMillores, millores);
    totPayroll = add(totPayroll, payroll);
  }

  files.sort((a, b) => {
    const da = Math.max(Math.abs(a.deltaPayrollSap.sous), Math.abs(a.deltaPayrollSap.ss));
    const db_ = Math.max(Math.abs(b.deltaPayrollSap.sous), Math.abs(b.deltaPayrollSap.ss));
    if (Math.abs(da - db_) > 0.5) return db_ - da;
    return a.centreCodi.localeCompare(b.centreCodi, "ca", { numeric: true });
  });

  const lnMap = new Map<
    string,
    {
      sap: ImportsSousSs;
      nomina: ImportsSousSs;
      millores: ImportsSousSs;
      payroll: ImportsSousSs;
      centres: number;
    }
  >();
  for (const f of files) {
    const ln = f.liniaCodi ?? "—";
    let acc = lnMap.get(ln);
    if (!acc) {
      acc = {
        sap: empty(),
        nomina: empty(),
        millores: empty(),
        payroll: empty(),
        centres: 0,
      };
      lnMap.set(ln, acc);
    }
    acc.sap = add(acc.sap, f.sap);
    acc.nomina = add(acc.nomina, f.nomina);
    acc.millores = add(acc.millores, f.millores);
    acc.payroll = add(acc.payroll, f.payroll);
    acc.centres++;
  }

  const perLn: FilComparativaPersonalLn[] = [...lnMap.entries()]
    .map(([liniaCodi, acc]) => {
      const sap = roundImp(acc.sap);
      const nomina = roundImp(acc.nomina);
      const millores = roundImp(acc.millores);
      const payroll = roundImp(acc.payroll);
      return {
        liniaCodi,
        sap,
        nomina,
        millores,
        payroll,
        deltaPayrollSap: deltaImp(payroll, sap),
        centres: acc.centres,
      };
    })
    .sort((a, b) => {
      const da = Math.max(Math.abs(a.deltaPayrollSap.sous), Math.abs(a.deltaPayrollSap.ss));
      const db_ = Math.max(Math.abs(b.deltaPayrollSap.sous), Math.abs(b.deltaPayrollSap.ss));
      if (Math.abs(da - db_) > 0.5) return db_ - da;
      return a.liniaCodi.localeCompare(b.liniaCodi, "ca", { numeric: true });
    });

  const totSapR = roundImp(totSap);
  const totPayrollR = roundImp(totPayroll);

  return {
    any,
    mes,
    periodNom: `${MESOS_LLARGS[mes - 1]} ${any}`,
    files,
    perLn,
    totals: {
      sap: totSapR,
      nomina: roundImp(totNomina),
      millores: roundImp(totMillores),
      payroll: totPayrollR,
      deltaPayrollSap: deltaImp(totPayrollR, totSapR),
    },
    resum: {
      centresAmbPayroll,
      centresNomesSap,
      centresAmbDiferencia,
    },
  };
}
