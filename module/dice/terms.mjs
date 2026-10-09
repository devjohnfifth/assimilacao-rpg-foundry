import { FACES, SIMBOLOS } from "../config.mjs";

/**
 * Conta os símbolos de uma face.
 * @param {string} denom  "q" | "l" | "p"
 * @param {number} face
 * @returns {{A:number,B:number,C:number}}
 */
export function simbolosDaFace(denom, face) {
  const s = FACES[denom]?.[face] ?? "";
  return {
    A: [...s].filter(c => c === "A").length,
    B: [...s].filter(c => c === "B").length,
    C: [...s].filter(c => c === "C").length
  };
}

/** HTML dos ícones de uma face (usado no tooltip do Foundry e nos cards). */
export function htmlDaFace(denom, face) {
  const s = FACES[denom]?.[face] ?? "";
  if ( !s ) return `<span class="asm-face vazia" aria-label="${game.i18n.localize("ASSIMILACAO.Simbolo.vazio")}">–</span>`;
  return `<span class="asm-face">${[...s].map(c => {
    const rot = game.i18n.localize(SIMBOLOS[c].rotulo);
    return `<img class="asm-sym asm-sym-${c}" src="${SIMBOLOS[c].icone}" alt="${c}" data-tooltip="${rot}">`;
  }).join("")}</span>`;
}

/**
 * Dado de símbolos do Assimilação. Rola numericamente (compatível com o Foundry)
 * e traduz a face para A (Sucesso), B (Adaptação) e C (Pressão).
 * Sem modificador, o total do termo é o número de A. Modificadores:
 *  - sim: conta todos os símbolos (dano, tabelas 6×6, encontros)
 *  - sa / sb / sc: conta só A, só B ou só C
 */
export class DadoSimbolo extends foundry.dice.terms.DiceTerm {
  constructor(termData = {}) {
    termData.faces = CONFIG.ASSIMILACAO.DADOS[new.target.DENOMINATION]?.faces ?? termData.faces;
    super(termData);
  }

  static DENOMINATION = "";

  static MODIFIERS = {
    sim: "contarSimbolos",
    sa: "contarA",
    sb: "contarB",
    sc: "contarC"
  };

  /** @override */
  async roll(options = {}) {
    const r = await super.roll(options);
    r.count = this.simbolos(r).A;
    return r;
  }

  /** Símbolos de um resultado. */
  simbolos(result) {
    return simbolosDaFace(this.constructor.DENOMINATION, result.result);
  }

  contarSimbolos() {
    for ( const r of this.results ) {
      const s = this.simbolos(r);
      r.count = s.A + s.B + s.C;
    }
  }

  contarA() { for ( const r of this.results ) r.count = this.simbolos(r).A; }
  contarB() { for ( const r of this.results ) r.count = this.simbolos(r).B; }
  contarC() { for ( const r of this.results ) r.count = this.simbolos(r).C; }

  /** @override */
  getResultLabel(result) {
    return htmlDaFace(this.constructor.DENOMINATION, result.result);
  }

  /** @override */
  getResultCSS(result) {
    return [
      "asm-dado",
      `asm-${this.constructor.DENOMINATION}`,
      result.discarded ? "discarded" : null,
      result.rerolled ? "rerolled" : null
    ];
  }
}

/** ■ d6 — Instinto. */
export class DadoInstinto extends DadoSimbolo {
  static DENOMINATION = "q";
}

/** ◆ d10 — Conhecimentos, Práticas e dano. */
export class DadoLosango extends DadoSimbolo {
  static DENOMINATION = "l";
}

/** ⬟ d12 — Rolagem Assimilada, Teste de Assimilação, Conflitos. */
export class DadoAssimilado extends DadoSimbolo {
  static DENOMINATION = "p";
}

export function registrarTermos() {
  CONFIG.Dice.terms.q = DadoInstinto;
  CONFIG.Dice.terms.l = DadoLosango;
  CONFIG.Dice.terms.p = DadoAssimilado;
}
