/**
 * Item do Assimilação: ícones padrão por tipo.
 */
export class ItemAssimilacao extends Item {
  static ICONES = {
    caracteristica: "icons/svg/aura.svg",
    equipamento: "icons/svg/item-bag.svg",
    mutacao: "icons/svg/biohazard.svg"
  };

  /** @override */
  static getDefaultArtwork(itemData = {}) {
    return { img: this.ICONES[itemData.type] ?? this.DEFAULT_ICON };
  }
}
