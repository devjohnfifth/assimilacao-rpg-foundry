const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Ficha genérica de Item (Característica, Equipamento, Mutação, Ativação de Ameaça).
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
