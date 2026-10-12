import * as motor from "../conflito/motor.mjs";
import { poolTexto, prepararAtivacoes, casasA, percentual, saldoLista, MAX_CASAS } from "../helpers/partitura.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const loc = k => game.i18n.localize(k);
const fmt = (k, d) => game.i18n.format(k, d);
const esc = t => foundry.utils.escapeHTML(String(t ?? ""));

/**
 * Janela "Partitura de Conflito" (seção 10.3): a cena em andamento, para o(a) GM e para os jogadores.
 * GM: rodada e fases, pools, saldo a investir, casas das Ativações, Objetivos, Ameaças e presentes.
 * Jogadores: Objetivos, Condicionantes, Neutralizações e presentes (Ativações só com "Partitura aberta").
 */
export class PartituraConflito extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: ["assimilacao", "partitura-conflito", "asm-papel"],
    window: { icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 1040, height: 820 },
    actions: {
      proximaFase: PartituraConflito.#proximaFase,
      rolarPools: PartituraConflito.#rolarPools,
      rolarPool: PartituraConflito.#rolarPool,
      casaAtivacao: PartituraConflito.#casaAtivacao,
      dispararAtivacao: PartituraConflito.#disparar,
      limparAtivacao: PartituraConflito.#limpar,
      editarItem: PartituraConflito.#editarItem,
      casaObjetivo: PartituraConflito.#casaObjetivo,
      casaObjetivoInd: PartituraConflito.#casaObjetivoInd,
      retirarProgresso: PartituraConflito.#retirarProgresso,
      casaNeutralizacao: PartituraConflito.#casaNeutralizacao,
      alternarFuga: PartituraConflito.#alternarFuga,
      removerPresente: PartituraConflito.#removerPresente,
      adicionarGrupo: PartituraConflito.#adicionarGrupo,
      moverAmeaca: PartituraConflito.#moverAmeaca,
      abrirFicha: PartituraConflito.#abrirFicha,
      abrirTeste: PartituraConflito.#abrirTeste,
      iniciar: PartituraConflito.#iniciar,
      encerrar: PartituraConflito.#encerrar
    }
  };

  static PARTS = {
    corpo: {
      template: "systems/assimilacao/templates/apps/partitura-conflito.hbs",
      scrollable: [".asm-pc-principal", ".asm-pc-lateral"]
    }
  };

  /**
   * @param {Actor} conflito
   */
  constructor(conflito, options = {}) {
    super({ id: `asm-partitura-${conflito.id}`, ...options });
    this.conflito = conflito;
    this._rerender = foundry.utils.debounce(() => { if ( this.rendered ) this.render(); }, 80);
    this._ganchos = [];
  }

  /** Abre (ou traz para frente) a partitura de um Conflito. */
  static abrir(conflito) {
    if ( conflito?.type !== "conflito" ) return null;
    const existente = foundry.applications.instances.get(`asm-partitura-${conflito.id}`);
    if ( existente ) {
      existente.render({ force: true });
      existente.bringToFront?.();
      return existente;
    }
    const app = new this(conflito);
    app.render({ force: true });
    return app;
  }

  /** Fecha a partitura de um Conflito, se estiver aberta. */
  static fechar(conflito) {
    const app = foundry.applications.instances.get(`asm-partitura-${conflito?.id ?? conflito}`);
    return app?.close();
  }

  get title() {
    return `${loc("ASSIMILACAO.Partitura.titulo")}: ${this.conflito.name}`;
  }

  /* -------------------------------------------- */
  /*  Atualização automática                      */
  /* -------------------------------------------- */

  /** Este documento afeta o que a partitura mostra? */
  #relevante(doc) {
    const c = this.conflito;
    const ator = (doc instanceof Actor) ? doc : doc.parent;
    if ( !(ator instanceof Actor) ) return false;
    if ( ator.id === c.id ) return true;
    return c.system.ameacas.includes(ator.id) || c.system.cena.presentes.includes(ator.id);
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    this.#aceitarAtores();
    const gancho = (nome, fn) => this._ganchos.push([nome, Hooks.on(nome, fn)]);
    const talvez = doc => { if ( this.#relevante(doc) ) this._rerender(); };
    gancho("updateActor", talvez);
    gancho("createItem", talvez);
    gancho("updateItem", talvez);
    gancho("deleteItem", talvez);
    gancho("deleteActor", doc => {
      if ( doc.id === this.conflito.id ) this.close();
      else talvez(doc);
    });
  }

  _onClose(options) {
    super._onClose(options);
    for ( const [nome, id] of this._ganchos ) Hooks.off(nome, id);
    this._ganchos = [];
  }

  /** Arrastar atores do diretório: Ameaças são vinculadas; Infectados e PdAs entram na cena (só GM). */
  #aceitarAtores() {
    const el = this.element;
    el.addEventListener("dragover", ev => { if ( game.user.isGM ) ev.preventDefault(); });
    el.addEventListener("drop", async ev => {
      if ( !game.user.isGM ) return;
      const dados = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if ( dados?.type !== "Actor" ) return;
      ev.preventDefault();
      const ator = await fromUuid(dados.uuid);
      if ( !ator ) return;
      if ( ator.type === "ameaca" ) await motor.vincularAmeaca(this.conflito, ator.id);
      else if ( ["infectado", "personagem"].includes(ator.type) ) await motor.adicionarPresente(this.conflito, ator.id);
    });
  }

  /* -------------------------------------------- */
  /*  Contexto                                    */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const c = this.conflito;
    const sys = c.system;
    const cena = sys.cena;
    const S = CONFIG.ASSIMILACAO;
    const isGM = game.user.isGM;
    const verAtivacoes = isGM || sys.aberta;
    const enriquecer = (html, rel) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", {
      secrets: isGM, relativeTo: rel ?? c
    });

    // Fases
    const ordem = motor.ordemFases(c).map(id => ({ id, rotulo: loc(S.FASES[id]), atual: id === cena.fase }));

    // Presentes
    const presentes = cena.presentes.map(id => {
      const a = game.actors.get(id);
      if ( !a ) return null;
      const s = a.system;
      return {
        id, nome: a.name, img: a.img, uuid: a.uuid,
        fugiu: cena.fugiram.includes(id),
        saude: s.saude ? `${s.saude.value}/${s.saude.max}` : "",
        nivelSaude: s.saude?.nome ?? "",
        d: s.determinacao?.value, e: s.assimilacao?.value,
        meu: a.isOwner && !isGM
      };
    }).filter(Boolean);
    const nomeDe = id => game.actors.get(id)?.name ?? "?";
    const imgDe = id => game.actors.get(id)?.img ?? "icons/svg/mystery-man.svg";

    // Objetivos
    const objetivos = { principal: [], secundario: [] };
    for ( const obj of c.items.filter(i => i.type === "objetivo").sort((a, b) => a.sort - b.sort) ) {
      const est = motor.estadoObjetivo(c, obj);
      const st = obj.system;
      const entrada = {
        id: obj.id, name: obj.name, system: st,
        custoTexto: motor.custoObjetivoTexto(obj),
        meta: est.meta, atual: est.atual, completo: est.completo,
        pct: percentual(est.atual, est.meta),
        longa: est.meta > MAX_CASAS,
        casas: est.individual ? [] : casasA(est.meta, est.atual),
        individual: est.individual,
        ameaca: est.ameaca ? { id: est.ameaca.id, nome: est.ameaca.name } : null,
        efeito: await enriquecer(st.descricao, obj),
        contribuicoes: Object.entries(est.contribuicoes).filter(([, n]) => n > 0)
          .map(([id, n]) => ({ id, n, nome: nomeDe(id), img: imgDe(id) })),
        faltamMinimo: est.faltamMinimo.map(nomeDe).join(", "),
        linhas: est.individual ? cena.presentes.map(id => {
          const n = est.contribuicoes[id] ?? 0;
          return { atorId: id, nome: nomeDe(id), img: imgDe(id), n, completo: n >= est.meta,
            fugiu: cena.fugiram.includes(id), casas: casasA(est.meta, n), pct: percentual(n, est.meta) };
        }) : []
      };
      objetivos[st.categoria === "secundario" ? "secundario" : "principal"].push(entrada);
    }

    // Condicionantes
    const condicionantes = [];
    for ( const cd of c.items.filter(i => i.type === "condicionante").sort((a, b) => a.sort - b.sort) ) {
      if ( !cd.system.ativa && !isGM ) continue;
      condicionantes.push({ id: cd.id, name: cd.name, ativa: cd.system.ativa, termino: cd.system.termino,
        efeito: await enriquecer(cd.system.descricao, cd) });
    }

    // Ameaças
    const ameacas = [];
    const lista = motor.ameacasDo(c);
    for ( const [k, am] of lista.entries() ) {
      const s = am.system;
      ameacas.push({
        id: am.id, name: am.name, img: am.img, uuid: am.uuid,
        interesses: s.interesses,
        poolTexto: poolTexto(s.pool, s.extraDificuldade),
        neutralizada: s.neutralizada,
        neutralizacao: { value: s.neutralizacao.value, max: s.neutralizacao.max,
          casas: casasA(s.neutralizacao.max, s.neutralizacao.value), longa: s.neutralizacao.max > MAX_CASAS,
          pct: percentual(s.neutralizacao.value, s.neutralizacao.max), especial: s.neutralizacao.especial },
        ativacoes: verAtivacoes && !s.neutralizada ? await prepararAtivacoes(am) : [],
        saldo: saldoLista(s.saldo), temSaldo: s.saldoTotal > 0,
        primeiro: k === 0, ultimo: k === lista.length - 1
      });
    }

    const prontas = isGM ? motor.ativacoesProntas(c).length : 0;
    const pendentes = isGM ? motor.donosDePool(c).filter(d => d.system.temSaldoObrigatorio).map(d => d.name) : [];
    const meus = !isGM && presentes.some(p => p.meu && !p.fugiu);

    return {
      c, sys, cena, isGM, verAtivacoes,
      ativa: cena.ativa,
      faseRotulo: loc(S.FASES[cena.fase] ?? ""),
      ordem,
      dificuldade: loc(S.DIFICULDADES[sys.dificuldadeEfetiva]?.rotulo ?? ""),
      poolTexto: poolTexto(sys.pool, sys.extraDificuldade),
      saldo: saldoLista(sys.saldo), temSaldo: sys.saldoTotal > 0,
      conceito: sys.conceito,
      intencao: loc(S.INTENCOES[sys.intencao] ?? ""),
      condicionantes,
      ativacoes: verAtivacoes ? await prepararAtivacoes(c) : [],
      principais: objetivos.principal,
      secundarios: objetivos.secundario,
      ameacas,
      presentes,
      nPresentes: sys.presentesEfetivos,
      log: [...cena.log].reverse().slice(0, 12),
      prontas, pendentes: pendentes.join(", "),
      emAssimilador: cena.fase === "assimilador",
      podeTestar: meus && cena.ativa
    };
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  /** Dono (Conflito ou Ameaça) do elemento clicado. */
  #dono(target) {
    const id = target.closest("[data-dono]")?.dataset.dono;
    return (!id || id === this.conflito.id) ? this.conflito : game.actors.get(id);
  }

  #item(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.#dono(target)?.items.get(id);
  }

  static #proximaFase(event) {
    return motor.proximaFase(this.conflito, { forcar: event.shiftKey });
  }

  static async #rolarPools() {
    for ( const dono of motor.donosDePool(this.conflito) ) {
      if ( dono.system.totalDados ) await dono.rolarPool();
    }
  }

  static #rolarPool(event, target) {
    return this.#dono(target)?.rolarPool();
  }

  static #casaAtivacao(event, target) {
    const dono = this.#dono(target);
    const item = this.#item(target);
    if ( dono && item ) return motor.investirCasa(dono, item, target.dataset.s, Number(target.dataset.i));
  }

  static #disparar(event, target) {
    const dono = this.#dono(target);
    const item = this.#item(target);
    if ( dono && item ) return dono.dispararAtivacao(item, { forcar: event.shiftKey });
  }

  static #limpar(event, target) {
    return this.#item(target)?.update({ "system.progresso": { A: 0, B: 0, C: 0 } });
  }

  static #editarItem(event, target) {
    this.#item(target)?.sheet.render({ force: true });
  }

  /** GM: ajusta o progresso coletivo direto nas casas (sem atribuir a ninguém). */
  static async #casaObjetivo(event, target) {
    const obj = this.conflito.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if ( !obj ) return;
    const est = motor.estadoObjetivo(this.conflito, obj);
    const i = Number(target.dataset.i);
    const novo = (i <= est.atual) ? i - 1 : i;
    if ( est.ameaca ) return est.ameaca.update({ "system.neutralizacao.value": Math.max(0, novo) });
    return obj.update({ "system.progresso.total": Math.clamp(novo, 0, est.meta) });
  }

  /** GM: ajusta o progresso individual de um Infectado. */
  static async #casaObjetivoInd(event, target) {
    const obj = this.conflito.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const atorId = target.closest("[data-ator]")?.dataset.ator;
    if ( !obj || !atorId ) return;
    const atual = obj.system.contribuicoes[atorId] ?? 0;
    const i = Number(target.dataset.i);
    const novo = Math.clamp((i <= atual) ? i - 1 : i, 0, obj.system.meta);
    if ( novo === atual ) return;
    await obj.update({
      [`system.progresso.porInfectado.${atorId}`]: novo,
      "system.progresso.total": Math.max(0, obj.system.progresso.total + (novo - atual))
    });
    // Fuga individual concluída à mão também tira o Infectado da cena
    const c = this.conflito;
    if ( obj.system.fuga && (novo >= obj.system.meta) && !c.system.cena.fugiram.includes(atorId) ) {
      await motor.alternarFuga(c, atorId);
    }
  }

  static #retirarProgresso(event, target) {
    const obj = this.conflito.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const atorId = target.closest("[data-ator]")?.dataset.ator;
    if ( obj ) return motor.retirarProgresso(this.conflito, obj, { atorId, usarC: !event.shiftKey });
  }

  static async #casaNeutralizacao(event, target) {
    const am = game.actors.get(target.closest("[data-ameaca]")?.dataset.ameaca);
    if ( !am ) return;
    const i = Number(target.dataset.i);
    const atual = am.system.neutralizacao.value;
    return am.update({ "system.neutralizacao.value": Math.max(0, (i <= atual) ? i - 1 : i) });
  }

  static #alternarFuga(event, target) {
    return motor.alternarFuga(this.conflito, target.closest("[data-ator]")?.dataset.ator);
  }

  static #removerPresente(event, target) {
    return motor.removerPresente(this.conflito, target.closest("[data-ator]")?.dataset.ator);
  }

  static async #adicionarGrupo() {
    const ids = game.assimilacao.infectadosDoGrupo().map(a => a.id);
    return motor.definirPresentes(this.conflito, [...new Set([...this.conflito.system.cena.presentes, ...ids])]);
  }

  static #moverAmeaca(event, target) {
    return motor.moverAmeaca(this.conflito, target.closest("[data-ameaca]")?.dataset.ameaca, Number(target.dataset.passo));
  }

  static async #abrirFicha(event, target) {
    const doc = await fromUuid(target.closest("[data-uuid]")?.dataset.uuid);
    if ( doc?.testUserPermission(game.user, "LIMITED") ) doc.sheet.render({ force: true });
  }

  static #abrirTeste() {
    return game.assimilacao.abrirTeste({ emConflito: true });
  }

  static #iniciar() {
    return dialogoIniciar(this.conflito);
  }

  static #encerrar() {
    return dialogoEncerrar(this.conflito);
  }
}

/* -------------------------------------------- */
/*  Diálogos                                    */
/* -------------------------------------------- */

/**
 * Pergunta motivo, quem começa e quem está presente, e inicia o Conflito (p. 33, 69, 197).
 */
export async function dialogoIniciar(conflito) {
  if ( !game.user.isGM ) return null;
  const candidatos = game.actors.filter(a => ["infectado", "personagem"].includes(a.type))
    .sort((a, b) => (Number(b.hasPlayerOwner) - Number(a.hasPlayerOwner)) || a.name.localeCompare(b.name, "pt-BR"));
  const padrao = new Set(game.assimilacao.infectadosDoGrupo().map(a => a.id));
  const linhas = candidatos.map(a => `<label class="asm-check asm-presente-opcao">
      <input type="checkbox" name="presentes" value="${a.id}" ${padrao.has(a.id) ? "checked" : ""}>
      <img src="${esc(a.img)}" alt=""> ${esc(a.name)}</label>`).join("");
  const content = `<div class="asm-dialogo-iniciar">
    <div class="form-group"><label>${esc(loc("ASSIMILACAO.Partitura.motivo"))}</label>
      <div class="form-fields"><input type="text" name="motivo" placeholder="${esc(loc("ASSIMILACAO.Partitura.motivoDica"))}"></div></div>
    <div class="form-group"><label>${esc(loc("ASSIMILACAO.Partitura.quemComeca"))}</label>
      <div class="form-fields"><select name="iniciante">
        <option value="infectados">${esc(loc("ASSIMILACAO.Conflito.iniciante.infectados"))}</option>
        <option value="assimilador">${esc(loc("ASSIMILACAO.Conflito.iniciante.assimilador"))}</option>
      </select></div></div>
    <fieldset><legend>${esc(loc("ASSIMILACAO.Partitura.presentes"))}</legend>
      <div class="asm-presentes-opcoes">${linhas || `<p class="asm-nota">${esc(loc("ASSIMILACAO.Macro.semInfectados"))}</p>`}</div>
    </fieldset></div>`;
  const dados = await DialogV2.prompt({
    window: { title: fmt("ASSIMILACAO.Partitura.iniciar", { nome: conflito.name }), icon: "fa-solid fa-scroll" },
    classes: ["assimilacao"],
    position: { width: 460 },
    content,
    ok: {
      label: loc("ASSIMILACAO.Partitura.iniciarBotao"), icon: "fa-solid fa-play",
      callback: (event, button) => {
        const f = button.form;
        return {
          motivo: f.elements.motivo.value.trim(),
          iniciante: f.elements.iniciante.value,
          presentes: [...f.querySelectorAll('input[name="presentes"]:checked')].map(i => i.value)
        };
      }
    },
    rejectClose: false
  });
  if ( !dados ) return null;
  return motor.iniciar(conflito, dados);
}

/** Pergunta se é fim de cena para os presentes e se a partitura deve ser zerada, e encerra. */
export async function dialogoEncerrar(conflito) {
  if ( !game.user.isGM ) return null;
  const content = `<div class="asm-dialogo-encerrar">
    <p>${esc(loc("ASSIMILACAO.Partitura.encerrarPergunta"))}</p>
    <label class="asm-check"><input type="checkbox" name="fimDeCena" checked> ${esc(loc("ASSIMILACAO.Partitura.encerrarFimDeCena"))}</label>
    <label class="asm-check"><input type="checkbox" name="zerar"> ${esc(loc("ASSIMILACAO.Partitura.encerrarZerar"))}</label>
  </div>`;
  const dados = await DialogV2.prompt({
    window: { title: fmt("ASSIMILACAO.Partitura.encerrarTitulo", { nome: conflito.name }), icon: "fa-solid fa-flag-checkered" },
    classes: ["assimilacao"],
    content,
    ok: {
      label: loc("ASSIMILACAO.Partitura.encerrarBotao"), icon: "fa-solid fa-flag-checkered",
      callback: (event, button) => ({
        fimDeCena: button.form.elements.fimDeCena.checked,
        zerar: button.form.elements.zerar.checked
      })
    },
    rejectClose: false
  });
  if ( !dados ) return null;
  return motor.encerrar(conflito, dados);
}
