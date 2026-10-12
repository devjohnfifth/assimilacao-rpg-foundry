import { InfectadoData } from "./infectado.mjs";

const f = foundry.data.fields;
const texto = () => new f.StringField({ required: true, blank: true, initial: "" });

/**
 * Personagem do(a) Assimilador(a) — NPC (seção 11 da especificação).
 * Mesma estrutura do Infectado, mais a relação com o grupo, campos só do GM
 * e um modo simplificado para figurantes (só Aptidões, Saúde e Cabo de Guerra).
 */
export class PersonagemData extends InfectadoData {
  static LOCALIZATION_PREFIXES = ["ASSIMILACAO.Infectado", "ASSIMILACAO.Personagem"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      relacao: new f.StringField({ required: true, initial: "neutro", choices: () => CONFIG.ASSIMILACAO.RELACOES }),
      grupo: texto(),
      simplificado: new f.BooleanField({ initial: false }),
      segredos: new f.SchemaField({
        motivacao: texto(),
        propositoAntagonista: texto(),
        notas: new f.HTMLField({ required: true, blank: true, initial: "" })
      })
    };
  }
}
