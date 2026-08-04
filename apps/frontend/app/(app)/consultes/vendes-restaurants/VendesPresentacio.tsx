"use client";

import { formatNum } from "@/lib/utils";
import type {
  ArticleRank,
  BlocRanking,
  ComparativaVendes,
  DiaVenda,
  InformeVendesRestaurant,
  MesEvolucio,
  MixCategoria,
  MovimentRank,
  NivellRankingVendes,
  RankingsCategoria,
} from "@/lib/vendes-restaurants/consultes";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { VendesCalendari } from "./VendesCalendari";
import styles from "./VendesPresentacio.module.css";

export type DetallVendes =
  | ""
  | "restaurants"
  | "evolucio"
  | "calendari"
  | "mix-prod"
  | "prod-menjar-base"
  | "prod-menjar-unitats"
  | "prod-beguda-base"
  | "prod-beguda-unitats"
  | "prod-tots-base"
  | "prod-tots-unitats"
  | "fam-menjar-base"
  | "fam-menjar-unitats"
  | "fam-beguda-base"
  | "fam-beguda-unitats"
  | "fam-tots-base"
  | "fam-tots-unitats"
  | "subfam-menjar-base"
  | "subfam-menjar-unitats"
  | "subfam-beguda-base"
  | "subfam-beguda-unitats"
  | "subfam-tots-base"
  | "subfam-tots-unitats"
  | "menus-base"
  | "menus-unitats";

const DETALL_PREFIX: Record<NivellRankingVendes, "prod" | "fam" | "subfam"> = {
  articles: "prod",
  families: "fam",
  subfamilies: "subfam",
};

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "–";
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatNum(v, digits)}%`;
}

function varClass(v: number | null): string {
  if (v == null || v === 0) return "";
  return v > 0 ? styles.up : styles.down;
}

function buildUrl(opts: {
  any: number;
  mes: number;
  vista: "comparativa" | "restaurant";
  centreId?: string | null;
  detall?: string;
}) {
  const params = new URLSearchParams();
  params.set("any", String(opts.any));
  params.set("mes", String(opts.mes));
  if (opts.vista === "restaurant") {
    params.set("vista", "restaurant");
    if (opts.centreId) params.set("centre", opts.centreId);
  }
  if (opts.detall) params.set("detall", opts.detall);
  return `/consultes/vendes-restaurants?${params}`;
}

function Tile({
  label,
  value,
  hint,
  accent,
  featured,
  spark,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "warn" | "up" | "down";
  featured?: boolean;
  spark?: number[];
  onClick?: () => void;
}) {
  const maxSpark = spark?.length ? Math.max(...spark, 1) : 1;
  const deltaAccent = accent === "up" || accent === "down" ? accent : undefined;
  const sparkCounts = new Map<number, number>();
  const body = (
    <>
      <div className={styles.tileTop}>
        <span className={styles.tileLabel}>{label}</span>
        {onClick ? <ChevronRight className={styles.tileChevron} size={16} aria-hidden /> : null}
      </div>
      <span className={styles.tileValue}>{value}</span>
      {hint ? (
        <span
          className={styles.tileHint}
          data-var={deltaAccent}
          data-badge={deltaAccent || undefined}
        >
          {hint}
        </span>
      ) : null}
      {spark && spark.length > 0 ? (
        <div className={styles.tileSpark} aria-hidden>
          {spark.map((v) => {
            const seen = sparkCounts.get(v) ?? 0;
            sparkCounts.set(v, seen + 1);
            return (
              <span
                key={`${v}-${seen}`}
                className={styles.tileSparkBar}
                style={{ height: `${Math.max(12, (v / maxSpark) * 100)}%` }}
              />
            );
          })}
        </div>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={styles.tile}
        data-accent={accent}
        data-featured={featured || undefined}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={styles.tile} data-accent={accent} data-featured={featured || undefined}>
      {body}
    </div>
  );
}

function BackBar({
  titol,
  onBack,
}: {
  titol: string;
  onBack: () => void;
}) {
  return (
    <div className={styles.backBar}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={16} />
        Quadre de comandament
      </button>
      <h2 className={styles.backTitle}>{titol}</h2>
    </div>
  );
}

function EvolucioMensual({
  mesos,
  titol = "Evolució mensual",
}: {
  mesos: MesEvolucio[];
  titol?: string;
}) {
  if (!mesos.length) return null;
  const max = Math.max(...mesos.map((m) => m.base), 1);
  const total = mesos.reduce((s, m) => s + m.base, 0);

  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{titol}</h3>
        <p className={styles.panelLead}>
          Vendes Base per mes
          {total > 0 ? ` · acumulat ${formatNum(total)} €` : ""}.
        </p>
      </header>
      <div className={styles.evoWrap}>
        {mesos.map((m) => (
          <div
            key={m.mes}
            className={styles.evoCol}
            data-empty={!m.teDades || undefined}
            title={
              m.teDades
                ? `${m.etiqueta}: ${formatNum(m.base)} € · ${formatNum(m.unitats, 0)} ud`
                : `${m.etiqueta}: sense dades`
            }
          >
            <div className={styles.evoBarTrack}>
              <div
                className={styles.evoBar}
                style={{ height: m.teDades ? `${(m.base / max) * 100}%` : "0%" }}
              />
            </div>
            <span className={styles.evoLabel}>{m.etiqueta}</span>
            <span className={styles.evoVal}>
              {m.teDades ? `${formatNum(m.base / 1000, 0)}k` : "–"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniEvo({ mesos }: { mesos: MesEvolucio[] }) {
  if (!mesos.length) return null;
  const max = Math.max(...mesos.map((m) => m.base), 1);
  return (
    <div className={styles.miniEvo}>
      {mesos.map((m) => (
        <div key={m.mes} className={styles.miniEvoCol} data-empty={!m.teDades || undefined}>
          <div className={styles.miniEvoTrack}>
            <div
              className={styles.miniEvoBar}
              style={{ height: m.teDades ? `${(m.base / max) * 100}%` : "0%" }}
            />
          </div>
          <span>{m.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function MiniDies({ dies }: { dies: DiaVenda[] }) {
  if (!dies.length) return null;
  const max = Math.max(...dies.map((d) => d.base), 1);
  return (
    <div className={styles.miniDies}>
      {dies.map((d) => (
        <div key={d.dia} className={styles.miniDie} title={`${d.dia}: ${formatNum(d.base)} €`}>
          <div className={styles.miniDieTrack}>
            <div className={styles.miniDieBar} style={{ height: `${(d.base / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MixVisual({ mix }: { mix: MixCategoria }) {
  const m = mix.menjar.pctBase ?? 0;
  const b = mix.beguda.pctBase ?? 0;
  return (
    <div className={styles.mixVisual}>
      <div className={styles.mixStack}>
        <div className={styles.mixStackMenjar} style={{ width: `${m}%` }} />
        <div className={styles.mixStackBeguda} style={{ width: `${b}%` }} />
      </div>
      <div className={styles.mixLegend}>
        <div className={styles.mixLegCard} data-tone="menjar">
          <span className={styles.mixLegLabel}>
            <i /> Menjar
          </span>
          <strong className={styles.mixLegPct}>{formatNum(m, 0)}%</strong>
          <em className={styles.mixLegEuro}>{formatNum(mix.menjar.base)} €</em>
        </div>
        <div className={styles.mixLegCard} data-tone="beguda">
          <span className={styles.mixLegLabel}>
            <i /> Beguda
          </span>
          <strong className={styles.mixLegPct}>{formatNum(b, 0)}%</strong>
          <em className={styles.mixLegEuro}>{formatNum(mix.beguda.base)} €</em>
        </div>
      </div>
    </div>
  );
}

function RankRow({
  r,
  criteri,
  vsLabel,
}: {
  r: ArticleRank;
  criteri: "base" | "unitats";
  vsLabel: string;
}) {
  const delta =
    r.deltaPos == null
      ? null
      : r.deltaPos > 0
        ? `▲ +${r.deltaPos}`
        : r.deltaPos < 0
          ? `▼ ${r.deltaPos}`
          : "·";

  return (
    <li className={styles.rankRow}>
      <span className={styles.rankPos}>#{r.pos}</span>
      <div className={styles.rankBody}>
        <div className={styles.rankTitle}>{r.article}</div>
        <div className={styles.rankMeta}>
          <span>{formatNum(r.base)} €</span>
          <span>·</span>
          <span>{formatNum(r.unitats, 0)} ud</span>
          {r.pctMix != null && (
            <>
              <span>·</span>
              <span>{formatNum(r.pctMix, 1)}% mix</span>
            </>
          )}
        </div>
        <div className={styles.rankMove}>
          {delta && <span className={varClass(r.deltaPos)}>{delta} pos.</span>}
          {r.variacioPct != null && (
            <span className={varClass(r.variacioPct)}>
              {fmtPct(r.variacioPct)} {vsLabel}
            </span>
          )}
        </div>
      </div>
      <div className={styles.rankValue}>
        {criteri === "base" ? `${formatNum(r.base)} €` : `${formatNum(r.unitats, 0)} ud`}
      </div>
    </li>
  );
}

function MovRow({ m }: { m: MovimentRank }) {
  const label =
    m.tipus === "entrada"
      ? "Entra al top"
      : m.tipus === "sortida"
        ? "Surt del top"
        : m.tipus === "pujada"
          ? `▲ +${m.deltaPos} pos.`
          : `▼ ${m.deltaPos} pos.`;

  return (
    <li className={styles.movRow}>
      <span className={styles.movLabel} data-tipus={m.tipus}>
        {label}
      </span>
      <span className={styles.movArticle}>{m.article}</span>
      <span className={styles.movPos}>
        {m.posAnt != null ? `#${m.posAnt} → ` : ""}#{m.pos > 100 ? "–" : m.pos}
      </span>
    </li>
  );
}

function RankingPanel({
  title,
  lead,
  bloc,
  vsLabel,
}: {
  title: string;
  lead: string;
  bloc: BlocRanking;
  vsLabel: string;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        <p className={styles.panelLead}>{lead}</p>
      </header>
      <div className={styles.rankGrid}>
        <div>
          <h4 className={styles.listTitle}>Top 10 més venuts</h4>
          {bloc.top10.length === 0 ? (
            <p className={styles.emptyMini}>Sense dades</p>
          ) : (
            <ol className={styles.rankList}>
              {bloc.top10.map((r) => (
                <RankRow key={r.article} r={r} criteri={bloc.criteri} vsLabel={vsLabel} />
              ))}
            </ol>
          )}
        </div>
        <div>
          <h4 className={styles.listTitle}>Top 5 menys venuts</h4>
          {bloc.bottom5.length === 0 ? (
            <p className={styles.emptyMini}>Sense dades</p>
          ) : (
            <ol className={styles.rankList}>
              {bloc.bottom5.map((r) => (
                <RankRow key={r.article} r={r} criteri={bloc.criteri} vsLabel={vsLabel} />
              ))}
            </ol>
          )}
        </div>
      </div>
      <div className={styles.movGrid}>
        <div>
          <h4 className={styles.listTitle}>Pujades de rànquing</h4>
          {bloc.pujades.length === 0 ? (
            <p className={styles.emptyMini}>Sense moviments destacats</p>
          ) : (
            <ul className={styles.movList}>
              {bloc.pujades.map((m) => (
                <MovRow key={`${m.tipus}-${m.article}`} m={m} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className={styles.listTitle}>Baixades de rànquing</h4>
          {bloc.baixades.length === 0 ? (
            <p className={styles.emptyMini}>Sense moviments destacats</p>
          ) : (
            <ul className={styles.movList}>
              {bloc.baixades.map((m) => (
                <MovRow key={`${m.tipus}-${m.article}`} m={m} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function rankMove(deltaPos: number | null): {
  label: string;
  dir: "up" | "down" | "same" | "new";
} {
  if (deltaPos == null) return { label: "nou", dir: "new" };
  if (deltaPos > 0) return { label: `▲ ${deltaPos}`, dir: "up" };
  if (deltaPos < 0) return { label: `▼ ${Math.abs(deltaPos)}`, dir: "down" };
  return { label: "=", dir: "same" };
}

function TopPreview({
  titol,
  rows,
  criteri,
  tone,
  limit = 10,
  onClick,
}: {
  titol: string;
  rows: ArticleRank[];
  criteri: "base" | "unitats";
  tone: "menjar" | "beguda" | "menus" | "productes";
  limit?: number;
  onClick: () => void;
}) {
  const top = rows.slice(0, limit);
  return (
    <button type="button" className={styles.previewCard} data-tone={tone} onClick={onClick}>
      <div className={styles.previewHead}>
        <span className={styles.previewTitle}>{titol}</span>
        <ChevronRight size={14} aria-hidden />
      </div>
      {top.length === 0 ? (
        <p className={styles.emptyMini}>Sense dades</p>
      ) : (
        <ol className={styles.previewList}>
          {top.map((r, i) => {
            const move = rankMove(r.deltaPos);
            return (
              <li key={r.article}>
                <span className={styles.previewPos} data-podium={i < 3 ? i + 1 : undefined}>
                  {i + 1}
                </span>
                <span className={styles.previewArt} title={r.article}>
                  {r.article}
                </span>
                <span className={styles.previewVal}>
                  {criteri === "base" ? `${formatNum(r.base)} €` : `${formatNum(r.unitats, 0)} ud`}
                </span>
                <span className={styles.previewMove} data-dir={move.dir} title="Canvi de posició">
                  {move.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </button>
  );
}

function blocPrincipal(data: RankingsCategoria): {
  teCat: boolean;
  base: BlocRanking;
  unitats: BlocRanking;
} {
  const teCat = data.mix.menjar.base > 0 || data.mix.beguda.base > 0;
  if (teCat) {
    return { teCat: true, base: data.menjar.base, unitats: data.menjar.unitats };
  }
  return { teCat: false, base: data.tots.base, unitats: data.tots.unitats };
}

function RankNivellToggle({
  value,
  teFamilies,
  teSubfamilies,
  onChange,
}: {
  value: NivellRankingVendes;
  teFamilies: boolean;
  teSubfamilies: boolean;
  onChange: (v: NivellRankingVendes) => void;
}) {
  if (!teFamilies && !teSubfamilies) return null;
  const opts: { id: NivellRankingVendes; label: string; show: boolean }[] = [
    { id: "articles", label: "Articles", show: true },
    { id: "families", label: "Famílies", show: teFamilies },
    { id: "subfamilies", label: "Subfamílies", show: teSubfamilies },
  ];
  return (
    <fieldset className={styles.rankToggle}>
      <legend className={styles.srOnly}>Nivell de rànquing</legend>
      {opts
        .filter((o) => o.show)
        .map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.rankToggleBtn}
            data-active={value === o.id || undefined}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
    </fieldset>
  );
}

function RestaurantsDetall({
  data,
  vsLabel,
  onCentre,
}: {
  data: ComparativaVendes;
  vsLabel: string;
  onCentre: (id: string) => void;
}) {
  const maxBase = Math.max(...data.files.map((f) => f.base), 1);
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Per restaurant</h3>
        <p className={styles.panelLead}>
          Clica un restaurant per obrir el seu quadre. Verd = puja {vsLabel}.
        </p>
      </header>
      <div className={styles.restList}>
        {data.files.map((f) => (
          <button
            key={f.centre.id}
            type="button"
            className={styles.restRowBtn}
            data-empty={!f.teDades || undefined}
            disabled={!f.teDades}
            onClick={() => onCentre(f.centre.id)}
          >
            <div className={styles.restName}>{f.centre.etiqueta}</div>
            <div className={styles.restBarTrack}>
              <div
                className={styles.restBar}
                style={{ width: f.teDades ? `${(f.base / maxBase) * 100}%` : "0%" }}
              />
            </div>
            <div className={styles.restNums}>
              <strong>{f.teDades ? `${formatNum(f.base)} €` : "Sense dades"}</strong>
              <span className={varClass(f.variacioPct)}>{fmtPct(f.variacioPct)}</span>
              <span className={styles.restPl}>
                {f.desviacioPl == null
                  ? "vs P&L –"
                  : `vs P&L ${f.desviacioPl >= 0 ? "+" : ""}${formatNum(f.desviacioPl)} €`}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function VendesComparativaPresentacio({
  data,
  detall,
  any,
  mes,
}: {
  data: ComparativaVendes;
  detall: DetallVendes;
  any: number;
  mes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nivell, setNivell] = useState<NivellRankingVendes>("articles");
  const vsLabel = data.ambit === "any" ? "vs any ant." : "vs mes ant.";

  const rankingSrc =
    nivell === "families"
      ? data.families
      : nivell === "subfamilies"
        ? data.subfamilies
        : data.productes;
  const teCatRank = rankingSrc.mix.menjar.base > 0 || rankingSrc.mix.beguda.base > 0;
  const rankMain = blocPrincipal(rankingSrc);
  const prefix = DETALL_PREFIX[nivell];
  const entityLabel =
    nivell === "families" ? "famílies" : nivell === "subfamilies" ? "subfamílies" : "articles";
  const totLabel =
    nivell === "families" ? "Famílies" : nivell === "subfamilies" ? "Subfamílies" : "Productes";

  const vsPl =
    data.totals.desviacioPl == null
      ? "–"
      : Math.abs(data.totals.desviacioPl) < 1
        ? "OK"
        : `${data.totals.desviacioPl >= 0 ? "+" : ""}${formatNum(data.totals.desviacioPl)} €`;

  const go = (next: {
    vista?: "comparativa" | "restaurant";
    centreId?: string;
    detall?: string;
  }) => {
    startTransition(() => {
      router.push(
        buildUrl({
          any,
          mes,
          vista: next.vista ?? "comparativa",
          centreId: next.centreId,
          detall: next.detall,
        })
      );
    });
  };

  if (detall === "evolucio" || detall === "calendari") {
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar
          titol={data.ambit === "any" ? "Evolució mensual · LN" : "Calendari diari · LN"}
          onBack={() => go({})}
        />
        {data.ambit === "any" ? (
          <EvolucioMensual mesos={data.evolucioMesos} titol="Evolució mensual · LN" />
        ) : (
          <section className={styles.panel}>
            <VendesCalendari dies={data.dies} />
          </section>
        )}
      </div>
    );
  }

  if (detall === "restaurants") {
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar titol="Restaurants · LN" onBack={() => go({})} />
        <RestaurantsDetall
          data={data}
          vsLabel={vsLabel}
          onCentre={(id) => go({ vista: "restaurant", centreId: id })}
        />
      </div>
    );
  }

  if (detall === "mix-prod") {
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar titol="Mix menjar / beguda · LN" onBack={() => go({})} />
        <section className={styles.panel}>
          <MixVisual mix={data.productes.mix} />
        </section>
      </div>
    );
  }

  const rankingDetall: Record<string, { title: string; lead: string; bloc: BlocRanking }> = {
    "prod-menjar-base": {
      title: "LN · Menjar · articles · €",
      lead: "Articles de menjar a tota la línia.",
      bloc: data.productes.menjar.base,
    },
    "prod-menjar-unitats": {
      title: "LN · Menjar · articles · ud",
      lead: "Volum de menjar a tota la línia.",
      bloc: data.productes.menjar.unitats,
    },
    "prod-beguda-base": {
      title: "LN · Beguda · articles · €",
      lead: "Begudes a tota la línia.",
      bloc: data.productes.beguda.base,
    },
    "prod-beguda-unitats": {
      title: "LN · Beguda · articles · ud",
      lead: "Volum de begudes a tota la línia.",
      bloc: data.productes.beguda.unitats,
    },
    "prod-tots-base": {
      title: "LN · Productes · €",
      lead: "Rànquing global d'articles a la línia.",
      bloc: data.productes.tots.base,
    },
    "prod-tots-unitats": {
      title: "LN · Productes · ud",
      lead: "Rànquing global per volum a la línia.",
      bloc: data.productes.tots.unitats,
    },
    "fam-menjar-base": {
      title: "LN · Menjar · famílies · €",
      lead: "Famílies TPV de menjar a tota la línia.",
      bloc: data.families.menjar.base,
    },
    "fam-menjar-unitats": {
      title: "LN · Menjar · famílies · ud",
      lead: "Famílies TPV de menjar per volum.",
      bloc: data.families.menjar.unitats,
    },
    "fam-beguda-base": {
      title: "LN · Beguda · famílies · €",
      lead: "Famílies TPV de beguda a tota la línia.",
      bloc: data.families.beguda.base,
    },
    "fam-beguda-unitats": {
      title: "LN · Beguda · famílies · ud",
      lead: "Famílies TPV de beguda per volum.",
      bloc: data.families.beguda.unitats,
    },
    "fam-tots-base": {
      title: "LN · Famílies · €",
      lead: "Rànquing de famílies a tota la línia.",
      bloc: data.families.tots.base,
    },
    "fam-tots-unitats": {
      title: "LN · Famílies · ud",
      lead: "Rànquing de famílies per volum.",
      bloc: data.families.tots.unitats,
    },
    "subfam-menjar-base": {
      title: "LN · Menjar · subfamílies · €",
      lead: "Subfamílies TPV de menjar a tota la línia.",
      bloc: data.subfamilies.menjar.base,
    },
    "subfam-menjar-unitats": {
      title: "LN · Menjar · subfamílies · ud",
      lead: "Subfamílies TPV de menjar per volum.",
      bloc: data.subfamilies.menjar.unitats,
    },
    "subfam-beguda-base": {
      title: "LN · Beguda · subfamílies · €",
      lead: "Subfamílies TPV de beguda a tota la línia.",
      bloc: data.subfamilies.beguda.base,
    },
    "subfam-beguda-unitats": {
      title: "LN · Beguda · subfamílies · ud",
      lead: "Subfamílies TPV de beguda per volum.",
      bloc: data.subfamilies.beguda.unitats,
    },
    "subfam-tots-base": {
      title: "LN · Subfamílies · €",
      lead: "Rànquing de subfamílies a tota la línia.",
      bloc: data.subfamilies.tots.base,
    },
    "subfam-tots-unitats": {
      title: "LN · Subfamílies · ud",
      lead: "Rànquing de subfamílies per volum.",
      bloc: data.subfamilies.tots.unitats,
    },
  };

  if (detall && rankingDetall[detall]) {
    const d = rankingDetall[detall];
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar titol={d.title} onBack={() => go({})} />
        <RankingPanel title={d.title} lead={d.lead} bloc={d.bloc} vsLabel={vsLabel} />
      </div>
    );
  }

  const maxRest = Math.max(...data.files.map((f) => f.base), 1);
  const topRest = [...data.files].filter((f) => f.teDades).sort((a, b) => b.base - a.base);

  return (
    <div className={styles.board} data-pending={pending ? "true" : undefined}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>LN Restaurants</h2>
          <p className={styles.heroPeriode}>
            {data.periode} · {data.centresAmbDades}/{data.centresTotals} restaurants
          </p>
        </div>
        <p className={styles.heroHint}>Clica per aprofundir · restaurant o rànquing</p>
      </header>

      <div className={styles.metricStrip}>
        <Tile
          label="Vendes LN"
          value={`${formatNum(data.totals.base)} €`}
          hint={`${fmtPct(data.totals.variacioPct)} ${vsLabel}`}
          featured
          accent={
            data.totals.variacioPct == null || data.totals.variacioPct === 0
              ? undefined
              : data.totals.variacioPct > 0
                ? "up"
                : "down"
          }
          onClick={() => go({ detall: data.ambit === "any" ? "evolucio" : "calendari" })}
        />
        <Tile
          label="Unitats"
          value={formatNum(data.totals.unitats, 0)}
          onClick={() => go({ detall: data.ambit === "any" ? "evolucio" : "calendari" })}
        />
        <Tile
          label={data.ambit === "any" ? "Mitjana mes" : "Mitjana dia"}
          value={
            data.ambit === "any"
              ? data.totals.mitjanaMensual != null
                ? `${formatNum(data.totals.mitjanaMensual)} €`
                : "–"
              : data.totals.mitjanaDiaria != null
                ? `${formatNum(data.totals.mitjanaDiaria)} €`
                : "–"
          }
          onClick={() => go({ detall: data.ambit === "any" ? "evolucio" : "calendari" })}
        />
        <Tile
          label="Vs P&L"
          value={vsPl}
          hint={data.totals.vendesPl ? `P&L ${formatNum(data.totals.vendesPl)} €` : undefined}
          accent={
            data.totals.desviacioPl != null && Math.abs(data.totals.desviacioPl) >= 1
              ? "warn"
              : undefined
          }
          onClick={() => go({ detall: "restaurants" })}
        />
      </div>

      <div className={styles.midGrid}>
        <button
          type="button"
          className={styles.panel}
          onClick={() => go({ detall: data.ambit === "any" ? "evolucio" : "calendari" })}
        >
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelKicker}>Tendència LN</p>
              <h3 className={styles.panelTitle}>
                {data.ambit === "any" ? "Evolució de l'any" : "Vendes dia a dia"}
              </h3>
            </div>
            <ChevronRight size={16} aria-hidden />
          </div>
          {data.ambit === "any" ? (
            <MiniEvo mesos={data.evolucioMesos} />
          ) : (
            <MiniDies dies={data.dies} />
          )}
        </button>

        <button
          type="button"
          className={styles.panel}
          onClick={() => go({ detall: "restaurants" })}
        >
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelKicker}>Aportació</p>
              <h3 className={styles.panelTitle}>Per restaurant</h3>
            </div>
            <ChevronRight size={16} aria-hidden />
          </div>
          <div className={styles.restBars}>
            {topRest.map((f) => (
              <div key={f.centre.id} className={styles.restBarRow}>
                <span className={styles.restBarName}>{f.centre.etiqueta}</span>
                <div className={styles.restBarTrackLg}>
                  <div
                    className={styles.restBarFill}
                    style={{ width: `${(f.base / maxRest) * 100}%` }}
                  />
                </div>
                <span className={styles.restBarVal}>{formatNum(f.base / 1000, 0)}k</span>
                <span className={varClass(f.variacioPct)}>{fmtPct(f.variacioPct, 0)}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      <section className={styles.rankSection}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionHeadLeft}>
            <h3 className={styles.sectionTitle}>El que més es ven · LN</h3>
            <p className={styles.sectionLead}>
              Top 5 {entityLabel} · verd puja / vermell baixa · clic → top 10
              {data.productes.mix.menjar.base > 0 || data.productes.mix.beguda.base > 0
                ? " · mix al detall"
                : ""}
            </p>
          </div>
          <div className={styles.sectionHeadActions}>
            {(data.productes.mix.menjar.base > 0 || data.productes.mix.beguda.base > 0) && (
              <button
                type="button"
                className={styles.mixChip}
                onClick={() => go({ detall: "mix-prod" })}
              >
                Mix {formatNum(data.productes.mix.menjar.pctBase ?? 0, 0)}/
                {formatNum(data.productes.mix.beguda.pctBase ?? 0, 0)}
              </button>
            )}
            <RankNivellToggle
              value={nivell}
              teFamilies={data.teFamilies}
              teSubfamilies={data.teSubfamilies}
              onChange={setNivell}
            />
          </div>
        </div>
        <div className={styles.rankGridBoard}>
          <TopPreview
            titol={teCatRank ? "Menjar · €" : `${totLabel} · €`}
            rows={rankMain.base.top10}
            criteri="base"
            tone={teCatRank ? "menjar" : "productes"}
            limit={5}
            onClick={() =>
              go({ detall: teCatRank ? `${prefix}-menjar-base` : `${prefix}-tots-base` })
            }
          />
          <TopPreview
            titol={teCatRank ? "Menjar · ud" : `${totLabel} · ud`}
            rows={rankMain.unitats.top10}
            criteri="unitats"
            tone={teCatRank ? "menjar" : "productes"}
            limit={5}
            onClick={() =>
              go({
                detall: teCatRank ? `${prefix}-menjar-unitats` : `${prefix}-tots-unitats`,
              })
            }
          />
          {teCatRank ? (
            <>
              <TopPreview
                titol="Beguda · €"
                rows={rankingSrc.beguda.base.top10}
                criteri="base"
                tone="beguda"
                limit={5}
                onClick={() => go({ detall: `${prefix}-beguda-base` })}
              />
              <TopPreview
                titol="Beguda · ud"
                rows={rankingSrc.beguda.unitats.top10}
                criteri="unitats"
                tone="beguda"
                limit={5}
                onClick={() => go({ detall: `${prefix}-beguda-unitats` })}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function VendesRestaurantPresentacio({
  data,
  detall,
  any,
  mes,
}: {
  data: InformeVendesRestaurant;
  detall: DetallVendes;
  any: number;
  mes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nivell, setNivell] = useState<NivellRankingVendes>("articles");
  const vsLabel = data.ambit === "any" ? "vs any ant." : "vs mes ant.";

  const rankingSrc =
    nivell === "families"
      ? data.families
      : nivell === "subfamilies"
        ? data.subfamilies
        : data.productes;
  const teCatRank = rankingSrc.mix.menjar.base > 0 || rankingSrc.mix.beguda.base > 0;
  const rankMain = blocPrincipal(rankingSrc);
  const prefix = DETALL_PREFIX[nivell];
  const entityLabel =
    nivell === "families" ? "famílies" : nivell === "subfamilies" ? "subfamílies" : "articles";
  const menusBase = data.packs.tots.base;
  const menusUd = data.packs.tots.unitats;

  const vsPl =
    data.desviacioPl == null
      ? "–"
      : Math.abs(data.desviacioPl) < 1
        ? "OK"
        : `${data.desviacioPl >= 0 ? "+" : ""}${formatNum(data.desviacioPl)} €`;

  const go = (detallNext?: string) => {
    startTransition(() => {
      router.push(
        buildUrl({
          any,
          mes,
          vista: "restaurant",
          centreId: data.centre.id,
          detall: detallNext,
        })
      );
    });
  };

  const back = () => go();

  if (detall === "calendari" || detall === "evolucio") {
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar
          titol={data.ambit === "any" ? "Evolució mensual" : "Calendari diari"}
          onBack={back}
        />
        {data.ambit === "any" ? (
          <EvolucioMensual mesos={data.evolucioMesos} />
        ) : (
          <section className={styles.panel}>
            <VendesCalendari dies={data.dies} />
          </section>
        )}
      </div>
    );
  }

  if (detall === "mix-prod") {
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar titol="Mix menjar / beguda" onBack={back} />
        <section className={styles.panel}>
          <MixVisual mix={data.productes.mix} />
        </section>
      </div>
    );
  }

  const rankingDetall: Record<string, { title: string; lead: string; bloc: BlocRanking }> = {
    "prod-menjar-base": {
      title: "Menjar · articles · €",
      lead: "Top i moviments dels articles de menjar.",
      bloc: data.productes.menjar.base,
    },
    "prod-menjar-unitats": {
      title: "Menjar · articles · ud",
      lead: "Volum de menjar.",
      bloc: data.productes.menjar.unitats,
    },
    "prod-beguda-base": {
      title: "Beguda · articles · €",
      lead: "Top i moviments de begudes.",
      bloc: data.productes.beguda.base,
    },
    "prod-beguda-unitats": {
      title: "Beguda · articles · ud",
      lead: "Volum de begudes.",
      bloc: data.productes.beguda.unitats,
    },
    "prod-tots-base": {
      title: "Productes · €",
      lead: "Rànquing global d'articles.",
      bloc: data.productes.tots.base,
    },
    "prod-tots-unitats": {
      title: "Productes · ud",
      lead: "Rànquing global per volum.",
      bloc: data.productes.tots.unitats,
    },
    "fam-menjar-base": {
      title: "Menjar · famílies · €",
      lead: "Vendes agregades per família TPV (menjar).",
      bloc: data.families.menjar.base,
    },
    "fam-menjar-unitats": {
      title: "Menjar · famílies · ud",
      lead: "Unitats agregades per família TPV (menjar).",
      bloc: data.families.menjar.unitats,
    },
    "fam-beguda-base": {
      title: "Beguda · famílies · €",
      lead: "Vendes agregades per família TPV (beguda).",
      bloc: data.families.beguda.base,
    },
    "fam-beguda-unitats": {
      title: "Beguda · famílies · ud",
      lead: "Unitats agregades per família TPV (beguda).",
      bloc: data.families.beguda.unitats,
    },
    "fam-tots-base": {
      title: "Famílies · €",
      lead: "Rànquing global de famílies TPV.",
      bloc: data.families.tots.base,
    },
    "fam-tots-unitats": {
      title: "Famílies · ud",
      lead: "Rànquing global de famílies per volum.",
      bloc: data.families.tots.unitats,
    },
    "subfam-menjar-base": {
      title: "Menjar · subfamílies · €",
      lead: "Vendes agregades per subfamília TPV (menjar).",
      bloc: data.subfamilies.menjar.base,
    },
    "subfam-menjar-unitats": {
      title: "Menjar · subfamílies · ud",
      lead: "Unitats agregades per subfamília TPV (menjar).",
      bloc: data.subfamilies.menjar.unitats,
    },
    "subfam-beguda-base": {
      title: "Beguda · subfamílies · €",
      lead: "Vendes agregades per subfamília TPV (beguda).",
      bloc: data.subfamilies.beguda.base,
    },
    "subfam-beguda-unitats": {
      title: "Beguda · subfamílies · ud",
      lead: "Unitats agregades per subfamília TPV (beguda).",
      bloc: data.subfamilies.beguda.unitats,
    },
    "subfam-tots-base": {
      title: "Subfamílies · €",
      lead: "Rànquing global de subfamílies TPV.",
      bloc: data.subfamilies.tots.base,
    },
    "subfam-tots-unitats": {
      title: "Subfamílies · ud",
      lead: "Rànquing global de subfamílies per volum.",
      bloc: data.subfamilies.tots.unitats,
    },
    "menus-base": {
      title: "Menús · per €",
      lead: "Subfamília menús del fitxer Pack.",
      bloc: menusBase,
    },
    "menus-unitats": {
      title: "Menús · per unitats",
      lead: "Volum dels menús (Pack).",
      bloc: menusUd,
    },
  };

  if (detall && rankingDetall[detall]) {
    const d = rankingDetall[detall];
    return (
      <div className={styles.wrap} data-pending={pending ? "true" : undefined}>
        <BackBar titol={d.title} onBack={back} />
        <RankingPanel title={d.title} lead={d.lead} bloc={d.bloc} vsLabel={vsLabel} />
      </div>
    );
  }

  const totLabel =
    nivell === "families" ? "Famílies" : nivell === "subfamilies" ? "Subfamílies" : "Productes";

  return (
    <div className={styles.board} data-pending={pending ? "true" : undefined}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>{data.centre.etiqueta}</h2>
          <p className={styles.heroPeriode}>{data.periode}</p>
        </div>
        <p className={styles.heroHint}>Clica qualsevol bloc per aprofundir</p>
      </header>

      <div className={styles.metricStrip}>
        <Tile
          label="Vendes"
          value={`${formatNum(data.base)} €`}
          hint={`${fmtPct(data.variacioPct)} ${vsLabel}`}
          featured
          accent={
            data.variacioPct == null || data.variacioPct === 0
              ? undefined
              : data.variacioPct > 0
                ? "up"
                : "down"
          }
          onClick={() => go(data.ambit === "any" ? "evolucio" : "calendari")}
        />
        <Tile
          label="Unitats"
          value={formatNum(data.unitats, 0)}
          onClick={() => go(data.ambit === "any" ? "evolucio" : "calendari")}
        />
        <Tile
          label={data.ambit === "any" ? "Mitjana mes" : "Mitjana dia"}
          value={
            data.ambit === "any"
              ? data.mitjanaMensual != null
                ? `${formatNum(data.mitjanaMensual)} €`
                : "–"
              : data.mitjanaDiaria != null
                ? `${formatNum(data.mitjanaDiaria)} €`
                : "–"
          }
          onClick={() => go(data.ambit === "any" ? "evolucio" : "calendari")}
        />
        <Tile
          label="Vs P&L"
          value={vsPl}
          hint={data.vendesPl ? `P&L ${formatNum(data.vendesPl)} €` : undefined}
          accent={data.desviacioPl != null && Math.abs(data.desviacioPl) >= 1 ? "warn" : undefined}
          onClick={() => go(data.ambit === "any" ? "evolucio" : "calendari")}
        />
      </div>

      <div className={styles.midGrid}>
        <button
          type="button"
          className={styles.panel}
          onClick={() => go(data.ambit === "any" ? "evolucio" : "calendari")}
        >
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelKicker}>Tendència</p>
              <h3 className={styles.panelTitle}>
                {data.ambit === "any" ? "Evolució de l'any" : "Vendes dia a dia"}
              </h3>
            </div>
            <ChevronRight size={16} aria-hidden />
          </div>
          {data.ambit === "any" ? (
            <MiniEvo mesos={data.evolucioMesos} />
          ) : (
            <MiniDies dies={data.dies} />
          )}
        </button>

        {data.productes.mix.menjar.base > 0 || data.productes.mix.beguda.base > 0 ? (
          <button type="button" className={styles.panel} onClick={() => go("mix-prod")}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.panelKicker}>Mix comercial</p>
                <h3 className={styles.panelTitle}>Menjar vs beguda</h3>
              </div>
              <ChevronRight size={16} aria-hidden />
            </div>
            <MixVisual mix={data.productes.mix} />
          </button>
        ) : (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.panelKicker}>Mix comercial</p>
                <h3 className={styles.panelTitle}>Menjar vs beguda</h3>
              </div>
            </div>
            <p className={styles.emptyMini}>Sense taxonomia al Detall</p>
          </div>
        )}
      </div>

      <section className={styles.rankSection}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionHeadLeft}>
            <h3 className={styles.sectionTitle}>El que més es ven</h3>
            <p className={styles.sectionLead}>
              Top 5 {entityLabel} · verd puja / vermell baixa · clic → top 10
            </p>
          </div>
          <RankNivellToggle
            value={nivell}
            teFamilies={data.teFamilies}
            teSubfamilies={data.teSubfamilies}
            onChange={setNivell}
          />
        </div>
        <div className={styles.rankGridBoard}>
          <TopPreview
            titol={teCatRank ? "Menjar · €" : `${totLabel} · €`}
            rows={rankMain.base.top10}
            criteri="base"
            tone={teCatRank ? "menjar" : "productes"}
            limit={5}
            onClick={() => go(teCatRank ? `${prefix}-menjar-base` : `${prefix}-tots-base`)}
          />
          <TopPreview
            titol={teCatRank ? "Menjar · ud" : `${totLabel} · ud`}
            rows={rankMain.unitats.top10}
            criteri="unitats"
            tone={teCatRank ? "menjar" : "productes"}
            limit={5}
            onClick={() => go(teCatRank ? `${prefix}-menjar-unitats` : `${prefix}-tots-unitats`)}
          />
          {teCatRank ? (
            <>
              <TopPreview
                titol="Beguda · €"
                rows={rankingSrc.beguda.base.top10}
                criteri="base"
                tone="beguda"
                limit={5}
                onClick={() => go(`${prefix}-beguda-base`)}
              />
              <TopPreview
                titol="Beguda · ud"
                rows={rankingSrc.beguda.unitats.top10}
                criteri="unitats"
                tone="beguda"
                limit={5}
                onClick={() => go(`${prefix}-beguda-unitats`)}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
