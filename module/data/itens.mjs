const f = foundry.data.fields;

const inteiro = (initial, min, max) => new f.NumberField({ required: true, nullable: false, integer: true, min, max, initial });
const texto = () => new f.StringField({ required: true, blank: true, initial: "" });
const usos = () => new f.SchemaField({
  value: inteiro(0, 0, 99),
  max: inteiro(0, 0, 99),
  escopo: new f.StringField({ required: true, initial: "livre", choices: () => CONFIG.ASSIMILACAO.ESCOPOS })
});

/** Característica de Infectado (p. 84–89; Apêndice C). */
export class CaracteristicaData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Caracteristica"];
  static defineSchema() {
    return {
      custo: inteiro(1, 0, 10),
      requisitos: texto(),
      usos: usos(),
      descricao: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}

/** Equipamento ou Artefato (p. 94–98). */
export class EquipamentoData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Equipamento"];
  static defineSchema() {
    return {
      escassez: inteiro(0, 0, 12),
      qualidade: inteiro(3, 0, 6),
      cInvestidas: inteiro(0, 0, 20),
      local: new f.StringField({ required: true, initial: "mochila", choices: () => CONFIG.ASSIMILACAO.LOCAIS_INVENTARIO }),
      espacos: inteiro(1, 0, 4),
      artefato: new f.BooleanField({ initial: false }),
      caracteristicas: texto(),
      usos: usos(),
      descricao: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}

/** Mutação obtida pelo Baralho de Assimilações (p. 122–162; Apêndice A). */
export class MutacaoData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Mutacao"];
  static defineSchema() {
    return {
      naipe: new f.StringField({
        required: true, initial: "copas",
        choices: () => Object.fromEntries(Object.entries(CONFIG.ASSIMILACAO.NAIPES).map(([k, v]) => [k, v.rotulo]))
      }),
      carta: texto(),
      aspecto: texto(),
      custo: texto(),
      requisitoE: inteiro(0, 0, 10),
      cPressao: inteiro(0, 0, 10),
      usos: usos(),
      descricao: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}

/**
 * Ativação de uma Ameaça ou Conflito (p. 69, 196–225; seção 10.2 da especificação).
 * O custo é pago com os A, B e C rolados pelo(a) Assimilador(a); o progresso parcial fica registrado.
 */
export class AtivacaoData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Ativacao"];
  static defineSchema() {
    const simbolos = () => new f.SchemaField({ A: inteiro(0, 0, 30), B: inteiro(0, 0, 30), C: inteiro(0, 0, 30) });
    return {
      custo: simbolos(),
      progresso: simbolos(),
      dano: texto(),
      alvos: texto(),
      unicaVez: new f.BooleanField({ initial: false }),
      pagamentoIntegral: new f.BooleanField({ initial: false }),
      requerMunicao: new f.BooleanField({ initial: false }),
      disparos: inteiro(0, 0, 999),
      descricao: new f.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    const c = this.custo;
    const p = this.progresso;
    for ( const s of ["A", "B", "C"] ) p[s] = Math.min(p[s], c[s]);
    this.totalCusto = c.A + c.B + c.C;
    this.completa = (this.totalCusto > 0) && ["A", "B", "C"].every(s => p[s] >= c[s]);
    this.esgotada = this.unicaVez && (this.disparos > 0);
    this.custoTexto = "A".repeat(c.A) + "B".repeat(c.B) + "C".repeat(c.C);
  }
}
