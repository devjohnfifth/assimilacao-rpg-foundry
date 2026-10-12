const f = foundry.data.fields;

const inteiro = (initial, min, max) => new f.NumberField({ required: true, nullable: false, integer: true, min, max, initial });
const texto = () => new f.StringField({ required: true, blank: true, initial: "" });

/**
 * Ameaça — elemento com intenção própria num Conflito (p. 68–72, 194–225; seção 10 da especificação).
 * Rola o próprio pool, investe nas próprias Ativações e pode ser neutralizada.
 */
export class AmeacaData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Ameaca"];

  static defineSchema() {
    return {
      interesses: texto(),
      nivel: new f.StringField({ required: true, initial: "iniciante", choices: () => CONFIG.ASSIMILACAO.NIVEIS }),
      pool: new f.SchemaField({
        q: inteiro(2, 0, 30),
        l: inteiro(0, 0, 30),
        p: inteiro(0, 0, 30)
      }),
      infectadosPresentes: inteiro(1, 1, 12),
      ehOProprioConflito: new f.BooleanField({ initial: false }),
      neutralizacao: new f.SchemaField({
        base: inteiro(3, 0, 99),
        porInfectado: inteiro(0, 0, 30),
        value: inteiro(0, 0, 999),
        max: inteiro(3, 0, 999),
        especial: texto(),
        consequencia: texto()
      }),
      recompensas: texto(),
      descricao: new f.HTMLField({ required: true, blank: true, initial: "" }),
      notas: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    const S = CONFIG.ASSIMILACAO;
    const { q, l, p } = this.pool;
    this.valorPool = q * S.VALOR_DADO.q + l * S.VALOR_DADO.l + p * S.VALOR_DADO.p;
    this.totalDados = q + l + p;

    const extras = Math.max(0, this.infectadosPresentes - 1);
    this.neutralizacao.max = this.neutralizacao.base + this.neutralizacao.porInfectado * extras;
    this.neutralizacao.value = Math.min(this.neutralizacao.value, Math.max(this.neutralizacao.max, 0));
    this.neutralizada = (this.neutralizacao.max > 0) && (this.neutralizacao.value >= this.neutralizacao.max);

    const tabela = this.ehOProprioConflito ? S.BALANCEAMENTO.conflito : S.BALANCEAMENTO.ameaca;
    const [base, por] = tabela[this.nivel] ?? tabela.iniciante;
    this.recomendado = base + por * this.infectadosPresentes;
    const desvio = this.valorPool - this.recomendado;
    this.balanco = desvio === 0 ? "ok" : (Math.abs(desvio) <= 1 ? "perto" : (desvio > 0 ? "forte" : "fraco"));
  }
}
