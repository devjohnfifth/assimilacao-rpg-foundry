import { PoolData, inteiro, texto, html } from "./pool.mjs";

const f = foundry.data.fields;
const ids = () => new f.ArrayField(new f.StringField({ required: true, blank: false }));

/**
 * Conflito — a partitura de uma cena por turnos (p. 68–72, 194–225; seção 10 da especificação).
 * Tem pool próprio, Ativações, Objetivos e Condicionantes (itens embutidos) e as Ameaças vinculadas.
 * O estado da cena em andamento (rodada, fase, presentes, quem fugiu) fica em `cena`.
 */
export class ConflitoData extends PoolData {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Conflito"];
  static TABELA = "conflito";

  static defineSchema() {
    const pool = this.camposPool();
    pool.pool = new f.SchemaField({ q: inteiro(2, 0, 30), l: inteiro(1, 0, 30), p: inteiro(0, 0, 30) });
    return {
      conceito: texto(),
      intencao: new f.StringField({ required: true, initial: "hostil", choices: () => CONFIG.ASSIMILACAO.INTENCOES }),
      escala: new f.StringField({ required: true, initial: "simples", choices: () => CONFIG.ASSIMILACAO.ESCALAS }),
      ...pool,
      duracaoRodada: texto(),
      recompensaXP: inteiro(1, 0, 6),
      recompensas: texto(),
      aberta: new f.BooleanField({ initial: false }),
      ameacas: ids(),
      cena: new f.SchemaField({
        ativa: new f.BooleanField({ initial: false }),
        rodada: inteiro(0, 0, 999),
        fase: new f.StringField({ required: true, initial: "preparacao", choices: () => CONFIG.ASSIMILACAO.FASES }),
        iniciante: new f.StringField({ required: true, initial: "infectados", choices: {
          infectados: "ASSIMILACAO.Conflito.iniciante.infectados",
          assimilador: "ASSIMILACAO.Conflito.iniciante.assimilador"
        } }),
        motivo: texto(),
        presentes: ids(),
        fugiram: ids(),
        log: new f.ArrayField(new f.SchemaField({ rodada: inteiro(0, 0, 999), texto: texto() }))
      }),
      descricao: html(),
      notas: html()
    };
  }

  /** IDs dos Infectados que ainda estão na cena (presentes que não fugiram). */
  get naCena() {
    const c = this.cena;
    return c.presentes.filter(id => !c.fugiram.includes(id));
  }

  /** @override — na cena, contam os presentes que não fugiram (p. 199). */
  get presentesEfetivos() {
    const c = this.cena;
    if ( c.ativa && c.presentes.length ) return Math.max(1, this.naCena.length);
    return this.infectadosPresentes;
  }
}
