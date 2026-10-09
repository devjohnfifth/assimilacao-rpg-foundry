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
      naipe: new f.StringField({ required: true, initial: "copas", choices: () => CONFIG.ASSIMILACAO.NAIPES }),
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
