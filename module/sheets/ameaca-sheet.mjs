const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const T = "systems/assimilacao/templates/actor";
const MAX_CASAS = 30;

/**
 * Ficha de Ameaça no visual das partituras do livro (p. 213): faixa terracota com nome e pool,
 * coluna ardósia com Ativações e Neutralização, custos desenhados em casas de símbolos.
 */
export class FichaAmeaca extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "ficha-ameaca", "asm-papel"],
    position: { width: 720, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rolarPool: FichaAmeaca.#rolarPool,
      casaAtivacao: FichaAmeaca.#casaAtivacao,
      casaNeutralizacao: FichaAmeaca.#casaNeutralizacao,
      dispararAtivacao: FichaAmeaca.#disparar,
      limparAtivacao: FichaAmeaca.#limpar,
      criarAtivacao: FichaAmeaca.#criarAtivacao,
      editarItem: FichaAmeaca.#editarItem,
      apagarItem: FichaAmeaca.#apagarItem
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
    const actor = this.actor;
    const sys = actor.system;
    const S = CONFIG.ASSIMILACAO;
    const loc = k => game.i18n.localize(k);
    const enriquecer = (html, rel) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
      secrets: actor.isOwner, relativeTo: rel ?? actor
    });

    const glifos = { q: "■", l: "◆", p: "⬟" };
    const poolTexto = ["q", "l", "p"].filter(k => sys.pool[k]).map(k => `${sys.pool[k]}${glifos[k]}`).join(" + ") || "—";

    const casas = (custo, progresso) => {
      const lista = [];
      for ( const s of ["A", "B", "C"] ) {
        const n = Math.min(custo[s], MAX_CASAS);
        for ( let i = 1; i <= n; i++ ) lista.push({ s, i, cheia: i <= progresso[s], icone: S.SIMBOLOS[s].icone });
      }
      return lista;
    };

    const ativacoes = [];
    for ( const item of actor.items.contents.filter(i => i.type === "ativacao").sort((a, b) => a.sort - b.sort) ) {
      const st = item.system;
      ativacoes.push({
        id: item.id, name: item.name, system: st,
        casas: casas(st.custo, st.progresso),
        completa: st.completa, esgotada: st.esgotada,
        efeito: await enriquecer(st.descricao, item),
        semCusto: st.totalCusto === 0
      });
    }

    const n = sys.neutralizacao;
    const casasNeutralizacao = Array.from({ length: Math.min(n.max, MAX_CASAS) }, (_, k) => ({
      i: k + 1, cheia: k + 1 <= n.value, icone: S.SIMBOLOS.A.icone
    }));

    // Regra de montagem: ao menos uma Ativação só de C e uma só de A (p. 208)
    const soDe = s => ativacoes.some(a => a.system.custo[s] > 0
      && ["A", "B", "C"].filter(o => o !== s).every(o => a.system.custo[o] === 0));
    const avisos = [];
    if ( !soDe("C") ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSoC"));
    if ( !soDe("A") ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSoA"));
    if ( !sys.totalDados ) avisos.push(loc("ASSIMILACAO.Ameaca.avisoSemDados"));

    return Object.assign(context, {
      actor, sys,
      poolTexto,
      ativacoes,
      casasNeutralizacao,
      neutralizacaoLonga: n.max > MAX_CASAS,
      neutralizacaoPct: n.max > 0 ? Math.round(100 * Math.min(n.value, n.max) / n.max) : 0,
      niveis: Object.fromEntries(Object.entries(S.NIVEIS).map(([k, v]) => [k, loc(v)])),
      balancoRotulo: loc(`ASSIMILACAO.Ameaca.balanco.${sys.balanco}`),
      avisos,
      descricaoHTML: await enriquecer(sys.descricao),
      notasHTML: await enriquecer(sys.notas),
      isGM: game.user.isGM
    });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    // O contexto é compartilhado entre as partes: limpa a aba anterior (uma aba oculta não herda "active").
    context.tab = context.tabs?.[partId];
    return context;
  }

  /* -------------------------------------------- */

  static #item(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  static #rolarPool() {
    return this.actor.rolarPool();
  }

  static async #casaAtivacao(event, target) {
    const item = FichaAmeaca.#item.call(this, target);
    if ( !item ) return;
    const s = target.dataset.s;
    const i = Number(target.dataset.i);
    const atual = item.system.progresso[s];
    const novo = (i <= atual) ? i - 1 : i;
    return item.update({ [`system.progresso.${s}`]: Math.clamp(novo, 0, item.system.custo[s]) });
  }

  static async #casaNeutralizacao(event, target) {
    const i = Number(target.dataset.i);
    const atual = this.actor.system.neutralizacao.value;
    const novo = (i <= atual) ? i - 1 : i;
    return this.actor.update({ "system.neutralizacao.value": Math.max(0, novo) });
  }

  static async #disparar(event, target) {
    const item = FichaAmeaca.#item.call(this, target);
    if ( !item ) return;
    return this.actor.dispararAtivacao(item, { forcar: event.shiftKey });
  }

  static async #limpar(event, target) {
    const item = FichaAmeaca.#item.call(this, target);
    return item?.update({ "system.progresso": { A: 0, B: 0, C: 0 } });
  }

  static async #criarAtivacao() {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      type: "ativacao", name: game.i18n.localize("TYPES.Item.ativacao"), system: { custo: { A: 0, B: 0, C: 2 } }
    }]);
    item?.sheet.render({ force: true });
  }

  static #editarItem(event, target) {
    FichaAmeaca.#item.call(this, target)?.sheet.render({ force: true });
  }

  static async #apagarItem(event, target) {
    const item = FichaAmeaca.#item.call(this, target);
    if ( !item ) return;
    return item.deleteDialog?.() ?? item.delete();
  }
}
