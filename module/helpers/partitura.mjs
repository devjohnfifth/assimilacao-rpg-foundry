/**
 * Peças de interface compartilhadas pelas fichas de Ameaça e Conflito e pela janela da Partitura.
 */
export const MAX_CASAS = 30;

const GLIFOS = { q: "■", l: "◆", p: "⬟" };

/** "2■ + 1◆ (+1⬟)" */
export function poolTexto(pool, extra = 0) {
  const base = ["q", "l", "p"].filter(k => pool[k]).map(k => `${pool[k]}${GLIFOS[k]}`).join(" + ") || "—";
  return extra ? `${base} (+${extra}⬟)` : base;
}

/** Casas de custo de uma Ativação, na ordem A, B, C. */
export function casasDe(custo, progresso) {
  const S = CONFIG.ASSIMILACAO.SIMBOLOS;
  const lista = [];
  for ( const s of ["A", "B", "C"] ) {
    const n = Math.min(custo[s], MAX_CASAS);
    for ( let i = 1; i <= n; i++ ) lista.push({ s, i, cheia: i <= progresso[s], icone: S[s].icone });
  }
  return lista;
}

/** Casas de A (Objetivos e Neutralização). */
export function casasA(total, cheias) {
  const icone = CONFIG.ASSIMILACAO.SIMBOLOS.A.icone;
  return Array.from({ length: Math.min(total, MAX_CASAS) }, (_, k) => ({ i: k + 1, cheia: k + 1 <= cheias, icone }));
}

export const percentual = (v, max) => (max > 0 ? Math.round(100 * Math.min(v, max) / max) : 0);

/** Ativações de um dono (Conflito ou Ameaça) prontas para o template. */
export async function prepararAtivacoes(dono) {
  const lista = [];
  const itens = dono.items.contents.filter(i => i.type === "ativacao").sort((a, b) => a.sort - b.sort);
  for ( const item of itens ) {
    const st = item.system;
    lista.push({
      id: item.id, name: item.name, system: st,
      casas: casasDe(st.custo, st.progresso),
      completa: st.completa, esgotada: st.esgotada,
      efeito: await foundry.applications.ux.TextEditor.implementation.enrichHTML(st.descricao ?? "", {
        secrets: dono.isOwner, relativeTo: item
      }),
      semCusto: st.totalCusto === 0
    });
  }
  return lista;
}

/**
 * Regras de montagem (p. 208; seção 10.5): ao menos uma Ativação só de C e uma só de A,
 * e dados no pool.
 */
export function avisosMontagem(ativacoes, sys) {
  const loc = k => game.i18n.localize(k);
  const soDe = s => ativacoes.some(a => a.system.custo[s] > 0
    && ["A", "B", "C"].filter(o => o !== s).every(o => a.system.custo[o] === 0));
  const avisos = [];
  if ( !soDe("C") ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSoC"));
  if ( !soDe("A") ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSoA"));
  if ( !sys.totalDados ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSemDados"));
  return avisos;
}

/** Saldo a investir como lista para o template. */
export function saldoLista(saldo) {
  const S = CONFIG.ASSIMILACAO.SIMBOLOS;
  return ["A", "B", "C"].map(s => ({ s, n: saldo[s], icone: S[s].icone, rotulo: game.i18n.localize(S[s].rotulo) }));
}
