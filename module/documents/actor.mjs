import { MontarTeste } from "../apps/montar-teste.mjs";

/**
 * Actor do Assimilação: regras do Cabo de Guerra e da Saúde (seções 7 e 8).
 */
export class AtorAssimilacao extends Actor {

  /** @override */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    if ( this.type === "infectado" ) {
      this.updateSource({
        "prototypeToken.actorLink": true,
        "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "prototypeToken.bar1.attribute": "saude",
        "prototypeToken.bar2.attribute": "determinacao"
      });
    }
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

  /** Fim de cena: e recupera totalmente (p. 60). */
  async encerrarCena() {
    return this.update({ "system.assimilacao.value": this.system.assimilacao.max });
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
    return this.update(update);
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
