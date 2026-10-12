const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Lista de personagens para escolher quem age (usada pela macro "Rolar Teste" e afins).
 * Resolve com o Actor escolhido, ou null se a janela for fechada sem escolha.
 */
export class EscolherAtor extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "escolher-ator", "asm-papel"],
    window: { title: "ASSIMILACAO.Escolher.titulo", icon: "fa-solid fa-users", resizable: true },
    position: { width: 400, height: "auto" },
    actions: { escolher: EscolherAtor.#escolher }
  };

  static PARTS = {
    lista: { template: "systems/assimilacao/templates/apps/escolher-ator.hbs", scrollable: [".asm-escolha-lista"] }
  };

  /** Acima disso, aparece o campo de busca. */
  static LIMITE_BUSCA = 7;

  #resolve;
  #escolhido = null;

  /**
   * @param {Actor[]} atores
   * @param {object} [opcoes]  { titulo, dica }
   * @param {Function} [resolve]
   */
  constructor(atores, { titulo, dica } = {}, resolve) {
    super(titulo ? { window: { title: titulo } } : {});
    this.atores = atores;
    this.dica = dica ?? game.i18n.localize("ASSIMILACAO.Escolher.dica");
    this.#resolve = resolve;
  }

  /**
   * Abre a lista e espera a escolha.
   * @param {Actor[]} atores
   * @param {object} [opcoes]
   * @returns {Promise<Actor|null>}
   */
  static escolher(atores, opcoes = {}) {
    return new Promise(resolve => {
      new this(atores, opcoes, resolve).render({ force: true });
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const loc = k => game.i18n.localize(k);
    const meu = game.user.character;
    const donos = ator => game.users
      .filter(u => !u.isGM && ator.testUserPermission(u, "OWNER"))
      .map(u => u.name).join(", ");
    return Object.assign(context, {
      dica: this.dica,
      busca: this.atores.length > this.constructor.LIMITE_BUSCA,
      atores: this.atores.map(a => {
        const sys = a.system;
        const resumo = [];
        if ( sys.saude ) resumo.push(`${loc("ASSIMILACAO.Saude.titulo")} ${sys.saude.value}/${sys.saude.max}`);
        if ( sys.determinacao ) resumo.push(`${sys.determinacao.value} d`);
        if ( sys.assimilacao ) resumo.push(`${sys.assimilacao.value} e`);
        return {
          uuid: a.uuid,
          nome: a.name,
          img: a.img,
          tipo: loc(`TYPES.Actor.${a.type}`),
          donos: game.user.isGM ? donos(a) : "",
          resumo: resumo.join(" · "),
          meu: a === meu
        };
      })
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const busca = this.element.querySelector("input[name=busca]");
    if ( busca ) {
      busca.addEventListener("input", () => {
        const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
        for ( const li of this.element.querySelectorAll(".asm-escolha") ) {
          li.hidden = !!termo && !li.dataset.nome.toLocaleLowerCase("pt-BR").includes(termo);
        }
      });
      busca.focus();
    } else this.element.querySelector(".asm-escolha button")?.focus();
  }

  static #escolher(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    this.#escolhido = this.atores.find(a => a.uuid === uuid) ?? null;
    return this.close();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#resolve?.(this.#escolhido);
    this.#resolve = null;
  }
}
