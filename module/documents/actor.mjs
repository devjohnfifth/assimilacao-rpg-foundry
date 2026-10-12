import { MontarTeste } from "../apps/montar-teste.mjs";
import { RolagemAssimilacao } from "../dice/roll.mjs";
import { simbolosHTML } from "../helpers/enricher.mjs";
import { aplicarSaldo, conflitoAtivo, registrar } from "../conflito/motor.mjs";

/** Padrões do token por tipo de ator (aplicados só ao criar, sem sobrescrever o que já veio nos dados). */
const TOKEN_PADRAO = {
  infectado: { actorLink: true, disposition: "FRIENDLY", bar1: "saude", bar2: "determinacao" },
  personagem: { actorLink: false, disposition: "NEUTRAL", bar1: "saude", bar2: "determinacao" },
  ameaca: { actorLink: false, disposition: "HOSTILE", bar1: "neutralizacao", bar2: null },
  conflito: { actorLink: true, disposition: "HOSTILE", bar1: null, bar2: null }
};

/** Converte o texto de dano de uma Ativação em fórmula: "3◆", "2dl + 1dq" ou um número (dano fixo). */
export function formulaDeDano(texto) {
  const t = String(texto ?? "").trim();
  if ( !t ) return null;
  if ( /^\d+$/.test(t) ) return { fixo: Number(t) };
  const glifos = { "■": "q", "◆": "l", "⬟": "p" };
  const formula = t
    .replace(/(\d*)\s*([■◆⬟])/g, (m, n, g) => `${n || 1}d${glifos[g]}`)
    .replace(/(\d*)d([qlp])(?![a-z])/gi, (m, n, d) => `${n || 1}d${d.toLowerCase()}sim`);
  return { formula };
}

/**
 * Actor do Assimilação: regras do Cabo de Guerra e da Saúde (seções 7 e 8) e das Ameaças (seção 10).
 */
export class AtorAssimilacao extends Actor {

  static ICONES = {
    ameaca: "icons/svg/hazard.svg",
    conflito: "icons/svg/combat.svg"
  };

  /** @override */
  static getDefaultArtwork(actorData = {}) {
    const img = this.ICONES[actorData.type];
    if ( !img ) return super.getDefaultArtwork(actorData);
    return { img, texture: { src: img } };
  }

  /** @override */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    const padrao = TOKEN_PADRAO[this.type];
    if ( !padrao ) return;
    const tem = chave => foundry.utils.hasProperty(data, `prototypeToken.${chave}`);
    const upd = {};
    if ( !tem("actorLink") ) upd["prototypeToken.actorLink"] = padrao.actorLink;
    if ( !tem("disposition") ) upd["prototypeToken.disposition"] = CONST.TOKEN_DISPOSITIONS[padrao.disposition];
    if ( !tem("bar1.attribute") ) upd["prototypeToken.bar1.attribute"] = padrao.bar1;
    if ( !tem("bar2.attribute") ) upd["prototypeToken.bar2.attribute"] = padrao.bar2;
    this.updateSource(upd);
  }

  /** Todo Conflito novo já nasce com o Objetivo "Fuga" (p. 199, 208), editável. */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( (game.user.id !== userId) || (this.type !== "conflito") || options.asmSemFuga ) return;
    if ( this.items.some(i => i.type === "objetivo") ) return;
    this.createEmbeddedDocuments("Item", [{
      type: "objetivo", name: game.i18n.localize("ASSIMILACAO.Objetivo.fugaNome"),
      system: { categoria: "principal", fuga: true, acumulo: "individual", repeticao: "porInfectado", custo: { base: 2 } }
    }]);
  }

  /* -------------------------------------------- */
  /*  Ameaças                                     */
  /* -------------------------------------------- */

  /**
   * Rola o pool do Conflito ou da Ameaça, mantendo todos os dados (p. 70). Com dificuldade elevada
   * (p. 211), rola os ⬟ extras e o(a) GM escolhe no card quais manter (só a quantidade base).
   * Os símbolos mantidos vão para o saldo a investir.
   */
  async rolarPool() {
    if ( !["ameaca", "conflito"].includes(this.type) ) return null;
    const sys = this.system;
    const { q, l, p } = sys.pool;
    const termos = [];
    if ( q ) termos.push(`${q}dq`);
    if ( l ) termos.push(`${l}dl`);
    if ( p ) termos.push(`${p}dp`);
    if ( !termos.length ) {
      ui.notifications.warn(game.i18n.localize("ASSIMILACAO.Teste.semDados"));
      return null;
    }
    const extra = sys.extraDificuldade ?? 0;
    const opcoes = {
      tipo: "pool",
      autor: game.user.id,
      dono: this.uuid,
      ator: { uuid: this.uuid, nome: this.name, img: this.img },
      titulo: `${game.i18n.localize("ASSIMILACAO.Ameaca.pool")}: ${this.name}`
    };
    if ( extra ) {
      termos.push(`${extra}dp[${game.i18n.localize("ASSIMILACAO.Rolagem.tagDificuldade")}]`);
      Object.assign(opcoes, { manterMin: q + l + p, manterMax: q + l + p, mantidos: [], travado: false });
    }
    const roll = new RolagemAssimilacao(termos.join(" + "), {}, opcoes);
    await roll.evaluate();
    if ( roll.mantemTodos ) await aplicarSaldo(roll);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }) });
    return roll;
  }

  /**
   * "Se uma Ameaça é o único gerador do Conflito, ela se torna o próprio Conflito" (p. 197):
   * cria um Conflito com o pool e as Ativações dela, a Neutralização como Objetivo Principal e a Fuga.
   */
  async criarConflito() {
    if ( (this.type !== "ameaca") || !game.user.isGM ) return null;
    const s = this.system;
    const conflito = await Actor.create({
      name: this.name, type: "conflito", img: this.img, folder: this.folder?.id ?? null,
      system: {
        conceito: s.interesses, nivel: s.nivel, pool: { ...s.pool },
        infectadosPresentes: s.infectadosPresentes, dificuldade: s.dificuldade,
        recompensas: s.recompensas, descricao: s.descricao
      }
    });
    if ( !conflito ) return null;
    const zero = { A: 0, B: 0, C: 0 };
    const ativacoes = this.items.filter(i => i.type === "ativacao").map(i => {
      const dados = i.toObject();
      delete dados._id;
      dados.system.progresso = zero;
      dados.system.disparos = 0;
      return dados;
    });
    const esc = t => foundry.utils.escapeHTML(String(t ?? ""));
    const neutralizar = {
      type: "objetivo",
      name: game.i18n.format("ASSIMILACAO.Partitura.neutralizar", { nome: this.name }),
      system: {
        categoria: "principal",
        custo: { base: s.neutralizacao.base, porInfectadoExtra: s.neutralizacao.porInfectado },
        restricao: s.neutralizacao.especial,
        descricao: s.neutralizacao.consequencia ? `<p>${esc(s.neutralizacao.consequencia)}</p>` : ""
      }
    };
    await conflito.createEmbeddedDocuments("Item", [...ativacoes, neutralizar]);
    await this.update({ "system.ehOProprioConflito": true });
    return conflito;
  }

  /**
   * Dispara uma Ativação completa: anuncia no chat, rola o dano (se houver) e zera o progresso.
   * @param {Item} ativacao
   * @param {object} [opts]  { forcar: dispara mesmo sem o custo completo (GM) }
   */
  async dispararAtivacao(ativacao, { forcar = false } = {}) {
    const sys = ativacao?.system;
    if ( !sys || (ativacao.type !== "ativacao") ) return null;
    if ( sys.esgotada ) return ui.notifications.warn(game.i18n.localize("ASSIMILACAO.Ativacao.esgotada"));
    if ( !sys.completa && !forcar ) return ui.notifications.warn(game.i18n.localize("ASSIMILACAO.Ativacao.incompleta"));
    const esc = t => foundry.utils.escapeHTML(String(t ?? ""));
    const efeito = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.descricao, { relativeTo: ativacao });
    const fixo = formulaDeDano(sys.dano)?.fixo ?? 0;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="asm-card asm-papel ativacao-card">
        <header class="asm-card-cabecalho">
          <img class="asm-card-retrato" src="${esc(this.img)}" alt="">
          <div class="asm-card-titulos">
            <span class="asm-etiqueta">${esc(game.i18n.localize("ASSIMILACAO.Ativacao.disparou"))}</span>
            <h3>${esc(ativacao.name)}</h3>
            <span class="asm-card-pool">${simbolosHTML(sys.custoTexto).outerHTML}</span>
          </div>
        </header>
        ${sys.alvos ? `<p class="asm-nota"><strong>${esc(game.i18n.localize("ASSIMILACAO.Ativacao.FIELDS.alvos.label"))}:</strong> ${esc(sys.alvos)}</p>` : ""}
        ${fixo ? `<p class="asm-dano-fixo"><strong>${esc(game.i18n.format("ASSIMILACAO.Ativacao.danoFixo", { n: fixo }))}</strong></p>` : ""}
        <div class="asm-card-texto">${efeito}</div>
      </div>`
    });
    const dano = formulaDeDano(sys.dano);
    const avisarDano = () => ui.notifications.warn(game.i18n.format("ASSIMILACAO.Ativacao.danoInvalido", { formula: sys.dano }));
    if ( dano?.formula && !RolagemAssimilacao.validate(dano.formula) ) avisarDano();
    else if ( dano?.formula ) {
      try {
        const roll = new RolagemAssimilacao(dano.formula, {}, {
          tipo: "dano", autor: game.user.id,
          ator: { uuid: this.uuid, nome: this.name, img: this.img },
          titulo: `${ativacao.name}: ${game.i18n.localize("ASSIMILACAO.Rolagem.tipo.dano")}`
        });
        await roll.evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }) });
      } catch(err) {
        avisarDano();
        console.warn(err);
      }
    }
    await ativacao.update({ "system.progresso": { A: 0, B: 0, C: 0 }, "system.disparos": sys.disparos + 1 });
    const conflito = conflitoAtivo();
    if ( conflito && ((conflito.id === this.id) || conflito.system.ameacas.includes(this.id)) ) {
      await registrar(conflito, game.i18n.format("ASSIMILACAO.Partitura.logDisparou", { nome: ativacao.name, dono: this.name }));
    }
    return ativacao;
  }

  /* -------------------------------------------- */
  /*  Testes                                      */
  /* -------------------------------------------- */

  /**
   * Abre o diálogo "Montar Teste".
   * @param {object} [opcoes]  { instinto, aptidao, modo }
   */
  async rolarTeste(opcoes = {}) {
    return MontarTeste.abrir(this, opcoes);
  }

  /* -------------------------------------------- */
  /*  Cabo de Guerra                              */
  /* -------------------------------------------- */

  /**
   * Gasta pontos de Determinação. Com 0 d, uma nova perda reduz D em 1 e aumenta E em 1 (p. 59–60).
   * @param {number} n
   * @param {object} [opts]  { motivo, perda: true se for dano/golpe emocional (pode baixar o nível) }
   */
  async gastarDeterminacao(n = 1, { motivo = "", perda = true } = {}) {
    const sys = this.system;
    let d = sys.determinacao.value;
    let D = sys.determinacao.nivel;
    let e = sys.assimilacao.value;
    let perdeuNivel = 0;
    for ( let i = 0; i < n; i++ ) {
      if ( d > 0 ) d -= 1;
      else if ( perda && (D > 0) ) {
        D -= 1;
        perdeuNivel += 1;
        // Nova reserva de d começa cheia (travada até a mutação); o novo e fica disponível na hora.
        d = D;
        e += 1;
      }
    }
    const update = {
      "system.determinacao.nivel": D,
      "system.determinacao.value": Math.min(d, D),
      "system.assimilacao.value": Math.min(e, 10 - D)
    };
    if ( perdeuNivel ) update["system.mutacaoPendente"] = true;
    await this.update(update);
    if ( perdeuNivel ) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="asm-card asm-papel aviso-cabo"><h3>${game.i18n.localize("ASSIMILACAO.Cabo.perdeuNivelTitulo")}</h3>
          <p>${game.i18n.format("ASSIMILACAO.Cabo.perdeuNivel", { nome: this.name, D, E: 10 - D })}</p>
          ${motivo ? `<p class="asm-nota">${motivo}</p>` : ""}</div>`
      });
    }
    return { d, D, perdeuNivel };
  }

  async recuperarDeterminacao(n = 1) {
    const sys = this.system;
    return this.update({ "system.determinacao.value": Math.min(sys.determinacao.nivel, sys.determinacao.value + n) });
  }

  async gastarAssimilacao(n = 1) {
    const sys = this.system;
    if ( sys.assimilacao.value >= n ) return this.update({ "system.assimilacao.value": sys.assimilacao.value - n });
    // Sem e: 2 d por e (p. 60)
    const faltam = n - sys.assimilacao.value;
    await this.update({ "system.assimilacao.value": 0 });
    return this.gastarDeterminacao(faltam * 2, { perda: false });
  }

  /**
   * Renova os usos dos itens cujo escopo está na lista (seção 15 da especificação).
   * @param {string[]} escopos  ex.: ["rodada", "cena"]
   */
  async renovarUsos(escopos) {
    const updates = this.items
      .filter(i => i.system.usos && escopos.includes(i.system.usos.escopo) && (i.system.usos.max > 0)
        && (i.system.usos.value !== i.system.usos.max))
      .map(i => ({ _id: i.id, "system.usos.value": i.system.usos.max }));
    if ( updates.length ) await this.updateEmbeddedDocuments("Item", updates);
    return updates.length;
  }

  /** Fim de cena: e recupera totalmente (p. 60) e renovam os usos por rodada e por cena. */
  async encerrarCena() {
    await this.update({ "system.assimilacao.value": this.system.assimilacao.max });
    await this.renovarUsos(["rodada", "cena"]);
    return this;
  }

  /** Nova sessão: as Origens voltam a poder ser usadas e renovam os usos por sessão. */
  async novaSessao() {
    await this.update({
      "system.origens.eventoMarcante.usado": false,
      "system.origens.ocupacao.usado": false
    });
    await this.renovarUsos(["sessao"]);
    return this;
  }

  /** Repouso completo em boas condições: recupera 1 + Resolução d (p. 61) e uma Recuperação de Saúde se elegível. */
  async repousoCompleto({ saude = true } = {}) {
    const sys = this.system;
    const update = {
      "system.determinacao.value": Math.min(sys.determinacao.nivel, sys.determinacao.value + 1 + sys.instintos.resolucao),
      "system.assimilacao.value": sys.assimilacao.max
    };
    if ( saude && (sys.saude.nivel >= 5) ) {
      update["system.saude.dano"] = Math.max(0, sys.saude.dano - sys.saude.recuperacaoPorVez);
    }
    await this.update(update);
    await this.renovarUsos(["rodada", "cena", "repouso"]);
    return this;
  }

  /* -------------------------------------------- */
  /*  Saúde                                       */
  /* -------------------------------------------- */

  /** Aplica dano em pontos de Saúde, consumindo primeiro os temporários (p. 66). */
  async aplicarDano(n) {
    const sys = this.system;
    let resto = n;
    const temp = Math.min(sys.saude.temporarios, resto);
    resto -= temp;
    return this.update({
      "system.saude.temporarios": sys.saude.temporarios - temp,
      "system.saude.dano": Math.min(sys.saude.max, sys.saude.dano + resto)
    });
  }

  async curar(n) {
    return this.update({ "system.saude.dano": Math.max(0, this.system.saude.dano - n) });
  }
}
