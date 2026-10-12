import { FichaPartituraBase } from "./partitura-base.mjs";
import * as motor from "../conflito/motor.mjs";
import { poolTexto } from "../helpers/partitura.mjs";
import { PartituraConflito, dialogoIniciar, dialogoEncerrar } from "../apps/partitura-conflito.mjs";

const T = "systems/assimilacao/templates/actor";

/**
 * Ficha de montagem do Conflito (p. 212–213): Condicionantes, Ativações do Conflito,
 * Objetivos Principais e Secundários e as Ameaças vinculadas. A cena roda na janela da Partitura.
 */
export class FichaConflito extends FichaPartituraBase {

  static DEFAULT_OPTIONS = {
    classes: ["ficha-conflito"],
    position: { width: 760, height: 820 },
    actions: {
      criarObjetivo: FichaConflito.#criarObjetivo,
      criarCondicionante: FichaConflito.#criarCondicionante,
      alternarCondicionante: FichaConflito.#alternarCondicionante,
      abrirAmeaca: FichaConflito.#abrirAmeaca,
      novaAmeaca: FichaConflito.#novaAmeaca,
      desvincularAmeaca: FichaConflito.#desvincularAmeaca,
      moverAmeaca: FichaConflito.#moverAmeaca,
      iniciarConflito: FichaConflito.#iniciar,
      abrirPartitura: FichaConflito.#abrirPartitura,
      encerrarConflito: FichaConflito.#encerrar
    }
  };

  static PARTS = {
    abas: { template: "templates/generic/tab-navigation.hbs" },
    partitura: { template: `${T}/conflito-partitura.hbs`, scrollable: [""] },
    notas: { template: `${T}/conflito-notas.hbs`, scrollable: [""] }
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
      secrets: actor.isOwner, relativeTo: rel
    });

    const objetivos = { principal: [], secundario: [] };
    for ( const obj of actor.items.filter(i => i.type === "objetivo").sort((a, b) => a.sort - b.sort) ) {
      const st = obj.system;
      const ameaca = st.ameaca ? game.actors.get(st.ameaca) : null;
      objetivos[st.categoria === "secundario" ? "secundario" : "principal"].push({
        id: obj.id, name: obj.name, system: st,
        custoTexto: motor.custoObjetivoTexto(obj),
        meta: ameaca?.system.neutralizacao?.max ?? st.meta,
        ameacaNome: ameaca?.name ?? "",
        efeito: await enriquecer(st.descricao, obj)
      });
    }
    const condicionantes = [];
    for ( const cd of actor.items.filter(i => i.type === "condicionante").sort((a, b) => a.sort - b.sort) ) {
      condicionantes.push({ id: cd.id, name: cd.name, system: cd.system, efeito: await enriquecer(cd.system.descricao, cd) });
    }
    const lista = motor.ameacasDo(actor);
    const ameacas = lista.map((am, k) => ({
      id: am.id, name: am.name, img: am.img,
      poolTexto: poolTexto(am.system.pool, am.system.extraDificuldade),
      valorPool: am.system.valorPool,
      neutralizacao: `${am.system.neutralizacao.value}/${am.system.neutralizacao.max}`,
      neutralizada: am.system.neutralizada,
      primeiro: k === 0, ultimo: k === lista.length - 1
    }));

    // Regras de montagem do Conflito (p. 199, 205, 208)
    const avisos = [...context.avisos];
    if ( !objetivos.principal.length ) avisos.push(loc("ASSIMILACAO.Conflito.avisoSemPrincipal"));
    if ( !actor.items.some(i => (i.type === "objetivo") && i.system.fuga) ) avisos.push(loc("ASSIMILACAO.Conflito.avisoSemFuga"));

    return Object.assign(context, {
      principais: objetivos.principal,
      secundarios: objetivos.secundario,
      condicionantes,
      ameacas,
      avisos,
      intencoes: Object.fromEntries(Object.entries(S.INTENCOES).map(([k, v]) => [k, loc(v)])),
      escalas: Object.fromEntries(Object.entries(S.ESCALAS).map(([k, v]) => [k, loc(v)])),
      dicaIntencao: loc(`ASSIMILACAO.Intencao.dica.${sys.intencao}`),
      cenaAtiva: sys.cena.ativa,
      faseRotulo: loc(S.FASES[sys.cena.fase] ?? "")
    });
  }

  /** Arrastar uma Ameaça do diretório para a ficha a vincula ao Conflito. */
  async _onDropActor(event, actor) {
    if ( !this.isEditable || (actor?.type !== "ameaca") ) return null;
    await motor.vincularAmeaca(this.actor, actor.id);
    return actor;
  }

  /* -------------------------------------------- */

  static async #criarObjetivo(event, target) {
    const categoria = target.dataset.categoria ?? "principal";
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      type: "objetivo", name: game.i18n.localize("TYPES.Item.objetivo"), system: { categoria }
    }]);
    item?.sheet.render({ force: true });
  }

  static async #criarCondicionante() {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      type: "condicionante", name: game.i18n.localize("TYPES.Item.condicionante")
    }]);
    item?.sheet.render({ force: true });
  }

  static #alternarCondicionante(event, target) {
    const item = this._itemDe(target);
    return item?.update({ "system.ativa": !item.system.ativa });
  }

  static #abrirAmeaca(event, target) {
    game.actors.get(target.closest("[data-ameaca]")?.dataset.ameaca)?.sheet.render({ force: true });
  }

  static async #novaAmeaca() {
    const am = await Actor.create({
      name: game.i18n.localize("TYPES.Actor.ameaca"), type: "ameaca",
      folder: this.actor.folder?.id ?? null,
      system: { nivel: this.actor.system.nivel, infectadosPresentes: this.actor.system.infectadosPresentes }
    });
    if ( !am ) return;
    await motor.vincularAmeaca(this.actor, am.id);
    am.sheet.render({ force: true });
  }

  static #desvincularAmeaca(event, target) {
    return motor.desvincularAmeaca(this.actor, target.closest("[data-ameaca]")?.dataset.ameaca);
  }

  static #moverAmeaca(event, target) {
    return motor.moverAmeaca(this.actor, target.closest("[data-ameaca]")?.dataset.ameaca, Number(target.dataset.passo));
  }

  static #iniciar() {
    return dialogoIniciar(this.actor);
  }

  static #abrirPartitura() {
    return PartituraConflito.abrir(this.actor);
  }

  static #encerrar() {
    return dialogoEncerrar(this.actor);
  }
}
