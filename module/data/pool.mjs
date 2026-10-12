const f = foundry.data.fields;

export const inteiro = (initial, min, max) => new f.NumberField({ required: true, nullable: false, integer: true, min, max, initial });
export const texto = () => new f.StringField({ required: true, blank: true, initial: "" });
export const html = () => new f.HTMLField({ required: true, blank: true, initial: "" });

/** { A, B, C } inteiros. */
export const simbolosCampo = (max = 99) => new f.SchemaField({ A: inteiro(0, 0, max), B: inteiro(0, 0, max), C: inteiro(0, 0, max) });

/**
 * Base comum de quem rola um pool e investe nas próprias Ativações: Conflito e Ameaça (seções 3.7 e 10).
 * `saldo` guarda os A, B e C rolados que ainda não foram investidos; `turno` guarda o que foi investido
 * no turno atual (para devolver ao saldo se o(a) GM desmarcar uma casa).
 */
export class PoolData extends foundry.abstract.TypeDataModel {

  /** Tabela de balanceamento usada por padrão ("conflito" ou "ameaca"). */
  static TABELA = "ameaca";

  static camposPool() {
    return {
      nivel: new f.StringField({ required: true, initial: "iniciante", choices: () => CONFIG.ASSIMILACAO.NIVEIS }),
      pool: new f.SchemaField({
        q: inteiro(2, 0, 30),
        l: inteiro(0, 0, 30),
        p: inteiro(0, 0, 30)
      }),
      infectadosPresentes: inteiro(1, 1, 12),
      dificuldade: new f.StringField({
        required: true, blank: true, initial: "",
        choices: () => Object.fromEntries(Object.entries(CONFIG.ASSIMILACAO.DIFICULDADES).map(([k, v]) => [k, v.rotulo]))
      }),
      saldo: simbolosCampo(),
      turno: simbolosCampo()
    };
  }

  /** Tabela de balanceamento efetiva. */
  get tabelaBalanceamento() {
    return this.constructor.TABELA;
  }

  /** Quantos Infectados contam para custos e balanceamento. */
  get presentesEfetivos() {
    return this.infectadosPresentes;
  }

  /** Dificuldade efetiva: a do próprio pool ou, em branco, a do mundo. */
  get dificuldadeEfetiva() {
    if ( this.dificuldade ) return this.dificuldade;
    try { return game.settings.get("assimilacao", "dificuldade") || "exploracao"; }
    catch { return "exploracao"; }
  }

  /** @override */
  prepareDerivedData() {
    const S = CONFIG.ASSIMILACAO;
    const { q, l, p } = this.pool;
    this.valorPool = q * S.VALOR_DADO.q + l * S.VALOR_DADO.l + p * S.VALOR_DADO.p;
    this.totalDados = q + l + p;
    this.extraDificuldade = S.DIFICULDADES[this.dificuldadeEfetiva]?.extra ?? 0;
    this.saldoTotal = this.saldo.A + this.saldo.B + this.saldo.C;
    this.temSaldoObrigatorio = (this.saldo.A + this.saldo.C) > 0;

    const n = this.presentesEfetivos;
    const tabela = S.BALANCEAMENTO[this.tabelaBalanceamento];
    const [base, por] = tabela[this.nivel] ?? tabela.iniciante;
    this.recomendado = base + por * n;
    const desvio = this.valorPool - this.recomendado;
    this.balanco = desvio === 0 ? "ok" : (Math.abs(desvio) <= 1 ? "perto" : (desvio > 0 ? "forte" : "fraco"));
  }
}
