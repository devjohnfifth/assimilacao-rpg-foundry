import { FichaPartituraBase } from "./partitura-base.mjs";
import { casasA, percentual, MAX_CASAS } from "../helpers/partitura.mjs";

const T = "systems/assimilacao/templates/actor";

/**
 * Ficha de Ameaça no visual das partituras do livro (p. 213).
 */
export class FichaAmeaca extends FichaPartituraBase {

  static DEFAULT_OPTIONS = {
    classes: ["ficha-ameaca"],
    position: { width: 720, height: 760 },
    actions: {
      casaNeutralizacao: FichaAmeaca.#casaNeutralizacao,
      criarConflito: FichaAmeaca.#criarConflito
    }
  };

  static PARTS = {
    abas: { template: "templates/generic/tab-navigation.hbs" },
    partitura: { template: `${T}/ameaca-partitura.hbs`, scrollable: [""] },
    notas: { template: `${T}/ameaca-notas.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [{ id: "partitura", icon: "fa-solid fa-scroll" }, { id: "notas", icon: "fa-solid fa-book-open" }],
      initial: "partitura",
      labelPrefix: "ASSIMILACAO.Abas"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const n = this.actor.system.neutralizacao;
    return Object.assign(context, {
      casasNeutralizacao: casasA(n.max, n.value),
      neutralizacaoLonga: n.max > MAX_CASAS,
      neutralizacaoPct: percentual(n.value, n.max)
    });
  }

  static async #casaNeutralizacao(event, target) {
    const i = Number(target.dataset.i);
    const atual = this.actor.system.neutralizacao.value;
    const novo = (i <= atual) ? i - 1 : i;
    return this.actor.update({ "system.neutralizacao.value": Math.max(0, novo) });
  }

  /** "Se uma Ameaça é o único gerador do Conflito, ela se torna o próprio Conflito" (p. 197). */
  static async #criarConflito() {
    const conflito = await this.actor.criarConflito();
    conflito?.sheet.render({ force: true });
  }
}
