/**
 * Assimilação RPG — sistema para Foundry VTT (v13+).
 * Ponto de entrada: registra configuração, dados, documentos, fichas e integrações.
 */
import { ASSIMILACAO } from "./config.mjs";
import { registrarTermos, DadoInstinto, DadoLosango, DadoAssimilado } from "./dice/terms.mjs";
import { RolagemAssimilacao } from "./dice/roll.mjs";
import { registrarChat } from "./dice/chat.mjs";
import { registrarDiceSoNice } from "./dice/dsn.mjs";
import { InfectadoData } from "./data/infectado.mjs";
import { PersonagemData } from "./data/personagem.mjs";
import { AmeacaData } from "./data/ameaca.mjs";
import { CaracteristicaData, EquipamentoData, MutacaoData, AtivacaoData } from "./data/itens.mjs";
import { AtorAssimilacao } from "./documents/actor.mjs";
import { ItemAssimilacao } from "./documents/item.mjs";
import { FichaInfectado } from "./sheets/infectado-sheet.mjs";
import { FichaItem } from "./sheets/item-sheet.mjs";
import { FichaAmeaca } from "./sheets/ameaca-sheet.mjs";
import { MontarTeste, executarTeste } from "./apps/montar-teste.mjs";
import { EscolherAtor } from "./apps/escolher-ator.mjs";
import { registrarEnricher } from "./helpers/enricher.mjs";
import * as api from "./helpers/api.mjs";

const SIS = "systems/assimilacao";

Hooks.once("init", () => {
  console.log("Assimilação | Inicializando o sistema");

  CONFIG.ASSIMILACAO = ASSIMILACAO;

  // Dados de símbolos
  registrarTermos();
  CONFIG.Dice.rolls.push(RolagemAssimilacao);

  // Documentos e modelos de dados
  CONFIG.Actor.documentClass = AtorAssimilacao;
  CONFIG.Item.documentClass = ItemAssimilacao;
  Object.assign(CONFIG.Actor.dataModels, {
    infectado: InfectadoData,
    personagem: PersonagemData,
    ameaca: AmeacaData
  });
  Object.assign(CONFIG.Item.dataModels, {
    caracteristica: CaracteristicaData,
    equipamento: EquipamentoData,
    mutacao: MutacaoData,
    ativacao: AtivacaoData
  });
  CONFIG.Actor.trackableAttributes = {
    infectado: { bar: ["saude", "determinacao", "assimilacao"], value: [] },
    personagem: { bar: ["saude", "determinacao", "assimilacao"], value: [] },
    ameaca: { bar: ["neutralizacao"], value: [] }
  };

  // Fichas
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, "assimilacao", FichaInfectado, {
    types: ["infectado", "personagem"], makeDefault: true, label: "ASSIMILACAO.Ficha.rotuloFicha"
  });
  DocumentSheetConfig.registerSheet(Actor, "assimilacao", FichaAmeaca, {
    types: ["ameaca"], makeDefault: true, label: "ASSIMILACAO.Ficha.rotuloAmeaca"
  });
  DocumentSheetConfig.registerSheet(Item, "assimilacao", FichaItem, {
    types: ["caracteristica", "equipamento", "mutacao", "ativacao"], makeDefault: true, label: "ASSIMILACAO.Ficha.rotuloItem"
  });

  // Configurações
  game.settings.register("assimilacao", "tetoMantidos", {
    name: "ASSIMILACAO.Config.tetoMantidos",
    hint: "ASSIMILACAO.Config.tetoMantidosDica",
    scope: "world", config: true, type: Number, default: 4,
    range: { min: 1, max: 10, step: 1 }
  });
  game.settings.register("assimilacao", "ornamentos", {
    name: "ASSIMILACAO.Config.ornamentos",
    hint: "ASSIMILACAO.Config.ornamentosDica",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: v => document.body.classList.toggle("asm-sem-ornamentos", !v)
  });

  // Fontes livres (seção 26.3 da especificação)
  Object.assign(CONFIG.fontDefinitions, {
    "Barlow Semi Condensed": { editor: true, fonts: [
      { urls: [`${SIS}/assets/fonts/barlow-semi-condensed-latin-500-normal.woff2`], weight: 500 },
      { urls: [`${SIS}/assets/fonts/barlow-semi-condensed-latin-600-normal.woff2`], weight: 600 },
      { urls: [`${SIS}/assets/fonts/barlow-semi-condensed-latin-700-normal.woff2`], weight: 700 }
    ] },
    "EB Garamond": { editor: true, fonts: [
      { urls: [`${SIS}/assets/fonts/eb-garamond-latin-400-normal.woff2`] },
      { urls: [`${SIS}/assets/fonts/eb-garamond-latin-400-italic.woff2`], style: "italic" },
      { urls: [`${SIS}/assets/fonts/eb-garamond-latin-600-normal.woff2`], weight: 600 },
      { urls: [`${SIS}/assets/fonts/eb-garamond-latin-700-normal.woff2`], weight: 700 }
    ] },
    "Grape Nuts": { editor: true, fonts: [{ urls: [`${SIS}/assets/fonts/grape-nuts-latin-400-normal.woff2`] }] },
    "Special Elite": { editor: true, fonts: [{ urls: [`${SIS}/assets/fonts/special-elite-latin-400-normal.woff2`] }] },
    "Rock Salt": { editor: true, fonts: [{ urls: [`${SIS}/assets/fonts/rock-salt-latin-400-normal.woff2`] }] }
  });

  // Templates e parciais
  foundry.applications.handlebars.loadTemplates({
    aptidao: `${SIS}/templates/actor/partes/aptidao.hbs`,
    faixaSaude: `${SIS}/templates/actor/partes/faixa-saude.hbs`
  });

  registrarEnricher();
  registrarChat();
  registrarDiceSoNice();

  // API pública para macros (ver o compêndio "Macros do Assimilação")
  game.assimilacao = {
    RolagemAssimilacao, MontarTeste, EscolherAtor, executarTeste,
    dados: { DadoInstinto, DadoLosango, DadoAssimilado },
    ...api,
    /** Roda a suíte de testes automáticos (GM). Ex.: game.assimilacao.testar() */
    async testar(opcoes = {}) {
      const { executar } = await import("./dev/testes.mjs");
      return executar(opcoes);
    }
  };
});

Hooks.once("ready", () => {
  if ( !game.settings.get("assimilacao", "ornamentos") ) document.body.classList.add("asm-sem-ornamentos");
  document.body.classList.add("sistema-assimilacao");
});
