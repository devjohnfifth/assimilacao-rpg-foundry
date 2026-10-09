const f = foundry.data.fields;

const nivel = (initial, min, max) => new f.NumberField({ required: true, nullable: false, integer: true, min, max, initial });
const texto = () => new f.StringField({ required: true, blank: true, initial: "" });

function grupoAptidoes(chaves, inicial, min) {
  return new f.SchemaField(Object.fromEntries(chaves.map(k => [k, nivel(inicial, min, 9)])));
}

/**
 * Infectado(a): personagem jogador(a). Seções 5 a 8 da especificação.
 */
export class InfectadoData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Infectado"];

  static defineSchema() {
    const { INSTINTOS, CONHECIMENTOS, PRATICAS } = CONFIG.ASSIMILACAO;
    return {
      conceito: texto(),
      geracao: new f.StringField({ required: true, initial: "pos", choices: () => CONFIG.ASSIMILACAO.GERACOES }),
      idade: new f.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null }),
      origens: new f.SchemaField({
        eventoMarcante: new f.SchemaField({ texto: texto(), usado: new f.BooleanField({ initial: false }) }),
        ocupacao: new f.SchemaField({ texto: texto(), usado: new f.BooleanField({ initial: false }) })
      }),
      propositos: new f.SchemaField({
        pessoal1: texto(),
        pessoal2: texto(),
        coletivo: texto()
      }),
      instintos: grupoAptidoes(INSTINTOS, 1, 1),
      conhecimentos: grupoAptidoes(CONHECIMENTOS, 0, 0),
      praticas: grupoAptidoes(PRATICAS, 0, 0),
      determinacao: new f.SchemaField({
        nivel: nivel(9, 0, 10),
        value: nivel(9, 0, 10),
        max: nivel(9, 0, 10)
      }),
      assimilacao: new f.SchemaField({
        value: nivel(1, 0, 10),
        max: nivel(1, 0, 10)
      }),
      saude: new f.SchemaField({
        dano: nivel(0, 0, 999),
        temporarios: nivel(0, 0, 99),
        bonusPorNivel: nivel(0, -5, 10),
        value: nivel(0, 0, 999),
        max: nivel(0, 0, 999)
      }),
      cInoportunas: nivel(0, 0, 10),
      cNeutralizadas: nivel(0, 0, 10),
      mutacaoPendente: new f.BooleanField({ initial: false }),
      cicatrizes: texto(),
      inventario: new f.SchemaField({
        corpo: nivel(3, 0, 20),
        mochila: nivel(6, 0, 40)
      }),
      experiencia: new f.SchemaField({
        total: nivel(0, 0, 9999),
        gasta: nivel(0, 0, 9999)
      }),
      biografia: new f.HTMLField({ required: true, blank: true, initial: "" }),
      notas: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    const S = CONFIG.ASSIMILACAO;

    // Cabo de Guerra: D + E = 10 (p. 58)
    const D = this.determinacao.nivel;
    const E = S.CABO_TOTAL - D;
    this.determinacao.max = D;
    this.determinacao.value = Math.min(this.determinacao.value, D);
    this.assimilacao.nivel = E;
    this.assimilacao.max = E;
    this.assimilacao.value = Math.min(this.assimilacao.value, E);
    this.suscetivel = this.determinacao.value === 0;

    // Saúde: 6 níveis de (1 + Potência + Resolução) pontos (p. 52, 82)
    const porNivel = Math.max(1, 1 + this.instintos.potencia + this.instintos.resolucao + this.saude.bonusPorNivel);
    const totalMax = porNivel * 6;
    const dano = Math.min(this.saude.dano, totalMax);
    this.saude.porNivel = porNivel;
    this.saude.max = totalMax;
    this.saude.value = totalMax - dano;
    this.saude.morto = dano >= totalMax;
    this.saude.nivel = this.saude.morto ? 0 : 6 - Math.floor(dano / porNivel);
    this.saude.pontosNoNivel = this.saude.morto ? 0 : porNivel - (dano % porNivel);
    const info = S.SAUDE[this.saude.nivel] ?? {};
    this.saude.nome = this.saude.morto ? game.i18n.localize("ASSIMILACAO.Saude.morto") : info.nome;
    this.saude.penalidadeA = info.penalidadeA ?? 0;
    this.saude.exigeBB = !!info.exigeBB;
    this.saude.recuperacaoPorVez = 1 + this.instintos.potencia;

    // Inventário
    this.inventario.total = this.inventario.corpo + this.inventario.mochila;

    // Experiência
    this.experiencia.disponivel = this.experiencia.total - this.experiencia.gasta;
  }

  /** Valor de uma Aptidão pela chave (instinto, conhecimento ou prática). */
  valorAptidao(chave) {
    for ( const grupo of ["instintos", "conhecimentos", "praticas"] ) {
      if ( chave in this[grupo] ) return this[grupo][chave];
    }
    return 0;
  }

  static grupoDe(chave) {
    const S = CONFIG.ASSIMILACAO;
    if ( S.INSTINTOS.includes(chave) ) return "instintos";
    if ( S.CONHECIMENTOS.includes(chave) ) return "conhecimentos";
    if ( S.PRATICAS.includes(chave) ) return "praticas";
    return null;
  }
}
