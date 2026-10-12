const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Ficha genérica de Item (Característica, Equipamento, Mutação, Ativação, Objetivo e Condicionante).
 */
export class FichaItem extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "ficha-item", "asm-papel"],
    position: { width: 520, height: 600 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    corpo: { template: "systems/assimilacao/templates/item/item.hbs", scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    context.item = item;
    context.sys = item.system;
    context.systemFields = item.system.schema.fields;
    context.tipoRotulo = game.i18n.localize(`TYPES.Item.${item.type}`);
    context.ehCaracteristica = item.type === "caracteristica";
    context.ehEquipamento = item.type === "equipamento";
    context.ehMutacao = item.type === "mutacao";
    context.ehAtivacao = item.type === "ativacao";
    context.ehObjetivo = item.type === "objetivo";
    context.ehCondicionante = item.type === "condicionante";
    if ( context.ehObjetivo ) {
      const dono = item.actor;
      const ids = dono?.type === "conflito" ? dono.system.ameacas : null;
      const ameacas = game.actors.filter(a => (a.type === "ameaca") && (!ids || ids.includes(a.id) || a.id === item.system.ameaca));
      context.ameacasOpcoes = Object.fromEntries(ameacas.map(a => [a.id, a.name]));
      context.nenhumaAmeaca = game.i18n.localize("ASSIMILACAO.Objetivo.semAmeaca");
      context.custoResumo = game.i18n.format("ASSIMILACAO.Objetivo.resumoMeta", {
        meta: item.system.meta, n: item.system.presentes
      });
    }
    if ( context.ehAtivacao ) {
      const S = CONFIG.ASSIMILACAO.SIMBOLOS;
      context.simbolos = ["A", "B", "C"].map(s => ({
        s, icone: S[s].icone, rotulo: game.i18n.localize(S[s].rotulo),
        custo: item._source.system.custo[s], progresso: item.system.progresso[s]
      }));
    }
    context.naipe = item.type === "mutacao" ? CONFIG.ASSIMILACAO.NAIPES[item.system.naipe] : null;
    context.descricaoHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.descricao, {
      secrets: item.isOwner, relativeTo: item
    });
    return context;
  }
}
