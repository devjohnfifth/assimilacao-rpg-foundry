/**
 * Suíte de testes automáticos do sistema, executada dentro do Foundry.
 * Uso (macro ou console, como GM):  game.assimilacao.testar()
 * Cria um ator e mensagens temporários, verifica regras, interface e textos,
 * e publica um relatório no chat e no diário "Relatório de testes — Assimilação".
 */
import { DadoSimbolo, DadoInstinto, DadoLosango, DadoAssimilado, simbolosDaFace } from "../dice/terms.mjs";
import { RolagemAssimilacao } from "../dice/roll.mjs";
import { MontarTeste, executarTeste } from "../apps/montar-teste.mjs";
import { FichaInfectado } from "../sheets/infectado-sheet.mjs";
import { FichaItem } from "../sheets/item-sheet.mjs";

const PREFIXO = "[TESTE]";

/* -------------------------------------------- */
/*  Utilidades                                  */
/* -------------------------------------------- */

const espera = ms => new Promise(r => setTimeout(r, ms));

async function ate(cond, { timeout = 4000, passo = 50 } = {}) {
  const t0 = Date.now();
  while ( Date.now() - t0 < timeout ) {
    try { if ( await cond() ) return true; } catch(e) { /* tenta de novo */ }
    await espera(passo);
  }
  return false;
}

/** Clica e espera a ficha renderizar de novo. */
async function clicarEsperar(app, seletor) {
  const el = app.element?.querySelector(seletor);
  if ( !el ) return false;
  const nome = `render${app.constructor.name}`;
  const renderizou = new Promise(r => Hooks.once(nome, r));
  el.click();
  await Promise.race([renderizou, espera(3000)]);
  await espera(30);
  return true;
}

/** Força as faces dos próximos dados de símbolo rolados (na ordem). */
async function comFaces(faces, fn) {
  const fila = [...faces];
  DadoSimbolo.prototype._roll = async function() {
    const f = fila.shift();
    return f ?? undefined;
  };
  try { return await fn(); }
  finally { delete DadoSimbolo.prototype._roll; }
}

const SEM_CHAVE = /(ASSIMILACAO\.[A-Za-z][\w.]*|TYPES\.(Actor|Item)\.\w+)/g;
function chavesCruas(html) {
  return [...new Set((html.match(SEM_CHAVE) ?? []))];
}

class Suite {
  constructor() {
    this.resultados = [];
    this.secao = "";
  }
  grupo(nome) { this.secao = nome; }
  ok(cond, descricao, detalhe = "") {
    this.resultados.push({ secao: this.secao, ok: !!cond, descricao, detalhe: cond ? "" : String(detalhe) });
    return !!cond;
  }
  igual(obtido, esperado, descricao) {
    const a = JSON.stringify(obtido);
    const b = JSON.stringify(esperado);
    return this.ok(a === b, descricao, `obtido ${a}, esperado ${b}`);
  }
  async tentar(descricao, fn) {
    try { await fn(); }
    catch(err) {
      console.error(err);
      this.ok(false, descricao, `${err.name}: ${err.message}`);
    }
  }
}

/* -------------------------------------------- */
/*  Execução                                    */
/* -------------------------------------------- */

export async function executar({ limpar = true } = {}) {
  if ( !game.user.isGM ) return ui.notifications.warn("Os testes precisam ser rodados pelo(a) GM.");
  const s = new Suite();
  const criados = { atores: [], mensagens: [] };
  const errosConsole = [];
  const consoleErrorOriginal = console.error;
  console.error = (...args) => {
    errosConsole.push(args.map(a => a?.stack ?? a?.message ?? String(a)).join(" "));
    consoleErrorOriginal.apply(console, args);
  };
  const aoErro = ev => errosConsole.push(`window.error: ${ev.message}`);
  const aoRejeitar = ev => errosConsole.push(`unhandledrejection: ${ev.reason?.message ?? ev.reason}`);
  window.addEventListener("error", aoErro);
  window.addEventListener("unhandledrejection", aoRejeitar);
  const tetoOriginal = game.settings.get("assimilacao", "tetoMantidos");
  const idsMsgAntes = new Set(game.messages.map(m => m.id));
  ui.notifications.info("Assimilação: rodando os testes automáticos…");
  const t0 = performance.now();

  try {
    await testarRegistro(s);
    await testarDados(s);
    await testarRolagem(s, criados);
    const ator = await testarAtor(s, criados);
    if ( ator ) {
      await testarFicha(s, ator, criados);
      await testarItens(s, ator);
      await testarMontarTeste(s, ator, criados);
      await testarCard(s, ator, criados);
      await testarExtras(s, ator, criados);
    }
    await testarTextos(s);
  } catch(err) {
    console.error(err);
    s.ok(false, "Execução interrompida por erro inesperado", `${err.name}: ${err.message}`);
  } finally {
    await game.settings.set("assimilacao", "tetoMantidos", tetoOriginal);
    window.removeEventListener("error", aoErro);
    window.removeEventListener("unhandledrejection", aoRejeitar);
    console.error = consoleErrorOriginal;
  }

  s.grupo("Console");
  const errosRelevantes = errosConsole.filter(e => !/deleteDialog|DialogV2/i.test(e));
  s.ok(errosRelevantes.length === 0, "Nenhum erro no console durante os testes", errosRelevantes.slice(0, 5).join(" | "));

  // Limpeza: só o que os testes criaram
  if ( limpar ) {
    for ( const app of foundry.applications.instances.values() ) {
      if ( (app instanceof FichaInfectado) || (app instanceof FichaItem) || (app instanceof MontarTeste) ) {
        if ( criados.atores.some(a => app.document?.parent === a || app.document === a || app.actor === a) ) await app.close();
      }
    }
    const novas = game.messages.filter(m => !idsMsgAntes.has(m.id)).map(m => m.id);
    if ( novas.length ) await ChatMessage.deleteDocuments(novas);
    if ( criados.atores.length ) await Actor.deleteDocuments(criados.atores.map(a => a.id).filter(id => game.actors.has(id)));
    if ( criados.cenas?.length ) await Scene.deleteDocuments(criados.cenas.map(c => c.id).filter(id => game.scenes.has(id)));
    if ( criados.itens?.length ) await Item.deleteDocuments(criados.itens.map(i => i.id).filter(id => game.items.has(id)));
  }

  const dur = ((performance.now() - t0) / 1000).toFixed(1);
  await publicarRelatorio(s, dur);
  return s.resultados;
}

/* -------------------------------------------- */
/*  1. Registro                                 */
/* -------------------------------------------- */

async function testarRegistro(s) {
  s.grupo("Registro");
  s.ok(CONFIG.ASSIMILACAO?.FACES?.p?.[11] === "ABBC", "CONFIG.ASSIMILACAO carregado");
  s.ok(CONFIG.Dice.terms.q === DadoInstinto && CONFIG.Dice.terms.l === DadoLosango && CONFIG.Dice.terms.p === DadoAssimilado,
    "Termos dq, dl e dp registrados");
  s.ok(CONFIG.Dice.rolls.includes(RolagemAssimilacao), "RolagemAssimilacao registrada em CONFIG.Dice.rolls");
  s.ok(!!CONFIG.Actor.dataModels.infectado, "Modelo de dados infectado");
  s.ok(["caracteristica", "equipamento", "mutacao"].every(t => CONFIG.Item.dataModels[t]), "Modelos de Item");
  s.igual(CONFIG.Actor.trackableAttributes?.infectado?.bar, ["saude", "determinacao", "assimilacao"], "Barras de token rastreáveis");
  s.ok(["Barlow Semi Condensed", "EB Garamond", "Grape Nuts", "Special Elite", "Rock Salt"].every(f => CONFIG.fontDefinitions[f]),
    "Fontes livres registradas");
  s.ok(document.fonts.check("16px 'EB Garamond'") && document.fonts.check("16px 'Barlow Semi Condensed'"),
    "Fontes disponíveis no navegador");
  s.ok(!!Handlebars.partials.aptidao && !!Handlebars.partials.faixaSaude, "Parciais de template carregadas");
  s.ok(game.settings.settings.has("assimilacao.tetoMantidos") && game.settings.settings.has("assimilacao.ornamentos"),
    "Configurações registradas");
  s.ok(document.body.classList.contains("sistema-assimilacao"), "Classe do sistema no body");
  const importado = [...document.styleSheets].some(ss => {
    if ( (ss.href ?? "").includes("systems/assimilacao/styles/assimilacao.css") ) return true;
    try { return [...ss.cssRules].some(r => (r.href ?? "").includes("systems/assimilacao/styles/assimilacao.css")); }
    catch(e) { return false; }
  });
  s.ok(importado && getComputedStyle(document.documentElement).getPropertyValue("--asm-papel").trim() === "#f4eee2",
    "CSS do sistema carregado (camada system)");
  if ( game.modules.get("dice-so-nice")?.active ) {
    const sistemas = game.dice3d?.DiceFactory?.systems;
    s.ok(!sistemas || sistemas.has?.("assimilacao") || !!sistemas["assimilacao"], "Dice So Nice: sistema de dados registrado");
  }
}

/* -------------------------------------------- */
/*  2. Dados                                    */
/* -------------------------------------------- */

async function testarDados(s) {
  s.grupo("Dados");
  // Tabela da p. 43
  const esperado = {
    q: ["", "", "C", "C", "BC", "A"],
    l: ["", "", "C", "C", "BC", "A", "AA", "AB", "ABC", "AAC"],
    p: ["", "", "C", "C", "BC", "A", "AA", "AB", "ABC", "AAC", "ABBC", "CC"]
  };
  for ( const [d, faces] of Object.entries(esperado) ) {
    const ok = faces.every((str, i) => {
      const sim = simbolosDaFace(d, i + 1);
      return sim.A === [...str].filter(c => c === "A").length
        && sim.B === [...str].filter(c => c === "B").length
        && sim.C === [...str].filter(c => c === "C").length;
    });
    s.ok(ok, `Faces do ${d} conferem com a tabela do livro`);
  }

  // Rolagens aleatórias: faces dentro do intervalo, count = A
  for ( const [d, n] of [["q", 6], ["l", 10], ["p", 12]] ) {
    const r = await new Roll(`60d${d}`).evaluate();
    const term = r.dice[0];
    s.ok(term instanceof DadoSimbolo && term.faces === n, `60d${d}: termo do sistema com ${n} faces`);
    s.ok(term.results.every(x => x.result >= 1 && x.result <= n), `60d${d}: faces entre 1 e ${n}`);
    s.ok(term.results.every(x => x.count === simbolosDaFace(d, x.result).A), `60d${d}: total conta Sucessos`);
    const vistas = new Set(term.results.map(x => x.result));
    s.ok(vistas.size >= Math.min(n, 5), `60d${d}: variedade de faces (${vistas.size})`);
  }

  // Faces forçadas e modificadores
  await comFaces([9, 11, 12], async () => {
    const r = await new Roll("1dlsim + 1dpsim + 1dpsim").evaluate();
    s.igual(r.total, 3 + 4 + 2, "Modificador sim conta todos os símbolos (ABC + ABBC + CC = 9)");
  });
  await comFaces([10, 10, 10], async () => {
    const a = await new Roll("1dlsa").evaluate();
    const b = await new Roll("1dlsb").evaluate();
    const c = await new Roll("1dlsc").evaluate();
    s.igual([a.total, b.total, c.total], [2, 0, 1], "Modificadores sa, sb e sc (face AAC)");
  });
  await comFaces([6, 7], async () => {
    const r = await new Roll("1dq[instinto] + 1dl[aptidão]").evaluate();
    s.igual(r.total, 3, "Fórmula com rótulos: 1■ (A) + 1◆ (AA) = 3 Sucessos");
    s.igual(r.dice.map(t => t.options.flavor), ["instinto", "aptidão"], "Rótulos preservados nos termos");
  });

  // Serialização
  await comFaces([5, 8], async () => {
    const r = await new Roll("1dq + 1dl").evaluate();
    const r2 = Roll.fromData(r.toJSON());
    s.ok(r2.dice[0] instanceof DadoInstinto && r2.dice[1] instanceof DadoLosango, "Termos sobrevivem à serialização");
    s.igual(r2.dice.map(t => t.results[0].result), [5, 8], "Resultados sobrevivem à serialização");
  });

  // Tooltip com ícones
  const r = await new Roll("3dp").evaluate();
  const tip = await r.getTooltip();
  s.ok(tip.includes("asm-dado") && (tip.includes("asm-sym") || tip.includes("vazia")), "Tooltip mostra ícones dos símbolos");

  // Probabilidade aproximada (5 × 900 d10): P(≥1 A) ≈ 50%
  let comA = 0;
  for ( let i = 0; i < 5; i++ ) {
    const grande = await new Roll("900dl").evaluate();
    comA += grande.dice[0].results.filter(x => simbolosDaFace("l", x.result).A > 0).length;
  }
  comA /= 4500;
  s.ok(Math.abs(comA - 0.5) < 0.04, `Distribuição do d10: ${(comA * 100).toFixed(1)}% com Sucesso (≈50%)`);
}

/* -------------------------------------------- */
/*  3. RolagemAssimilacao                       */
/* -------------------------------------------- */

async function rolarForcado(formula, faces, options = {}) {
  return comFaces(faces, async () => {
    const roll = new RolagemAssimilacao(formula, {}, { autor: game.user.id, ...options });
    await roll.evaluate();
    return roll;
  });
}

async function testarRolagem(s, criados) {
  s.grupo("Rolagem");
  await game.settings.set("assimilacao", "tetoMantidos", 4);

  // Sugestão: 3■ (A, C, —) + 2◆ (ABC, AA), manter 1 → AA
  let r = await rolarForcado("3dq + 2dl", [6, 3, 1, 9, 7], { tipo: "acao", manterMin: 1, manterMax: 1 });
  s.igual(r.dadosSimbolo.length, 5, "Lista plana com 5 dados");
  s.igual(r.sugerirMantidos(), [4], "Sugestão mantém o AA");
  r.options.mantidos = [4]; r.options.travado = true; r.aplicarDescartes();
  s.igual([r.resultado.A, r.resultado.B, r.resultado.C], [2, 0, 0], "Resultado após manter AA");
  s.igual(r.total, 2, "Total numérico = Sucessos líquidos");
  s.ok(r.dadosSimbolo.filter(d => d.resultado.discarded).length === 4, "Dados não mantidos marcados como descartados");

  // Origem descartável: manter até 2 sem pegar só C
  r = await rolarForcado("3dq + 2dl", [3, 1, 2, 7, 4], { tipo: "acao", manterMin: 1, manterMax: 2 });
  s.igual(r.sugerirMantidos(), [3], "Com Origem, a sugestão descarta o dado extra que só traz Pressão");

  // Teto de dados mantidos
  r = await rolarForcado("6dl", [6, 6, 6, 6, 6, 6], { tipo: "acao", manterMin: 1, manterMax: 6 });
  s.igual(r.limitesManter, { min: 1, max: 4 }, "Teto padrão de 4 dados mantidos");
  await game.settings.set("assimilacao", "tetoMantidos", 2);
  s.igual(r.limitesManter.max, 2, "Teto configurável (2)");
  await game.settings.set("assimilacao", "tetoMantidos", 4);
  r = await rolarForcado("1dq", [6], { tipo: "acao", manterMin: 3, manterMax: 3 });
  s.igual(r.limitesManter, { min: 1, max: 1 }, "Limites nunca passam do número de dados rolados");

  // Penalidade e Adaptação
  r = await rolarForcado("1dq + 1dl", [5, 8], { tipo: "acao", manterMin: 2, manterMax: 2, penalidadeA: 1 });
  r.options.mantidos = [0, 1]; r.options.travado = true;
  s.igual([r.resultado.A, r.resultado.B, r.resultado.C], [0, 2, 1], "Penalidade de Saúde tira 1 Sucesso");
  r.options.ajustes.bIgnoraPen = 1;
  s.igual([r.resultado.A, r.resultado.B], [1, 1], "1 Adaptação ignora a penalidade");
  r.options.ajustes.bAnulaC = 1;
  s.igual([r.resultado.B, r.resultado.C], [0, 0], "1 Adaptação anula 1 Pressão");

  // Restrições de B (p. 41)
  r = await rolarForcado("1dq", [5], { tipo: "acao", emConflito: true, manterMin: 1, manterMax: 1 });
  s.ok(!r.podeAnularC, "Em Conflito, B não anula C");
  r = await rolarForcado("2dp", [5, 5], { tipo: "assimilada", manterMin: 2, manterMax: 2 });
  s.ok(!r.podeAnularC, "Na Rolagem Assimilada, B não anula C");

  // Incapacitação: exige BB
  r = await rolarForcado("2dq + 1dl", [5, 5, 6], { tipo: "acao", manterMin: 3, manterMax: 3, exigeBB: true });
  r.options.mantidos = [0, 1, 2]; r.options.travado = true;
  s.igual(r.resultado.A, 0, "Incapacitação sem BB: a ação não ativa");
  r.options.ajustes.bIgnoraPen = 2;
  s.igual([r.resultado.A, r.resultado.B], [1, 0], "Incapacitação com BB: ativa");

  // Dano e livre
  r = await rolarForcado("3dlsim", [9, 5, 1], { tipo: "dano" });
  s.ok(r.mantemTodos, "Dano mantém todos os dados");
  s.igual(r.total, 5, "Dano 3◆ (ABC, BC, —) = 5 pontos");
  r = await rolarForcado("2dp", [11, 12], { tipo: "assimilacao" });
  s.igual([r.resultado.A, r.resultado.B, r.resultado.C], [1, 2, 3], "Teste de Assimilação soma todos os símbolos");

  // Serialização da rolagem com estado
  r = await rolarForcado("2dq", [6, 3], { tipo: "acao", manterMin: 1, manterMax: 1, titulo: "X" });
  r.options.mantidos = [0]; r.options.travado = true; r.options.ajustes.bAnulaC = 0;
  const r2 = Roll.fromData(r.toJSON());
  s.ok(r2 instanceof RolagemAssimilacao, "Rolagem volta como RolagemAssimilacao");
  s.igual([r2.options.travado, r2.options.mantidos, r2.options.titulo], [true, [0], "X"], "Estado da escolha sobrevive à serialização");

  // Renderização
  const html = await r.render();
  s.ok(html.includes("asm-card") && html.includes("asm-resultado"), "Card renderiza com resultado");
  const priv = await r.render({ isPrivate: true });
  s.ok(priv.includes("asm-card-privado") && !priv.includes("asm-resultado"), "Card privado esconde o resultado");
  s.igual(chavesCruas(html), [], "Card sem chaves de idioma faltando");

  // API pública
  const rApi = await comFaces([9, 9], () => game.assimilacao.rolar("2dlsim", { tipo: "dano", titulo: "Mordida" }));
  s.igual(rApi.total, 6, "game.assimilacao.rolar cria rolagem de dano");
  const msg = game.messages.contents.at(-1);
  s.ok(msg?.rolls?.[0] instanceof RolagemAssimilacao, "Mensagem criada com RolagemAssimilacao");
  const el = await msg.renderHTML();
  s.ok(!!el.querySelector(".asm-card .asm-resultado.dano"), "Card de dano no chat");
}

/* -------------------------------------------- */
/*  4. Ator                                     */
/* -------------------------------------------- */

async function testarAtor(s, criados) {
  s.grupo("Ator");
  let ator;
  await s.tentar("Criar Infectado(a)", async () => {
    ator = await Actor.create({ name: `${PREFIXO} Ana`, type: "infectado" });
    criados.atores.push(ator);
  });
  if ( !ator ) return null;
  const sys = () => ator.system;
  s.igual([sys().determinacao.nivel, sys().determinacao.value, sys().assimilacao.nivel, sys().assimilacao.value],
    [9, 9, 1, 1], "Cabo de Guerra inicial D9/E1 com reservas cheias");
  s.igual([sys().saude.porNivel, sys().saude.max, sys().saude.nivel], [3, 18, 6], "Saúde inicial: 3 por nível, 18 no total");
  s.ok(ator.prototypeToken.actorLink && ator.prototypeToken.bar1.attribute === "saude"
    && ator.prototypeToken.bar2.attribute === "determinacao", "Token vinculado com barras de Saúde e Determinação");
  const trilhas = foundry.documents.TokenDocument?.implementation?.getTrackedAttributes?.(ator.system);
  if ( trilhas ) s.ok(trilhas.bar.some(b => b.join(".") === "saude"), "Saúde aparece como barra rastreável");
  s.ok(ator.sheet instanceof FichaInfectado, "Ficha padrão é a Ficha de Infectado(a)");
  await s.tentar("Token com barras", async () => {
    // Token em memória (sem cena), para não depender do canvas
    const token = await ator.getTokenDocument({ x: 100, y: 100 });
    const bar1 = token.getBarAttribute("bar1");
    const bar2 = token.getBarAttribute("bar2");
    s.igual([bar1?.attribute, bar1?.value, bar1?.max], ["saude", 18, 18], "Barra 1 do token: Saúde 18/18");
    s.igual([bar2?.attribute, bar2?.value, bar2?.max], ["determinacao", 9, 9], "Barra 2 do token: Determinação 9/9");
    await ator.aplicarDano(4);
    s.igual(token.getBarAttribute("bar1")?.value, 14, "Barra do token acompanha o dano");
    await ator.curar(4);
  });

  // Instintos e Saúde
  await ator.update({ "system.instintos.potencia": 3, "system.instintos.resolucao": 2 });
  s.igual(sys().saude.porNivel, 6, "Saúde por nível acompanha Potência + Resolução");
  s.igual(sys().valorAptidao("potencia"), 3, "valorAptidao lê Instintos");
  const campoPot = ator.system.schema.getField("instintos.potencia");
  s.ok(!!campoPot.validate(0) && !campoPot.validate(5), "Instinto não aceita valor abaixo de 1");

  // Dano, temporários, cura, morte
  await ator.update({ "system.saude.temporarios": 2 });
  await ator.aplicarDano(5);
  s.igual([sys().saude.temporarios, sys().saude.dano], [0, 3], "Dano consome temporários primeiro");
  s.igual([sys().saude.nivel, sys().saude.pontosNoNivel], [6, 3], "Nível 6 com 3 pontos restantes");
  await ator.aplicarDano(10);
  s.igual([sys().saude.nivel, sys().saude.penalidadeA], [4, 1], "Dano 13: Laceração com −1 Sucesso");
  await ator.aplicarDano(12);
  s.igual([sys().saude.nivel, sys().saude.penalidadeA], [2, 2], "Dano 25: Debilitação com −2 Sucessos");
  await ator.aplicarDano(5);
  s.igual([sys().saude.nivel, sys().saude.exigeBB], [1, true], "Dano 30: Incapacitação exige BB");
  await ator.aplicarDano(100);
  s.ok(sys().saude.morto && sys().saude.dano === sys().saude.max, "Dano acima do máximo: morto(a), sem estourar o campo");
  await ator.curar(999);
  s.igual([sys().saude.dano, sys().saude.nivel], [0, 6], "Cura total volta a Saudável");

  // Cabo de Guerra
  await ator.gastarDeterminacao(9, { perda: false });
  s.ok(sys().suscetivel, "Com 0 d: Suscetível");
  const nMsgs = game.messages.size;
  await ator.gastarDeterminacao(1);
  s.igual([sys().determinacao.nivel, sys().assimilacao.nivel, sys().determinacao.value, sys().assimilacao.value, sys().mutacaoPendente],
    [8, 2, 8, 2, true], "Perda com 0 d: D8/E2, nova reserva cheia, e +1, mutação pendente");
  s.ok(game.messages.size === nMsgs + 1, "Aviso de perda de nível enviado ao chat");
  await ator.update({ "system.assimilacao.value": 0, "system.mutacaoPendente": false });
  await ator.gastarAssimilacao(1);
  s.igual([sys().assimilacao.value, sys().determinacao.value], [0, 6], "Sem e: Rolagem paga com 2 d");
  await ator.encerrarCena();
  s.igual(sys().assimilacao.value, 2, "Fim de cena: e volta ao máximo");
  await ator.update({ "system.saude.dano": 4 });
  await ator.repousoCompleto();
  s.igual([sys().determinacao.value, sys().saude.dano], [8, 0], "Repouso: +1 + Resolução d (limitado a D) e Recuperação na faixa alta");
  await ator.update({ "system.saude.dano": 13 });
  await ator.repousoCompleto();
  s.igual(sys().saude.dano, 13, "Repouso não cura nas faixas média e crítica");
  await ator.update({ "system.saude.dano": 0 });
  s.ok(!!ator.system.schema.getField("determinacao.nivel").validate(12), "D acima de 10 é recusado");
  await ator.update({ "system.determinacao.nivel": 9, "system.determinacao.value": 9, "system.assimilacao.value": 1 });
  return ator;
}

/* -------------------------------------------- */
/*  5. Ficha                                    */
/* -------------------------------------------- */

async function testarFicha(s, ator, criados) {
  s.grupo("Ficha");
  const ficha = ator.sheet;
  await s.tentar("Renderizar a ficha", () => ficha.render({ force: true }));
  s.ok(await ate(() => ficha.rendered), "Ficha aberta");
  const q = sel => ficha.element?.querySelector(sel);
  const qa = sel => [...(ficha.element?.querySelectorAll(sel) ?? [])];
  s.igual(qa(".asm-aptidao").length, 18, "18 Aptidões desenhadas");
  s.igual(qa(".asm-faixa").length, 6, "6 faixas de Saúde");
  s.igual(qa(".asm-laco").length, 10, "10 laços no Cabo de Guerra");
  s.igual(qa(".asm-laco.det").length, 9, "9 laços de Determinação com D9");
  s.igual(qa(".asm-gota").length, ator.system.saude.porNivel * 6, `${ator.system.saude.porNivel * 6} gotas (${ator.system.saude.porNivel} por nível)`);
  s.igual(chavesCruas(ficha.element.innerHTML), [], "Ficha (frente) sem chaves de idioma faltando");
  const icones = qa(".window-header button.header-control");
  s.ok(icones.every(b => getComputedStyle(b).fontFamily.includes("Font Awesome")), "Ícones da barra de título com Font Awesome");

  // Contraste dos campos
  const campo = q('input[name="system.saude.temporarios"]');
  if ( campo ) {
    const cor = getComputedStyle(campo).color;
    const fundo = getComputedStyle(campo).backgroundColor;
    s.ok(contraste(cor, fundo) >= 4.5, `Contraste do campo numérico ≥ 4.5 (${contraste(cor, fundo).toFixed(1)})`, `${cor} sobre ${fundo}`);
  }

  // Aptidão por clique
  await clicarEsperar(ficha, '[data-action="definirNivel"][data-chave="atletismo"][data-nivel="3"]');
  s.igual(ator.system.praticas.atletismo, 3, "Clique na 3ª caixa define Atletismo 3");
  await clicarEsperar(ficha, '[data-action="definirNivel"][data-chave="atletismo"][data-nivel="3"]');
  s.igual(ator.system.praticas.atletismo, 2, "Clicar no nível atual baixa 1");
  await clicarEsperar(ficha, '[data-action="definirNivel"][data-chave="influencia"][data-nivel="1"]');
  s.igual(ator.system.instintos.influencia, 1, "Instinto não desce abaixo de 1 pelo clique");

  // Laços (D9: 1–9 Determinação, 10 Assimilação)
  await clicarEsperar(ficha, '[data-action="laco"][data-n="5"]');
  s.igual(ator.system.determinacao.value, 4, "Clique no 5º laço cheio: d = 4");
  await clicarEsperar(ficha, '[data-action="laco"][data-n="7"]');
  s.igual(ator.system.determinacao.value, 7, "Clique no 7º laço vazio: d = 7");
  await clicarEsperar(ficha, '[data-action="laco"][data-n="10"]');
  s.igual(ator.system.assimilacao.value, 0, "Clique no laço de Assimilação cheio: e = 0");
  await clicarEsperar(ficha, '[data-action="laco"][data-n="10"]');
  s.igual(ator.system.assimilacao.value, 1, "Clique no laço de Assimilação vazio: e = 1");

  // Ajustar D
  await clicarEsperar(ficha, '[data-action="ajustarD"][data-delta="-1"]');
  s.igual([ator.system.determinacao.nivel, ator.system.assimilacao.nivel], [8, 2], "Botão − baixa D e sobe E");
  await clicarEsperar(ficha, '[data-action="ajustarD"][data-delta="1"]');
  s.igual(ator.system.determinacao.nivel, 9, "Botão + sobe D");

  // Gotas (perdem-se da direita para a esquerda)
  const pn = ator.system.saude.porNivel;
  await clicarEsperar(ficha, '[data-action="gota"][data-nivel="6"][data-j="2"]');
  s.igual(ator.system.saude.dano, pn - 1, `Clique na 2ª gota do nível 6: dano ${pn - 1}`);
  await clicarEsperar(ficha, '[data-action="gota"][data-nivel="6"][data-j="2"]');
  s.igual(ator.system.saude.dano, pn - 2, "Clique na gota perdida: recupera até ela");
  await clicarEsperar(ficha, '[data-action="gota"][data-nivel="4"][data-j="1"]');
  s.igual(ator.system.saude.nivel, 3, "Clique na gota fixa do nível 4: cai para Ferimentos");
  await ator.update({ "system.saude.dano": 0 });
  await espera(200);

  // Botões da barra de ações
  await ator.update({ "system.assimilacao.value": 0, "system.determinacao.value": 2 });
  await espera(200);
  await clicarEsperar(ficha, '[data-action="encerrarCena"]');
  s.igual(ator.system.assimilacao.value, ator.system.assimilacao.max, "Botão Fim de cena recupera e");
  await clicarEsperar(ficha, '[data-action="repouso"]');
  s.igual(ator.system.determinacao.value, Math.min(ator.system.determinacao.nivel, 2 + 1 + ator.system.instintos.resolucao),
    "Botão Repouso recupera 1 + Resolução d");

  // Campos de formulário
  await ate(() => q('input[name="system.conceito"]'));
  const conceito = q('input[name="system.conceito"]');
  if ( conceito ) {
    conceito.value = "Pescadora que não desiste";
    conceito.dispatchEvent(new Event("change", { bubbles: true }));
    s.ok(await ate(() => ator.system.conceito === "Pescadora que não desiste"), "Campo Conceito salva ao sair");
  }
  const origem = q('input[name="system.origens.eventoMarcante.usado"]');
  if ( origem ) {
    origem.checked = true;
    origem.dispatchEvent(new Event("change", { bubbles: true }));
    s.ok(await ate(() => ator.system.origens.eventoMarcante.usado), "Marcar Origem usada salva");
  }
  await espera(200);
  await clicarEsperar(ficha, '[data-action="novaSessao"]');
  s.ok(await ate(() => !ator.system.origens.eventoMarcante.usado), "Nova sessão libera as Origens");

  // Abas
  for ( const aba of ["verso", "notas", "frente"] ) {
    ficha.changeTab(aba, "primary");
    s.ok(await ate(() => q(`section.tab[data-tab="${aba}"]`)?.classList.contains("active")), `Aba ${aba} ativa`);
  }
  ficha.changeTab("notas", "primary");
  s.ok(!!q('prose-mirror[name="system.biografia"]') && !!q('prose-mirror[name="system.notas"]'), "Editores de Biografia e Anotações");
  s.igual(chavesCruas(ficha.element.innerHTML), [], "Ficha (todas as abas) sem chaves de idioma faltando");
  ficha.changeTab("frente", "primary");

  // Re-renderização com valores extremos
  await ator.update({ "system.instintos.potencia": 7, "system.saude.dano": 0 });
  await ate(() => ficha.rendered);
  s.ok(await ate(() => qa('[data-chave="potencia"].asm-caixa').length === 7), "Instinto 7 (mutação) desenha 7 caixas");
  await ator.update({ "system.instintos.potencia": 3, "system.determinacao.nivel": 0, "system.determinacao.value": 0 });
  s.ok(await ate(() => qa(".asm-laco.ass").length === 10), "D0: os 10 laços viram Assimilação");
  await ator.update({ "system.determinacao.nivel": 10, "system.assimilacao.value": 0 });
  s.ok(await ate(() => qa(".asm-laco.det").length === 10), "D10: os 10 laços viram Determinação");
  await ator.update({ "system.determinacao.nivel": 9, "system.determinacao.value": 9, "system.assimilacao.value": 1 });

  // Ação: criar item pela ficha
  ficha.changeTab("verso", "primary");
  await espera(200);
  q('[data-action="criarItem"][data-tipo="caracteristica"]')?.click();
  s.ok(await ate(() => ator.items.some(i => i.type === "caracteristica")), "Botão + cria Característica");
  const item = ator.items.find(i => i.type === "caracteristica");
  if ( item ) {
    s.ok(await ate(() => item.sheet?.rendered), "Ficha da nova Característica abre");
    await item.sheet.close();
    await item.delete();
  }
  ficha.changeTab("frente", "primary");
}

function contraste(c1, c2) {
  const rgb = c => (c.match(/[\d.]+/g) ?? [0, 0, 0]).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // Fundo semitransparente: mistura com o papel
  const papel = [244, 238, 226];
  let [r, g, b, a = 1] = rgb(c2);
  const fundo = [r * a + papel[0] * (1 - a), g * a + papel[1] * (1 - a), b * a + papel[2] * (1 - a)];
  const L1 = lum(rgb(c1));
  const L2 = lum(fundo);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

/* -------------------------------------------- */
/*  6. Itens                                    */
/* -------------------------------------------- */

async function testarItens(s, ator) {
  s.grupo("Itens");
  // A ordem devolvida pelo servidor não é garantida: busca os itens pelo nome.
  const novosItens = await ator.createEmbeddedDocuments("Item", [
    { name: "Punhos de Ferro", type: "caracteristica", system: { custo: 3, requisitos: "Potência 2+ e Resolução 2+", usos: { value: 2, max: 2, escopo: "cena" } } },
    { name: "Faca", type: "equipamento", system: { local: "corpo", espacos: 1, qualidade: 3, escassez: 1 } },
    { name: "Gerador", type: "equipamento", system: { local: "corpo", espacos: 4 } },
    { name: "Escamas", type: "mutacao", system: { naipe: "ouros", aspecto: "Pele de réptil" } },
    { name: "Ferrões", type: "mutacao", system: { naipe: "espadas" } }
  ]);
  const porNome = n => novosItens.find(i => i.name === n);
  const [carac, equip, pesado, mut, mut2] = ["Punhos de Ferro", "Faca", "Gerador", "Escamas", "Ferrões"].map(porNome);
  s.igual(novosItens.length, 5, "Cinco itens criados de uma vez");
  s.ok(carac.img === "icons/svg/aura.svg" && equip.img === "icons/svg/item-bag.svg" && mut.img === "icons/svg/biohazard.svg",
    "Ícones padrão por tipo de Item");
  for ( const it of [carac, equip, mut] ) {
    await s.tentar(`Ficha de ${it.type}`, async () => {
      await it.sheet.render({ force: true });
      s.ok(await ate(() => it.sheet.rendered), `Ficha de ${it.type} abre`);
      s.igual(chavesCruas(it.sheet.element.innerHTML), [], `Ficha de ${it.type} sem chaves de idioma faltando`);
      const nome = it.sheet.element.querySelector('input[name="name"]');
      nome.value = `${it.name}*`;
      nome.dispatchEvent(new Event("change", { bubbles: true }));
      s.ok(await ate(() => it.name.endsWith("*")), `Ficha de ${it.type} salva o nome`);
      await it.sheet.close();
    });
  }
  // Seleção com escolhas localizadas
  await mut.sheet.render({ force: true });
  await ate(() => mut.sheet.rendered);
  const naipe = mut.sheet.element.querySelector('select[name="system.naipe"]');
  s.ok(naipe && [...naipe.options].map(o => o.textContent.trim()).includes("♠ Inoportunas"), "Naipes aparecem traduzidos");
  const escopoM = mut.sheet.element.querySelector('select[name="system.usos.escopo"]');
  s.ok(escopoM && [...escopoM.options].some(o => o.textContent.trim() === "Por cena"), "Escopos de uso aparecem traduzidos");
  await mut.sheet.close();
  await equip.sheet.render({ force: true });
  await ate(() => equip.sheet.rendered);
  const local = equip.sheet.element.querySelector('select[name="system.local"]');
  s.ok(local && [...local.options].some(o => o.textContent.trim() === "Mochila"), "Locais do inventário aparecem traduzidos");
  await equip.sheet.close();

  // Na ficha do ator
  const ficha = ator.sheet;
  await ficha.render({ force: true });
  ficha.changeTab("verso", "primary");
  const q = sel => ficha.element?.querySelector(sel);
  s.ok(await ate(() => q(".naipe-ouros .asm-mutacao")?.textContent.includes("Escamas")), "Mutação aparece no naipe certo (♦)");
  s.ok(!!q(".naipe-espadas .asm-inoportunas"), "Contador de Pressão nas Inoportunas");
  s.ok(await ate(() => q(".local-corpo h3 small")?.textContent.trim() === "5/3"), "Inventário soma espaços (5/3)");
  s.ok(!!q(".local-corpo .asm-espacos.excedido"), "Inventário marca excesso de espaços");
  s.ok(q(`[data-item-id="${carac.id}"] .asm-usos`)?.textContent.trim() === "2/2", "Usos da Característica na ficha");
  q(`[data-item-id="${carac.id}"] [data-action="usarItem"]`)?.click();
  s.ok(await ate(() => carac.system.usos.value === 1), "Clique em usos gasta 1");
  const nMsgs = game.messages.size;
  q(`[data-item-id="${carac.id}"] [data-action="mostrarItem"]`)?.click();
  s.ok(await ate(() => game.messages.size === nMsgs + 1), "Mostrar item no chat");
  q(`[data-item-id="${equip.id}"] [data-action="editarItem"]`)?.click();
  s.ok(await ate(() => equip.sheet.rendered), "Clique no nome abre a ficha do item");
  await equip.sheet.close();
  await pesado.update({ "system.local": "refugio" });
  s.ok(await ate(() => q(".local-corpo h3 small")?.textContent.trim() === "1/3"), "Item no Refúgio não ocupa espaço");
  s.ok(await ate(() => !!q(".local-refugio")), "Lista do Refúgio aparece");
  s.igual(chavesCruas(ficha.element.innerHTML), [], "Verso com itens sem chaves de idioma faltando");
  ficha.changeTab("frente", "primary");
  await mut2.delete();
}

/* -------------------------------------------- */
/*  7. Montar Teste                             */
/* -------------------------------------------- */

function acharApp(ator) {
  for ( const app of foundry.applications.instances.values() ) {
    if ( (app instanceof MontarTeste) && (app.actor === ator) && app.rendered ) return app;
  }
  return null;
}

async function testarMontarTeste(s, ator, criados) {
  s.grupo("Montar Teste");
  await ator.update({
    "system.instintos.potencia": 3, "system.instintos.reacao": 2, "system.praticas.atletismo": 2,
    "system.determinacao.value": 9, "system.assimilacao.value": 1,
    "system.origens.eventoMarcante.texto": "A enchente", "system.origens.eventoMarcante.usado": false,
    "system.origens.ocupacao.usado": false, "system.saude.dano": 0, "system.mutacaoPendente": false
  });

  const promessa = ator.rolarTeste({ aptidao: "atletismo" });
  s.ok(await ate(() => acharApp(ator)), "Diálogo abre a partir do ator");
  const app = acharApp(ator);
  if ( !app ) return;
  s.igual([app.estado.instinto, app.estado.aptidao], ["influencia", "atletismo"], "Aptidão pré-selecionada");
  s.igual(chavesCruas(app.element.innerHTML), [], "Diálogo sem chaves de idioma faltando");
  const sel = app.element.querySelector('select[name="instinto"]');
  const cor = getComputedStyle(sel).color;
  const fundo = getComputedStyle(sel).backgroundColor;
  s.ok(contraste(cor, fundo) >= 4.5, `Contraste das listas do diálogo ≥ 4.5 (${contraste(cor, fundo).toFixed(1)})`, `${cor} sobre ${fundo}`);

  const base = { ...app.estado, instinto: "potencia", aptidao: "atletismo" };
  let c = app.calcular({ ...base });
  s.igual([c.q, c.l, c.p, c.manterMin, c.manterMax, c.custoD, c.custoE], [3, 2, 0, 1, 1, 0, 0], "Potência 3 + Atletismo 2: 3■ + 2◆, mantém 1");
  c = app.calcular({ ...base, origemEvento: true, origemOcupacao: true });
  s.igual([c.manterMin, c.manterMax], [1, 3], "Duas Origens: mantém de 1 a 3");
  c = app.calcular({ ...base, empenho: true });
  s.igual([c.manterMin, c.manterMax, c.custoD], [2, 2, 1], "Empenho: +1 mantido obrigatório, custa 1 d");
  c = app.calcular({ ...base, modo: "assimilada", instinto2: "reacao" });
  s.igual([c.q, c.l, c.p, c.manterMin, c.custoE, c.custoD], [0, 0, 5, 2, 1, 0], "Rolagem Assimilada: (3 + 2)⬟, mantém 2, custa 1 e");
  c = app.calcular({ ...base, aptidao: "" });
  s.igual([c.q, c.l], [3, 0], "Sem Aptidão: só os ■ do Instinto");
  c = app.calcular({ ...base, extraQ: 1, extraL: 2, extraP: 1, manterExtra: 1 });
  s.igual([c.q, c.l, c.p, c.manterMin], [4, 4, 1, 2], "Bônus de dados e de mantidos");
  c = app.calcular({ ...base, empenho: true, origemEvento: true, origemOcupacao: true, manterExtra: 3 });
  s.igual(c.manterMax, 4, "Teto de 4 mantidos respeitado");

  // Recursos insuficientes
  await ator.update({ "system.assimilacao.value": 0, "system.determinacao.value": 1 });
  c = app.calcular({ ...base, modo: "assimilada", instinto2: "reacao" });
  s.ok(c.custoD === 2 && !c.podeRolar && c.avisos.length > 0, "Sem e e com 1 d: Rolagem Assimilada bloqueada com aviso");
  await ator.update({ "system.determinacao.value": 0 });
  c = app.calcular({ ...base, empenho: true });
  s.ok(!c.podeRolar, "Suscetível não pode usar Empenho");
  await ator.update({ "system.determinacao.value": 9, "system.mutacaoPendente": true });
  c = app.calcular({ ...base, empenho: true });
  s.ok(!c.podeRolar, "Reserva de d travada (mutação pendente) bloqueia Empenho");
  await ator.update({ "system.assimilacao.value": 1, "system.mutacaoPendente": false });

  // Mudança no formulário re-renderiza
  const modo = app.element.querySelector('select[name="modo"]');
  modo.value = "assimilada";
  modo.dispatchEvent(new Event("change", { bubbles: true }));
  s.ok(await ate(() => app.estado.modo === "assimilada" && app.element?.querySelector('select[name="instinto2"]')),
    "Trocar o tipo mostra o segundo Instinto");
  const modo2 = app.element.querySelector('select[name="modo"]');
  modo2.value = "aptidao";
  modo2.dispatchEvent(new Event("change", { bubbles: true }));
  await ate(() => app.element?.querySelector('select[name="aptidao"]'));
  const inst = app.element.querySelector('select[name="instinto"]');
  inst.value = "potencia";
  inst.dispatchEvent(new Event("change", { bubbles: true }));
  await ate(() => app.estado.instinto === "potencia");
  const origem = app.element.querySelector('input[name="origemEvento"]');
  origem.checked = true;
  origem.dispatchEvent(new Event("change", { bubbles: true }));
  await ate(() => app.estado.origemEvento === true);
  s.ok(await ate(() => app.element?.querySelector(".asm-resumo")?.textContent.includes("1–2")), "Resumo mostra 1–2 mantidos com Origem");

  // Texto da intenção não redesenha o formulário (preserva foco e o clique em Rolar)
  const campoIntencao = app.element.querySelector('input[name="intencao"]');
  const botaoRolar = app.element.querySelector('button[type="submit"]');
  campoIntencao.value = "Pular o muro";
  campoIntencao.dispatchEvent(new Event("change", { bubbles: true }));
  await espera(400);
  s.ok(app.estado.intencao === "Pular o muro" && app.element.querySelector('input[name="intencao"]') === campoIntencao,
    "Intenção é guardada sem redesenhar os campos");
  s.ok(app.element.querySelector('button[type="submit"]') === botaoRolar, "Botão Rolar continua o mesmo após mudanças");

  // Rolar pelo botão, com clique duplo (faces forçadas: 3■ = A, C, —; 2◆ = AA, BC)
  const nMsgs = game.messages.size;
  await comFaces([6, 3, 1, 7, 5, 6, 6, 6, 6, 6], async () => {
    botaoRolar.click();
    botaoRolar.click();
    s.ok(await ate(() => game.messages.size === nMsgs + 1, { timeout: 6000 }), "Rolar cria a mensagem");
    await espera(800);
    s.igual(game.messages.size, nMsgs + 1, "Clique duplo em Rolar não rola duas vezes");
  });
  const roll = await promessa;
  s.ok(roll instanceof RolagemAssimilacao, "A promessa do diálogo devolve a rolagem");
  s.igual(roll?.options.intencao, "Pular o muro", "Intenção vai para a rolagem");
  s.ok(await ate(() => !app.rendered), "Diálogo fecha depois de rolar");
  s.ok(ator.system.origens.eventoMarcante.usado, "Origem usada fica marcada na ficha");
  s.igual([roll?.options.manterMin, roll?.options.manterMax], [1, 2], "Limites de mantidos gravados na rolagem");

  // Rolagem Assimilada pela API: gasta 1 e
  await ator.update({ "system.assimilacao.value": 1 });
  const estado = { ...base, modo: "assimilada", instinto2: "reacao", intencao: "Saltar o rio" };
  const dlg = new MontarTeste(ator, {});
  const calc = dlg.calcular(estado);
  const r = await comFaces([6, 7, 1, 2, 3], () => executarTeste(ator, estado, calc));
  s.ok(r.options.tipo === "assimilada" && ator.system.assimilacao.value === 0, "Rolagem Assimilada pela API gasta 1 e");
  s.igual(r.dice.map(t => t.constructor.DENOMINATION), ["p"], "Rolagem Assimilada usa só ⬟");

  // Cancelar resolve null
  const p2 = ator.rolarTeste({});
  await ate(() => acharApp(ator));
  await acharApp(ator)?.close();
  s.igual(await p2, null, "Fechar o diálogo devolve null");

  // Saúde no teste
  await ator.update({ "system.saude.dano": ator.system.saude.porNivel * 2 + 1 });
  const c2 = new MontarTeste(ator, {}).calcular({ ...base });
  s.igual(c2.penalidadeA, 1, "Penalidade de Saúde chega ao teste");
  await ator.update({ "system.saude.dano": 0 });
}

/* -------------------------------------------- */
/*  8. Card no chat (cliques)                   */
/* -------------------------------------------- */

async function testarCard(s, ator, criados) {
  s.grupo("Card");
  await ator.update({ "system.determinacao.value": 9, "system.saude.dano": 0 });
  const estado = { modo: "aptidao", instinto: "potencia", aptidao: "atletismo", origemEvento: false, origemOcupacao: false,
    empenho: false, emConflito: false, extraQ: 0, extraL: 0, extraP: 0, manterExtra: 0, intencao: "" };
  const calc = new MontarTeste(ator, {}).calcular(estado);
  calc.manterMax = 2;
  // 3■ = BC, C, —; 2◆ = AB, ABC
  const roll = await comFaces([5, 3, 1, 8, 9], () => executarTeste(ator, estado, calc));
  const msg = game.messages.contents.at(-1);
  s.ok(msg.rolls[0] instanceof RolagemAssimilacao, "Mensagem do teste com a rolagem");

  const clicar = async (acao, extra = "") => {
    const el = await msg.renderHTML();
    const alvo = el.querySelector(`[data-acao="${acao}"]${extra}`);
    if ( !alvo ) return false;
    alvo.click();
    return true;
  };
  const opcoes = () => msg.rolls[0].options;

  s.ok(await clicar("alternar", '[data-indice="0"]'), "Dado clicável antes de manter");
  s.ok(await ate(() => JSON.stringify(opcoes().mantidos) === "[0]"), "Clique seleciona o dado");
  await clicar("alternar", '[data-indice="3"]');
  s.ok(await ate(() => JSON.stringify(opcoes().mantidos) === "[0,3]"), "Segundo clique adiciona outro dado");
  await clicar("alternar", '[data-indice="4"]');
  await espera(300);
  s.igual(opcoes().mantidos, [0, 3], "Não passa do máximo de mantidos");
  await clicar("alternar", '[data-indice="0"]');
  s.ok(await ate(() => JSON.stringify(opcoes().mantidos) === "[3]"), "Clique de novo remove o dado");
  await clicar("sugerir");
  s.ok(await ate(() => JSON.stringify(opcoes().mantidos) === "[3,4]"), "Sugerir escolhe AB + ABC");
  await clicar("confirmar");
  s.ok(await ate(() => opcoes().travado), "Manter trava a escolha");
  const res = () => msg.rolls[0].resultado;
  s.igual([res().A, res().B, res().C], [2, 2, 1], "Resultado AB + ABC");
  s.ok(!(await clicar("alternar", '[data-indice="0"]')), "Depois de travado, não dá para trocar dados");
  await clicar("b-anula-c");
  s.ok(await ate(() => res().C === 0 && res().B === 1), "Adaptação anula Pressão pelo botão");
  const el = await msg.renderHTML();
  s.ok(!el.querySelector('[data-acao="b-anula-c"]'), "Botão some quando não há mais Pressão");
  s.igual(chavesCruas(el.innerHTML), [], "Card travado sem chaves de idioma faltando");

  // Painel do GM: Pressão abate d
  const r2 = await comFaces([3, 4], async () => {
    const calc2 = { ...calc, q: 2, l: 0, p: 0, manterMin: 2, manterMax: 2 };
    return executarTeste(ator, { ...estado }, calc2);
  });
  const msg2 = game.messages.contents.at(-1);
  const el2a = await msg2.renderHTML();
  el2a.querySelector('[data-acao="sugerir"]')?.click();
  await ate(() => msg2.rolls[0].options.mantidos.length === 2);
  (await msg2.renderHTML()).querySelector('[data-acao="confirmar"]')?.click();
  await ate(() => msg2.rolls[0].options.travado);
  const dAntes = ator.system.determinacao.value;
  (await msg2.renderHTML()).querySelector('[data-acao="gm-c-det"]')?.click();
  s.ok(await ate(() => ator.system.determinacao.value === dAntes - 1), "GM: Pressão −1 d no personagem");
  s.ok(await ate(() => msg2.rolls[0].options.ajustes.cDeterminacao === 1), "GM: registro do abate no card");
  (await msg2.renderHTML()).querySelector('[data-acao="gm-reverter"]')?.click();
  s.ok(await ate(() => msg2.rolls[0].options.ajustes.cDeterminacao === 0), "GM: reverter ajustes do card");

  // Incapacitação com BB pelo card
  await ator.update({ "system.saude.dano": ator.system.saude.porNivel * 5 });
  const calc3 = new MontarTeste(ator, {}).calcular({ ...estado });
  s.ok(calc3.exigeBB, "Teste em Incapacitação exige BB");
  calc3.q = 0; calc3.l = 2; calc3.manterMin = 2; calc3.manterMax = 2;
  await comFaces([5, 8], () => executarTeste(ator, { ...estado }, calc3));
  const msg3 = game.messages.contents.at(-1);
  (await msg3.renderHTML()).querySelector('[data-acao="sugerir"]')?.click();
  await ate(() => msg3.rolls[0].options.mantidos.length === 2);
  (await msg3.renderHTML()).querySelector('[data-acao="confirmar"]')?.click();
  await ate(() => msg3.rolls[0].options.travado);
  s.igual(msg3.rolls[0].resultado.A, 0, "Sem gastar BB, Sucesso não conta");
  (await msg3.renderHTML()).querySelector('[data-acao="bb-ativa"]')?.click();
  s.ok(await ate(() => msg3.rolls[0].resultado.A === 1 && msg3.rolls[0].resultado.ativou), "Gastar BB ativa a ação");
  await ator.update({ "system.saude.dano": 0 });

  // Card no chat de verdade (DOM do ChatLog)
  const noLog = ui.chat?.element?.querySelector(`[data-message-id="${msg.id}"] .asm-card`);
  s.ok(!!noLog, "Card aparece no registro do chat");
}

/* -------------------------------------------- */
/*  9. Casos extras                             */
/* -------------------------------------------- */

async function testarExtras(s, ator, criados) {
  s.grupo("Extras");

  // Temas claro e escuro: campos legíveis nos dois
  const uiOriginal = foundry.utils.deepClone(game.settings.get("core", "uiConfig"));
  for ( const tema of ["light", "dark"] ) {
    await s.tentar(`Tema ${tema}`, async () => {
      await game.settings.set("core", "uiConfig", foundry.utils.mergeObject(foundry.utils.deepClone(uiOriginal),
        { colorScheme: { applications: tema, interface: tema } }));
      await espera(300);
      await ator.sheet.render({ force: true });
      await ate(() => ator.sheet.rendered);
      ator.sheet.changeTab("frente", "primary");
      const campo = ator.sheet.element.querySelector('input[name="system.saude.temporarios"]');
      const c = contraste(getComputedStyle(campo).color, getComputedStyle(campo).backgroundColor);
      s.ok(c >= 4.5, `Tema ${tema}: contraste dos campos da ficha ≥ 4.5 (${c.toFixed(1)})`);
      const p = ator.rolarTeste({});
      await ate(() => acharApp(ator));
      const app = acharApp(ator);
      const sel = app.element.querySelector("select");
      const c2 = contraste(getComputedStyle(sel).color, getComputedStyle(sel).backgroundColor);
      s.ok(c2 >= 4.5, `Tema ${tema}: contraste do diálogo de teste ≥ 4.5 (${c2.toFixed(1)})`);
      await app.close();
      await p;
    });
  }
  await game.settings.set("core", "uiConfig", uiOriginal);

  // Ficha estreita (tablet): sem rolagem horizontal
  await ator.sheet.render({ force: true });
  await ate(() => ator.sheet.rendered);
  ator.sheet.setPosition({ width: 640 });
  await espera(300);
  for ( const aba of ["frente", "verso", "notas"] ) {
    ator.sheet.changeTab(aba, "primary");
    await espera(150);
    const sec = ator.sheet.element.querySelector(`section.tab[data-tab="${aba}"]`);
    s.ok(sec && (sec.scrollWidth <= sec.clientWidth + 2), `Ficha a 640 px sem rolagem horizontal (${aba})`,
      `${sec?.scrollWidth} > ${sec?.clientWidth}`);
  }
  ator.sheet.setPosition({ width: 820 });
  ator.sheet.changeTab("frente", "primary");

  // Arrastar um Item do mundo para a ficha
  await s.tentar("Arrastar item para a ficha", async () => {
    const solto = await Item.create({ name: `${PREFIXO} Lanterna`, type: "equipamento", system: { local: "mochila" } });
    criados.itens = [solto];
    const antes = ator.items.size;
    await ator.sheet._onDropItem(new DragEvent("drop"), solto);
    s.ok(await ate(() => ator.items.size === antes + 1 && ator.items.some(i => i.name.endsWith("Lanterna"))),
      "Item arrastado do mundo entra na ficha");
  });

  // Exportar e importar o ator (JSON)
  await s.tentar("Exportar e importar ator", async () => {
    const dados = ator.toObject();
    delete dados._id;
    dados.name = `${PREFIXO} Cópia`;
    const copia = await Actor.create(dados);
    criados.atores.push(copia);
    s.igual([copia.system.instintos.potencia, copia.items.size, copia.system.determinacao.nivel],
      [ator.system.instintos.potencia, ator.items.size, ator.system.determinacao.nivel], "Cópia do ator mantém dados e itens");
  });

  // Ator sem dados de sistema (como um ator antigo) recebe os padrões
  await s.tentar("Ator sem dados", async () => {
    const vazio = await Actor.create({ name: `${PREFIXO} Vazio`, type: "infectado", system: {} });
    criados.atores.push(vazio);
    s.igual([vazio.system.saude.max, vazio.system.determinacao.nivel], [18, 9], "Ator criado sem dados recebe os padrões");
  });

  // Card de um ator apagado: botão do GM avisa e não quebra
  await s.tentar("Card de ator apagado", async () => {
    const temp = await Actor.create({ name: `${PREFIXO} Temporário`, type: "infectado" });
    const estado = { modo: "aptidao", instinto: "potencia", aptidao: "", origemEvento: false, origemOcupacao: false,
      empenho: false, emConflito: false, extraQ: 0, extraL: 0, extraP: 0, manterExtra: 0, intencao: "" };
    const calc = new MontarTeste(temp, {}).calcular(estado);
    await comFaces([3], () => executarTeste(temp, estado, calc));
    const msg = game.messages.contents.at(-1);
    (await msg.renderHTML()).querySelector('[data-acao="sugerir"]')?.click();
    await ate(() => msg.rolls[0].options.mantidos.length === 1);
    (await msg.renderHTML()).querySelector('[data-acao="confirmar"]')?.click();
    await ate(() => msg.rolls[0].options.travado);
    await temp.delete();
    const el = await msg.renderHTML();
    s.ok(!!el.querySelector(".asm-card"), "Card continua aparecendo depois que o ator é apagado");
    el.querySelector('[data-acao="gm-c-det"]')?.click();
    await espera(400);
    s.igual(msg.rolls[0].options.ajustes.cDeterminacao, 0, "Botão do GM não aplica nada sem o ator");
  });

  // Rolagens pelo chat e inline
  await s.tentar("Comando /r", async () => {
    const n = game.messages.size;
    await comFaces([9, 9], () => ui.chat.processMessage("/r 2dlsim"));
    s.ok(await ate(() => game.messages.size === n + 1), "Comando /r 2dlsim funciona no chat");
    s.igual(game.messages.contents.at(-1).rolls[0]?.total, 6, "/r 2dlsim conta 6 símbolos (ABC + ABC)");
  });
  await s.tentar("Rolagem inline", async () => {
    const html = await comFaces([7], () => foundry.applications.ux.TextEditor.implementation.enrichHTML("Dano: [[1dl]]", { rolls: true }));
    const div = document.createElement("div");
    div.innerHTML = html;
    s.igual(div.querySelector(".inline-roll")?.textContent.trim(), "2", "Rolagem inline [[1dl]] mostra os Sucessos (AA = 2)");
  });
}

/* -------------------------------------------- */
/*  10. Textos                                  */
/* -------------------------------------------- */

async function testarTextos(s) {
  s.grupo("Textos");
  const html = await foundry.applications.ux.TextEditor.implementation.enrichHTML("Gaste @sim[BB] para ativar; rola @sim[2◆].");
  const div = document.createElement("div");
  div.innerHTML = html;
  s.igual(div.querySelectorAll("img.asm-sym-B").length, 2, "Enricher @sim desenha os ícones");
  s.ok(!!div.querySelector(".asm-glifo.losango"), "Enricher @sim desenha a forma do dado");
  const lang = game.i18n.translations.ASSIMILACAO ?? {};
  s.ok(Object.keys(lang).length > 15, "Arquivo de idioma pt-BR carregado");
  for ( const k of [...CONFIG.ASSIMILACAO.INSTINTOS, ...CONFIG.ASSIMILACAO.CONHECIMENTOS, ...CONFIG.ASSIMILACAO.PRATICAS] ) {
    if ( !game.i18n.has(`ASSIMILACAO.Aptidao.${k}`) || !game.i18n.has(`ASSIMILACAO.AptidaoDesc.${k}`) ) {
      s.ok(false, `Texto da Aptidão ${k}`);
    }
  }
  s.ok(true, "Textos das 18 Aptidões verificados");
}

/* -------------------------------------------- */
/*  Relatório                                   */
/* -------------------------------------------- */

async function publicarRelatorio(s, dur) {
  const total = s.resultados.length;
  const falhas = s.resultados.filter(r => !r.ok);
  const porSecao = {};
  for ( const r of s.resultados ) {
    porSecao[r.secao] ??= { ok: 0, falha: 0 };
    porSecao[r.secao][r.ok ? "ok" : "falha"]++;
  }
  console.table(s.resultados);
  const esc = t => foundry.utils.escapeHTML(String(t));
  const linhasSecao = Object.entries(porSecao).map(([sec, v]) =>
    `<tr><td>${esc(sec)}</td><td>${v.ok}</td><td>${v.falha ? `<strong>${v.falha}</strong>` : 0}</td></tr>`).join("");
  const listaFalhas = falhas.length
    ? `<ol>${falhas.map(f => `<li><strong>${esc(f.secao)}</strong>: ${esc(f.descricao)}${f.detalhe ? ` — <code>${esc(f.detalhe)}</code>` : ""}</li>`).join("")}</ol>`
    : "<p>Nenhuma falha.</p>";
  const conteudo = `<div class="asm-card asm-papel relatorio-testes">
    <h3>Testes automáticos: ${total - falhas.length}/${total} ok</h3>
    <p class="asm-nota">${dur} s · ${new Date().toLocaleString("pt-BR")}</p>
    <table><tr><th>Seção</th><th>OK</th><th>Falhas</th></tr>${linhasSecao}</table>
    ${listaFalhas}</div>`;
  await ChatMessage.create({ content: conteudo, whisper: [game.user.id], speaker: { alias: "Testes do sistema" } });

  const todos = s.resultados.map(r => `<tr><td>${r.ok ? "✔" : "✘"}</td><td>${esc(r.secao)}</td><td>${esc(r.descricao)}</td><td>${esc(r.detalhe)}</td></tr>`).join("");
  const pagina = `<h2>${total - falhas.length}/${total} ok (${dur} s)</h2><table><tr><th></th><th>Seção</th><th>Teste</th><th>Detalhe</th></tr>${todos}</table>`;
  const nome = "Relatório de testes — Assimilação";
  const diario = game.journal.getName(nome) ?? await JournalEntry.create({ name: nome });
  const pag = diario.pages.contents[0];
  if ( pag ) await pag.update({ "text.content": pagina });
  else await diario.createEmbeddedDocuments("JournalEntryPage", [{ name: "Resultado", type: "text", text: { content: pagina } }]);
  ui.notifications[falhas.length ? "warn" : "info"](`Assimilação: ${total - falhas.length}/${total} testes ok.`);
}
