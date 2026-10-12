import { DadoSimbolo, htmlDaFace } from "./terms.mjs";

/**
 * Rolagem do Assimilação: guarda o contexto do teste, a escolha dos dados mantidos
 * e os ajustes (B gastos, penalidades), e renderiza o card de chat a partir desse estado.
 *
 * options:
 *  tipo: "acao" | "assimilada" | "dano" | "assimilacao" | "livre"
 *  ator: { uuid, nome, img }
 *  titulo, intencao
 *  manterMin, manterMax, mantidos: number[], travado: boolean
 *  emConflito: boolean, penalidadeA: number, exigeBB: boolean, nivelSaude: number
 *  custos: { d, e, origens: string[] }
 *  ajustes: { bAnulaC, bIgnoraPen, cDeterminacao }
 */
export class RolagemAssimilacao extends foundry.dice.Roll {
  static CHAT_TEMPLATE = "systems/assimilacao/templates/chat/rolagem.hbs";

  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);
    this.options.tipo ??= "livre";
    this.options.mantidos ??= [];
    this.options.ajustes = foundry.utils.mergeObject(
      { bAnulaC: 0, bIgnoraPen: 0, cDeterminacao: 0 }, this.options.ajustes ?? {}, { inplace: false });
    this.options.custos ??= { d: 0, e: 0, origens: [] };
  }

  /* -------------------------------------------- */
  /*  Dados e símbolos                            */
  /* -------------------------------------------- */

  /** Lista plana de todos os dados de símbolo rolados, na ordem. */
  get dadosSimbolo() {
    const lista = [];
    for ( const term of this.dice ) {
      if ( !(term instanceof DadoSimbolo) ) continue;
      const denom = term.constructor.DENOMINATION;
      term.results.forEach((r, i) => {
        if ( r.rerolled ) return;
        lista.push({
          indice: lista.length, term, resultado: r, indiceNoTermo: i,
          denom, face: r.result, simbolos: term.simbolos(r),
          origem: term.options.flavor ?? ""
        });
      });
    }
    return lista;
  }

  /** Quando todos os dados são mantidos (dano, Teste de Assimilação, pools do GM). */
  get mantemTodos() {
    return ["dano", "assimilacao", "livre", "pool"].includes(this.options.tipo) && !this.options.manterMax;
  }

  get limitesManter() {
    const n = this.dadosSimbolo.length;
    if ( this.mantemTodos ) return { min: n, max: n };
    const teto = game.settings?.get("assimilacao", "tetoMantidos") ?? CONFIG.ASSIMILACAO.TETO_MANTIDOS;
    const max = Math.min(n, this.options.manterMax ?? 1, teto || Infinity);
    const min = Math.min(max, Math.max(1, this.options.manterMin ?? 1));
    return { min, max };
  }

  /** Índices efetivamente mantidos. */
  get indicesMantidos() {
    if ( this.mantemTodos ) return this.dadosSimbolo.map(d => d.indice);
    return this.options.mantidos ?? [];
  }

  static somar(dados) {
    return dados.reduce((s, d) => ({ A: s.A + d.simbolos.A, B: s.B + d.simbolos.B, C: s.C + d.simbolos.C }),
      { A: 0, B: 0, C: 0 });
  }

  /** Símbolos brutos dos dados mantidos. */
  get simbolosMantidos() {
    const idx = new Set(this.indicesMantidos);
    return RolagemAssimilacao.somar(this.dadosSimbolo.filter(d => idx.has(d.indice)));
  }

  /** B pode anular C? Só em Ação Simples e fora da Rolagem Assimilada (p. 41). */
  get podeAnularC() {
    return (this.options.tipo === "acao") && !this.options.emConflito;
  }

  /** Resultado final depois dos ajustes. */
  get resultado() {
    const bruto = this.simbolosMantidos;
    const aj = this.options.ajustes;
    const pen = this.options.penalidadeA ?? 0;
    const penRestante = Math.max(0, pen - (this.options.exigeBB ? 0 : aj.bIgnoraPen));
    const ativou = !this.options.exigeBB || (aj.bIgnoraPen >= 2);
    const A = ativou ? Math.max(0, bruto.A - penRestante) : 0;
    const B = Math.max(0, bruto.B - aj.bAnulaC - aj.bIgnoraPen);
    const C = Math.max(0, bruto.C - aj.bAnulaC);
    return { bruto, A, B, C, penRestante, ativou };
  }

  /** Total numérico = A líquidos (útil para macros). */
  get total() {
    if ( !this._evaluated ) return undefined;
    if ( this.options.tipo === "dano" ) return super.total;
    if ( !this.options.travado && !this.mantemTodos ) return super.total;
    return this.resultado.A;
  }

  /* -------------------------------------------- */
  /*  Escolha dos dados mantidos                  */
  /* -------------------------------------------- */

  /**
   * Sugestão: maximiza A, depois minimiza C não anuláveis, depois maximiza B (seção 3.5, passo 3).
   * @returns {number[]}
   */
  sugerirMantidos() {
    const dados = this.dadosSimbolo;
    const { min, max } = this.limitesManter;
    const anula = this.podeAnularC;
    let melhor = null;
    let melhorChave = null;
    const comparar = (a, b) => {
      for ( let i = 0; i < a.length; i++ ) if ( a[i] !== b[i] ) return a[i] - b[i];
      return 0;
    };
    const combinar = (inicio, escolhidos, k) => {
      if ( escolhidos.length === k ) {
        const s = RolagemAssimilacao.somar(escolhidos.map(i => dados[i]));
        const cRestante = anula ? Math.max(0, s.C - s.B) : s.C;
        const bLivre = anula ? Math.max(0, s.B - s.C) : s.B;
        const chave = [s.A, -cRestante, bLivre, -k];
        if ( !melhorChave || comparar(chave, melhorChave) > 0 ) {
          melhorChave = chave;
          melhor = [...escolhidos];
        }
        return;
      }
      for ( let i = inicio; i < dados.length; i++ ) combinar(i + 1, [...escolhidos, i], k);
    };
    for ( let k = min; k <= max; k++ ) combinar(0, [], k);
    return melhor ?? [];
  }

  /** Marca resultados não mantidos como descartados (para o total e para o Dice So Nice). */
  aplicarDescartes() {
    if ( this.mantemTodos ) return;
    const idx = new Set(this.options.mantidos);
    for ( const d of this.dadosSimbolo ) {
      d.resultado.active = idx.has(d.indice);
      d.resultado.discarded = !idx.has(d.indice);
    }
    this._total = this._evaluateTotal();
  }

  /* -------------------------------------------- */
  /*  Renderização                                */
  /* -------------------------------------------- */

  /** @override */
  async _prepareChatRenderContext({ flavor, isPrivate = false, ...options } = {}) {
    const base = await super._prepareChatRenderContext({ flavor, isPrivate, ...options });
    const o = this.options;
    const mantidos = new Set(this.indicesMantidos);
    const { min, max } = this.limitesManter;
    const travado = o.travado || this.mantemTodos;
    const dados = this.dadosSimbolo.map(d => ({
      indice: d.indice,
      denom: d.denom,
      forma: CONFIG.ASSIMILACAO.DADOS[d.denom].forma,
      face: d.face,
      html: htmlDaFace(d.denom, d.face),
      origem: d.origem,
      mantido: mantidos.has(d.indice),
      descartado: travado && !mantidos.has(d.indice)
    }));
    const res = this.resultado;
    const isGM = game.user.isGM;
    const ehDono = isGM || (o.autor === game.user.id);
    const glifos = { q: "■", l: "◆", p: "⬟" };
    const contagem = {};
    for ( const d of this.dadosSimbolo ) contagem[d.denom] = (contagem[d.denom] ?? 0) + 1;
    const pool = ["q", "l", "p"].filter(k => contagem[k]).map(k => `${contagem[k]}${glifos[k]}`).join(" + ");
    const nivelC = Math.min(res.C, 6);
    return foundry.utils.mergeObject(base, {
      isPrivate,
      ator: o.ator ?? null,
      titulo: o.titulo ?? game.i18n.localize("ASSIMILACAO.Rolagem.titulo"),
      tipo: o.tipo,
      tipoRotulo: game.i18n.localize(`ASSIMILACAO.Rolagem.tipo.${o.tipo}`),
      intencao: o.intencao ?? "",
      pool,
      dados,
      min, max,
      selecionados: mantidos.size,
      travado,
      podeEscolher: !travado && ehDono,
      podeAjustar: travado && ehDono && !this.mantemTodos && (o.tipo !== "dano"),
      podeAnularC: this.podeAnularC && res.B > 0 && res.C > 0,
      podeIgnorarPen: res.penRestante > 0 && res.B > 0 && !o.exigeBB,
      podeAtivarBB: o.exigeBB && !res.ativou && (res.B >= 2),
      mostrarResultado: travado,
      ehDano: o.tipo === "dano",
      totalDano: o.tipo === "dano" ? (res.bruto.A + res.bruto.B + res.bruto.C) : 0,
      res,
      penalidadeA: o.penalidadeA ?? 0,
      exigeBB: !!o.exigeBB,
      ajustes: o.ajustes,
      custos: o.custos,
      emConflito: !!o.emConflito,
      consequencia: nivelC ? CONFIG.ASSIMILACAO.CONSEQUENCIAS[nivelC] : "",
      isGM,
      gmPodeAbaterD: isGM && travado && ["acao", "assimilada"].includes(o.tipo) && res.C > (o.ajustes.cDeterminacao ?? 0) && !!o.ator?.uuid,
      ehPool: o.tipo === "pool",
      simbolos: CONFIG.ASSIMILACAO.SIMBOLOS
    });
  }
}
