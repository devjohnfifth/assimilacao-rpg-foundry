import { RolagemAssimilacao } from "../dice/roll.mjs";
import { estaNoConflito } from "../conflito/motor.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Diálogo "Montar Teste" (seção 3.5, passo 1).
 * Tudo que gasta recurso (Origem, d, e) é decidido aqui, antes de rolar (p. 57).
 */
export class MontarTeste extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, opcoes = {}, resolve = null) {
    super({});
    this.actor = actor;
    const S = CONFIG.ASSIMILACAO;
    const grupo = actor.system.constructor.grupoDe?.(opcoes.aptidao) ?? null;
    this.estado = {
      modo: opcoes.modo ?? "aptidao",
      instinto: opcoes.instinto ?? (grupo === "instintos" ? opcoes.aptidao : S.INSTINTOS[0]),
      aptidao: (grupo && grupo !== "instintos") ? opcoes.aptidao : (opcoes.aptidaoPadrao ?? ""),
      instinto2: S.INSTINTOS[0],
      origemEvento: false,
      origemOcupacao: false,
      empenho: false,
      // Num Conflito em andamento, quem está na cena testa "em Conflito" (B não anula C; A vão para Objetivos)
      emConflito: opcoes.emConflito ?? (estaNoConflito(actor) || !!game.combat?.started),
      extraQ: 0, extraL: 0, extraP: 0,
      manterExtra: 0,
      intencao: ""
    };
    if ( grupo === "instintos" && !opcoes.aptidaoPadrao ) this.estado.aptidao = "";
    this._resolve = resolve;
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["assimilacao", "montar-teste", "asm-papel"],
    window: { title: "ASSIMILACAO.Teste.titulo", icon: "fa-solid fa-dice", resizable: false },
    position: { width: 460, height: "auto" },
    form: { handler: MontarTeste.#aoEnviar, closeOnSubmit: false, submitOnChange: false },
    actions: { cancelar: MontarTeste.#aoCancelar }
  };

  /**
   * Três partes: os campos só são redesenhados quando o tipo de teste muda;
   * o resumo é redesenhado a cada mudança; o rodapé nunca (o clique em Rolar não pode cair num botão substituído).
   */
  static PARTS = {
    campos: { template: "systems/assimilacao/templates/apps/montar-teste-campos.hbs" },
    resumo: { template: "systems/assimilacao/templates/apps/montar-teste-resumo.hbs" },
    rodape: { template: "systems/assimilacao/templates/apps/montar-teste-rodape.hbs" }
  };

  get title() {
    return `${game.i18n.localize("ASSIMILACAO.Teste.titulo")}: ${this.actor?.name ?? ""}`;
  }

  /**
   * @returns {Promise<RolagemAssimilacao|null>}
   */
  static abrir(actor, opcoes = {}) {
    return new Promise(resolve => {
      const app = new this(actor, opcoes, resolve);
      app.render({ force: true });
    });
  }

  /* -------------------------------------------- */

  /** Calcula pool, limites de manutenção e custos a partir do estado. */
  calcular(estado = this.estado) {
    const S = CONFIG.ASSIMILACAO;
    const sys = this.actor.system;
    const loc = k => game.i18n.localize(k);
    const vInst = sys.instintos[estado.instinto] ?? 0;
    let q = 0, l = 0, p = 0;
    let titulo;
    const assimilada = estado.modo === "assimilada";
    if ( assimilada ) {
      const vInst2 = sys.instintos[estado.instinto2] ?? 0;
      p = vInst + vInst2;
      titulo = `${loc(`ASSIMILACAO.Aptidao.${estado.instinto}`)} + ${loc(`ASSIMILACAO.Aptidao.${estado.instinto2}`)}`;
    } else {
      q = vInst;
      const vApt = estado.aptidao ? sys.valorAptidao(estado.aptidao) : 0;
      l = vApt;
      titulo = loc(`ASSIMILACAO.Aptidao.${estado.instinto}`)
        + (estado.aptidao ? ` + ${loc(`ASSIMILACAO.Aptidao.${estado.aptidao}`)}` : "");
    }
    q += Number(estado.extraQ) || 0;
    l += Number(estado.extraL) || 0;
    p += Number(estado.extraP) || 0;

    const origens = [];
    if ( estado.origemEvento ) origens.push(loc("ASSIMILACAO.Origens.eventoMarcante"));
    if ( estado.origemOcupacao ) origens.push(loc("ASSIMILACAO.Origens.ocupacao"));

    // Mantidos: 1 base; +1 Rolagem Assimilada e +1 Empenho são obrigatórios; Origens podem ser descartadas (p. 41, 57, 64).
    const obrig = 1 + (assimilada ? 1 : 0) + (estado.empenho ? 1 : 0) + (Number(estado.manterExtra) || 0);
    const teto = game.settings.get("assimilacao", "tetoMantidos") || S.TETO_MANTIDOS;
    const totalDados = q + l + p;
    const manterMax = Math.min(obrig + origens.length, teto, totalDados);
    const manterMin = Math.min(obrig, manterMax);

    // Custos
    let custoD = estado.empenho ? 1 : 0;
    let custoE = 0;
    if ( assimilada ) {
      if ( sys.assimilacao.value >= 1 ) custoE = 1;
      else custoD += 2;
    }

    const avisos = [];
    if ( custoD > sys.determinacao.value ) avisos.push(loc("ASSIMILACAO.Teste.semD"));
    if ( estado.empenho && sys.suscetivel ) avisos.push(loc("ASSIMILACAO.Teste.suscetivel"));
    if ( custoD && sys.mutacaoPendente ) avisos.push(loc("ASSIMILACAO.Teste.dTravado"));
    if ( totalDados === 0 ) avisos.push(loc("ASSIMILACAO.Teste.semDados"));

    const glifos = [[q, "■"], [l, "◆"], [p, "⬟"]].filter(([n]) => n > 0).map(([n, g]) => `${n}${g}`).join(" + ");

    return {
      q, l, p, titulo, assimilada, origens, manterMin, manterMax, custoD, custoE, avisos,
      pool: glifos || "—",
      penalidadeA: sys.saude.penalidadeA,
      exigeBB: sys.saude.exigeBB,
      nivelSaude: sys.saude.nivel,
      podeRolar: (totalDados > 0) && (custoD <= sys.determinacao.value)
        && !(estado.empenho && sys.suscetivel) && !(custoD && sys.mutacaoPendente)
    };
  }

  /** @override */
  async _prepareContext(options) {
    const S = CONFIG.ASSIMILACAO;
    const sys = this.actor.system;
    const loc = k => game.i18n.localize(k);
    const opInst = Object.fromEntries(S.INSTINTOS.map(k => [k, `${loc(`ASSIMILACAO.Aptidao.${k}`)} (${sys.instintos[k]})`]));
    const opApt = {
      "": loc("ASSIMILACAO.Teste.semAptidao"),
      ...Object.fromEntries(S.CONHECIMENTOS.map(k => [k, `◆ ${loc(`ASSIMILACAO.Aptidao.${k}`)} (${sys.conhecimentos[k]})`])),
      ...Object.fromEntries(S.PRATICAS.map(k => [k, `◆ ${loc(`ASSIMILACAO.Aptidao.${k}`)} (${sys.praticas[k]})`]))
    };
    return {
      estado: this.estado,
      calc: this.calcular(),
      opInst,
      opApt,
      opModo: { aptidao: loc("ASSIMILACAO.Teste.modoAptidao"), assimilada: loc("ASSIMILACAO.Teste.modoAssimilada") },
      origens: sys.origens,
      sys
    };
  }

  /**
   * Atualiza o estado a cada mudança no formulário.
   * Texto livre (intenção) não redesenha nada; trocar o tipo de teste redesenha os campos;
   * o resto só atualiza o resumo, preservando o foco e o clique no botão Rolar.
   */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const fd = new foundry.applications.ux.FormDataExtended(this.element);
    const modoAntes = this.estado.modo;
    Object.assign(this.estado, fd.object);
    const campo = event.target?.name;
    if ( campo === "intencao" ) return;
    const partes = (this.estado.modo !== modoAntes) ? ["campos", "resumo"] : ["resumo"];
    this.render({ parts: partes });
  }

  static async #aoEnviar(event, form, formData) {
    if ( this._rolando ) return;
    Object.assign(this.estado, formData.object);
    const calc = this.calcular();
    if ( !calc.podeRolar ) {
      ui.notifications.warn(calc.avisos.join(" ") || game.i18n.localize("ASSIMILACAO.Teste.naoPode"));
      return;
    }
    this._rolando = true;
    try {
      const roll = await executarTeste(this.actor, this.estado, calc);
      this._resolve?.(roll);
      this._resolve = null;
      await this.close();
    } finally {
      this._rolando = false;
    }
  }

  static #aoCancelar() {
    this.close();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this._resolve?.(null);
  }
}

/**
 * Gasta os recursos, rola e envia o card ao chat.
 */
export async function executarTeste(actor, estado, calc) {
  const sys = actor.system;
  const termos = [];
  if ( calc.q ) termos.push(`${calc.q}dq[${game.i18n.localize("ASSIMILACAO.Teste.tagInstinto")}]`);
  if ( calc.l ) termos.push(`${calc.l}dl[${game.i18n.localize("ASSIMILACAO.Teste.tagAptidao")}]`);
  if ( calc.p ) termos.push(`${calc.p}dp[${game.i18n.localize(calc.assimilada ? "ASSIMILACAO.Teste.tagAssimilada" : "ASSIMILACAO.Teste.tagExtra")}]`);
  const formula = termos.join(" + ");

  // Recursos decididos antes de rolar
  const upd = {};
  if ( estado.origemEvento ) upd["system.origens.eventoMarcante.usado"] = true;
  if ( estado.origemOcupacao ) upd["system.origens.ocupacao.usado"] = true;
  if ( Object.keys(upd).length ) await actor.update(upd);
  if ( calc.custoE ) await actor.gastarAssimilacao(calc.custoE);
  if ( calc.custoD ) await actor.gastarDeterminacao(calc.custoD, { perda: false });

  const roll = new RolagemAssimilacao(formula, {}, {
    tipo: calc.assimilada ? "assimilada" : "acao",
    ator: { uuid: actor.uuid, nome: actor.name, img: actor.img },
    autor: game.user.id,
    titulo: calc.titulo,
    intencao: estado.intencao ?? "",
    manterMin: calc.manterMin,
    manterMax: calc.manterMax,
    mantidos: [],
    travado: false,
    emConflito: !!estado.emConflito,
    penalidadeA: calc.penalidadeA,
    exigeBB: calc.exigeBB,
    nivelSaude: calc.nivelSaude,
    custos: { d: calc.custoD, e: calc.custoE, origens: calc.origens },
    instinto: estado.instinto,
    aptidao: calc.assimilada ? estado.instinto2 : estado.aptidao
  });
  await roll.evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  return roll;
}
