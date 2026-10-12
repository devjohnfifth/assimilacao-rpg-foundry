const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const T = "systems/assimilacao/templates/actor";

/**
 * Ficha de Infectado — reproduz a ficha oficial (p. 313–314) com interatividade.
 * Também serve aos Personagens do(a) Assimilador(a) (NPCs): relação com o grupo, segredos só do GM
 * e modo simplificado (só Aptidões, Saúde e Cabo de Guerra).
 */
export class FichaInfectado extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "ficha-infectado", "asm-papel"],
    position: { width: 820, height: 900 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rolarAptidao: FichaInfectado.#rolarAptidao,
      rolarLivre: FichaInfectado.#rolarLivre,
      definirNivel: FichaInfectado.#definirNivel,
      laco: FichaInfectado.#laco,
      ajustarD: FichaInfectado.#ajustarD,
      gota: FichaInfectado.#gota,
      dano: FichaInfectado.#dano,
      curar: FichaInfectado.#curar,
      repouso: FichaInfectado.#repouso,
      encerrarCena: FichaInfectado.#encerrarCena,
      novaSessao: FichaInfectado.#novaSessao,
      criarItem: FichaInfectado.#criarItem,
      editarItem: FichaInfectado.#editarItem,
      apagarItem: FichaInfectado.#apagarItem,
      mostrarItem: FichaInfectado.#mostrarItem,
      usarItem: FichaInfectado.#usarItem
    }
  };

  static PARTS = {
    cabecalho: { template: `${T}/cabecalho.hbs` },
    abas: { template: "templates/generic/tab-navigation.hbs" },
    frente: { template: `${T}/frente.hbs`, scrollable: [""] },
    verso: { template: `${T}/verso.hbs`, scrollable: [""] },
    notas: { template: `${T}/notas.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "frente", icon: "fa-solid fa-dna" },
        { id: "verso", icon: "fa-solid fa-leaf" },
        { id: "notas", icon: "fa-solid fa-book-open" }
      ],
      initial: "frente",
      labelPrefix: "ASSIMILACAO.Abas"
    }
  };

  /* -------------------------------------------- */
  /*  Contexto                                    */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const sys = actor.system;
    const S = CONFIG.ASSIMILACAO;
    const loc = k => game.i18n.localize(k);

    const montarGrupo = (grupo, chaves, forma) => chaves.map(k => {
      const valor = sys[grupo][k];
      const caixas = Array.from({ length: Math.max(5, valor) }, (_, i) => ({ n: i + 1, marcada: i < valor }));
      return {
        chave: k, grupo, valor, forma, caixas,
        rotulo: loc(`ASSIMILACAO.Aptidao.${k}`),
        adjetivo: S.ADJETIVOS[k]?.[Math.min(valor, 5)] ?? "",
        descricao: loc(`ASSIMILACAO.AptidaoDesc.${k}`)
      };
    });

    // Saúde: 3 pares de faixas (6–5, 4–3, 2–1)
    const porNivel = sys.saude.porNivel;
    const dano = sys.saude.dano;
    const faixa = L => {
      const gotas = Array.from({ length: porNivel }, (_, j) => {
        const limiar = (6 - L) * porNivel + (porNivel - j);
        return { j: j + 1, cheia: dano < limiar, fixa: j === 0, nivel: L };
      });
      return { nivel: L, nome: S.SAUDE[L].nome, faixa: S.SAUDE[L].faixa, gotas, atual: sys.saude.nivel === L };
    };
    const saude = {
      alta: [faixa(6), faixa(5)],
      media: [faixa(4), faixa(3)],
      critica: [faixa(2), faixa(1)]
    };

    // Cabo de Guerra: 10 laços; os D primeiros são de Determinação, os demais de Assimilação.
    const D = sys.determinacao.nivel;
    const lacos = Array.from({ length: S.CABO_TOTAL }, (_, i) => {
      const n = i + 1;
      if ( n <= D ) return { n, lado: "det", cheio: n <= sys.determinacao.value };
      const daDireita = S.CABO_TOTAL - n + 1;
      return { n, lado: "ass", cheio: daDireita <= sys.assimilacao.value };
    });

    // Itens
    const itens = actor.items.contents.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
    const caracteristicas = itens.filter(i => i.type === "caracteristica");
    const mutacoes = Object.entries(S.NAIPES).map(([naipe, info]) => ({
      naipe, ...info,
      rotulo: loc(info.rotulo),
      itens: itens.filter(i => (i.type === "mutacao") && (i.system.naipe === naipe))
    }));
    const equipamentos = itens.filter(i => i.type === "equipamento");
    const ocupacao = local => equipamentos.filter(i => i.system.local === local)
      .reduce((s, i) => s + (i.system.espacos ?? 1), 0);
    const espacos = (local, cap) => {
      const usados = ocupacao(local);
      return {
        local, cap, usados, excedido: usados > cap,
        caixas: Array.from({ length: Math.max(cap, usados) }, (_, i) => ({ cheia: i < usados, extra: i >= cap })),
        itens: equipamentos.filter(i => i.system.local === local)
      };
    };

    const enriquecer = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
      secrets: actor.isOwner, relativeTo: actor
    });

    return Object.assign(context, {
      actor, sys, S,
      instintos: montarGrupo("instintos", S.INSTINTOS, "quadrado"),
      conhecimentos: montarGrupo("conhecimentos", S.CONHECIMENTOS, "losango"),
      praticas: montarGrupo("praticas", S.PRATICAS, "losango"),
      saude, lacos,
      E: sys.assimilacao.nivel,
      geracoes: Object.fromEntries(Object.entries(S.GERACOES).map(([k, v]) => [k, loc(v)])),
      caracteristicas, mutacoes,
      inventario: { corpo: espacos("corpo", sys.inventario.corpo), mochila: espacos("mochila", sys.inventario.mochila) },
      refugio: equipamentos.filter(i => i.system.local === "refugio"),
      locais: Object.fromEntries(Object.entries(S.LOCAIS_INVENTARIO).map(([k, v]) => [k, loc(v)])),
      biografiaHTML: await enriquecer(sys.biografia),
      notasHTML: await enriquecer(sys.notas),
      estados: this.#estados(sys),
      isGM: game.user.isGM,
      ehPersonagem: actor.type === "personagem",
      simplificado: this.simplificado,
      relacoes: Object.fromEntries(Object.entries(S.RELACOES).map(([k, v]) => [k, loc(v)])),
      segredosHTML: (actor.type === "personagem") && game.user.isGM ? await enriquecer(sys.segredos.notas) : ""
    });
  }

  /** Personagem em modo simplificado: some a aba Verso. */
  get simplificado() {
    return (this.actor.type === "personagem") && !!this.actor.system.simplificado;
  }

  /** @override */
  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if ( (group !== "primary") || !this.simplificado ) return config;
    if ( this.tabGroups.primary === "verso" ) this.tabGroups.primary = "frente";
    return { ...config, tabs: config.tabs.filter(t => t.id !== "verso") };
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    // O contexto é compartilhado entre as partes: limpa a aba anterior (uma aba oculta não herda "active").
    context.tab = context.tabs?.[partId];
    return context;
  }

  #estados(sys) {
    const e = [];
    if ( sys.suscetivel ) e.push({ id: "suscetivel", rotulo: "ASSIMILACAO.Estado.suscetivel" });
    if ( sys.mutacaoPendente ) e.push({ id: "mutacao", rotulo: "ASSIMILACAO.Estado.mutacaoPendente" });
    if ( sys.saude.morto ) e.push({ id: "morto", rotulo: "ASSIMILACAO.Estado.morto" });
    else if ( sys.saude.nivel === 1 ) e.push({ id: "inconsciente", rotulo: "ASSIMILACAO.Estado.inconsciente" });
    else if ( sys.saude.penalidadeA ) e.push({ id: "ferido", rotulo: "ASSIMILACAO.Estado.ferido" });
    return e;
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  static #rolarAptidao(event, target) {
    return this.actor.rolarTeste({ aptidao: target.dataset.aptidao });
  }

  static #rolarLivre() {
    return this.actor.rolarTeste({});
  }

  static async #definirNivel(event, target) {
    const { grupo, chave } = target.dataset;
    const n = Number(target.dataset.nivel);
    const atual = this.actor.system[grupo][chave];
    const minimo = grupo === "instintos" ? 1 : 0;
    const novo = Math.max(minimo, (n === atual) ? n - 1 : n);
    return this.actor.update({ [`system.${grupo}.${chave}`]: novo });
  }

  static async #laco(event, target) {
    const sys = this.actor.system;
    const n = Number(target.dataset.n);
    if ( target.dataset.lado === "det" ) {
      const novo = (n <= sys.determinacao.value) ? n - 1 : n;
      return this.actor.update({ "system.determinacao.value": Math.clamp(novo, 0, sys.determinacao.nivel) });
    }
    const daDireita = CONFIG.ASSIMILACAO.CABO_TOTAL - n + 1;
    const novo = (daDireita <= sys.assimilacao.value) ? daDireita - 1 : daDireita;
    return this.actor.update({ "system.assimilacao.value": Math.clamp(novo, 0, sys.assimilacao.max) });
  }

  static async #ajustarD(event, target) {
    const delta = Number(target.dataset.delta);
    const sys = this.actor.system;
    const D = Math.clamp(sys.determinacao.nivel + delta, 0, CONFIG.ASSIMILACAO.CABO_TOTAL);
    return this.actor.update({
      "system.determinacao.nivel": D,
      "system.determinacao.value": Math.min(sys.determinacao.value, D),
      "system.assimilacao.value": Math.min(sys.assimilacao.value, CONFIG.ASSIMILACAO.CABO_TOTAL - D)
    });
  }

  static async #gota(event, target) {
    const sys = this.actor.system;
    const porNivel = sys.saude.porNivel;
    const L = Number(target.dataset.nivel);
    const j = Number(target.dataset.j) - 1;
    const limiar = (6 - L) * porNivel + (porNivel - j);
    const cheia = sys.saude.dano < limiar;
    return this.actor.update({ "system.saude.dano": cheia ? limiar : limiar - 1 });
  }

  static async #pedirNumero(titulo, rotulo) {
    const { DialogV2 } = foundry.applications.api;
    const conteudo = document.createElement("div");
    conteudo.innerHTML = `<div class="form-group"><label>${rotulo}</label>
      <input type="number" name="n" value="1" min="1" step="1" autofocus></div>`;
    try {
      return await DialogV2.prompt({
        window: { title: titulo },
        content: conteudo,
        ok: { callback: (event, button) => Number(button.form.elements.n.value) || 0 },
        rejectClose: false
      });
    } catch { return 0; }
  }

  static async #dano() {
    const n = await FichaInfectado.#pedirNumero(game.i18n.localize("ASSIMILACAO.Saude.aplicarDano"),
      game.i18n.localize("ASSIMILACAO.Saude.pontos"));
    if ( n > 0 ) return this.actor.aplicarDano(n);
  }

  static async #curar() {
    const n = await FichaInfectado.#pedirNumero(game.i18n.localize("ASSIMILACAO.Saude.curar"),
      game.i18n.localize("ASSIMILACAO.Saude.pontos"));
    if ( n > 0 ) return this.actor.curar(n);
  }

  static #repouso() {
    return this.actor.repousoCompleto();
  }

  static #encerrarCena() {
    return this.actor.encerrarCena();
  }

  static #novaSessao() {
    return this.actor.novaSessao();
  }

  static async #criarItem(event, target) {
    const tipo = target.dataset.tipo;
    const dados = { type: tipo, name: game.i18n.localize(`TYPES.Item.${tipo}`), system: {} };
    if ( target.dataset.naipe ) dados.system.naipe = target.dataset.naipe;
    if ( target.dataset.local ) dados.system.local = target.dataset.local;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [dados]);
    item?.sheet.render({ force: true });
  }

  static #item(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  static #editarItem(event, target) {
    FichaInfectado.#item.call(this, target)?.sheet.render({ force: true });
  }

  static async #apagarItem(event, target) {
    const item = FichaInfectado.#item.call(this, target);
    if ( !item ) return;
    return item.deleteDialog?.() ?? item.delete();
  }

  static async #mostrarItem(event, target) {
    const item = FichaInfectado.#item.call(this, target);
    if ( !item ) return;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="asm-card asm-papel item-card"><header class="asm-card-cabecalho">
        <img class="asm-card-retrato" src="${item.img}" alt=""><div class="asm-card-titulos">
        <span class="asm-etiqueta">${game.i18n.localize(`TYPES.Item.${item.type}`)}</span><h3>${item.name}</h3></div></header>
        <div class="asm-card-texto">${item.system.descricao ?? ""}</div></div>`
    });
  }

  static async #usarItem(event, target) {
    const item = FichaInfectado.#item.call(this, target);
    if ( !item?.system.usos ) return;
    const u = item.system.usos;
    const delta = event.button === 2 ? 1 : -1;
    return item.update({ "system.usos.value": Math.clamp(u.value + delta, 0, Math.max(u.max, u.value + delta)) });
  }
}
