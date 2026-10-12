import * as motor from "../conflito/motor.mjs";
import { poolTexto, prepararAtivacoes, avisosMontagem, saldoLista } from "../helpers/partitura.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Base das fichas que seguem o visual das partituras do livro (p. 213): Ameaça e Conflito.
 * Faixa terracota com nome e pool, coluna ardósia com as seções, custos desenhados em casas.
 */
export class FichaPartituraBase extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "asm-papel", "ficha-partitura"],
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rolarPool: FichaPartituraBase.#rolarPool,
      casaAtivacao: FichaPartituraBase.#casaAtivacao,
      dispararAtivacao: FichaPartituraBase.#disparar,
      limparAtivacao: FichaPartituraBase.#limpar,
      criarAtivacao: FichaPartituraBase.#criarAtivacao,
      editarItem: FichaPartituraBase.#editarItem,
      apagarItem: FichaPartituraBase.#apagarItem
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const sys = actor.system;
    const S = CONFIG.ASSIMILACAO;
    const loc = k => game.i18n.localize(k);
    const enriquecer = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
      secrets: actor.isOwner, relativeTo: actor
    });
    const ativacoes = await prepararAtivacoes(actor);
    let dificuldadeMundo = "";
    try {
      const d = game.settings.get("assimilacao", "dificuldade");
      dificuldadeMundo = game.i18n.format("ASSIMILACAO.Dificuldade.doMundo", { nome: loc(S.DIFICULDADES[d]?.rotulo ?? "") });
    } catch { /* configuração ainda não registrada */ }
    return Object.assign(context, {
      actor, sys,
      poolTexto: poolTexto(sys.pool, sys.extraDificuldade),
      ativacoes,
      saldo: saldoLista(sys.saldo),
      temSaldo: sys.saldoTotal > 0,
      niveis: Object.fromEntries(Object.entries(S.NIVEIS).map(([k, v]) => [k, loc(v)])),
      dificuldades: Object.fromEntries(Object.entries(S.DIFICULDADES).map(([k, v]) => [k, loc(v.rotulo)])),
      dificuldadeMundo,
      balancoRotulo: loc(`ASSIMILACAO.Ameaca.balanco.${sys.balanco}`),
      avisos: avisosMontagem(ativacoes, sys),
      descricaoHTML: await enriquecer(sys.descricao),
      notasHTML: await enriquecer(sys.notas),
      isGM: game.user.isGM
    });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    // O contexto é compartilhado entre as partes: uma aba oculta não herda "active".
    context.tab = context.tabs?.[partId];
    return context;
  }

  /* -------------------------------------------- */

  /** Item a partir do elemento clicado. */
  _itemDe(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  static #rolarPool() {
    return this.actor.rolarPool();
  }

  static async #casaAtivacao(event, target) {
    const item = this._itemDe(target);
    if ( !item ) return;
    return motor.investirCasa(this.actor, item, target.dataset.s, Number(target.dataset.i));
  }

  static async #disparar(event, target) {
    const item = this._itemDe(target);
    if ( item ) return this.actor.dispararAtivacao(item, { forcar: event.shiftKey });
  }

  static async #limpar(event, target) {
    return this._itemDe(target)?.update({ "system.progresso": { A: 0, B: 0, C: 0 } });
  }

  static async #criarAtivacao() {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      type: "ativacao", name: game.i18n.localize("TYPES.Item.ativacao"), system: { custo: { A: 0, B: 0, C: 2 } }
    }]);
    item?.sheet.render({ force: true });
  }

  static #editarItem(event, target) {
    this._itemDe(target)?.sheet.render({ force: true });
  }

  static async #apagarItem(event, target) {
    const item = this._itemDe(target);
    if ( !item ) return;
    return item.deleteDialog?.() ?? item.delete();
  }
}
