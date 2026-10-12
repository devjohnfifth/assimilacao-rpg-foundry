import { PoolData, inteiro, texto, html } from "./pool.mjs";

const f = foundry.data.fields;

/**
 * Ameaça — elemento com intenção própria num Conflito (p. 68–72, 194–225; seção 10 da especificação).
 * Rola o próprio pool, investe nas próprias Ativações e pode ser neutralizada.
 */
export class AmeacaData extends PoolData {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Ameaca"];

  static defineSchema() {
    return {
      interesses: texto(),
      ...this.camposPool(),
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
      descricao: html(),
      notas: html()
    };
  }

  /** @override */
  get tabelaBalanceamento() {
    return this.ehOProprioConflito ? "conflito" : "ameaca";
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const extras = Math.max(0, this.infectadosPresentes - 1);
    this.neutralizacao.max = this.neutralizacao.base + this.neutralizacao.porInfectado * extras;
    this.neutralizacao.value = Math.min(this.neutralizacao.value, Math.max(this.neutralizacao.max, 0));
    this.neutralizada = (this.neutralizacao.max > 0) && (this.neutralizacao.value >= this.neutralizacao.max);
  }
}
