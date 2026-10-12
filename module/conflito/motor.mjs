/**
 * Motor da cena de Conflito (seções 3.7, 10.3 e 10.4 da especificação).
 *
 * O Conflito (Actor "conflito") guarda a partitura e o estado da cena em `system.cena`.
 * Quem altera o estado é sempre o(a) GM; jogadores pedem investimentos pelo socket.
 */
const SIS = "assimilacao";
const CANAL = `system.${SIS}`;
const MAX_LOG = 40;

const loc = k => game.i18n.localize(k);

/** Substitui um objeto inteiro numa atualização (v14: operador; v13: chave "=="). */
export function substituir(caminho, valor) {
  const R = foundry.data.operators?.ForcedReplacement;
  if ( R ) return { [caminho]: R.create(valor) };
  const partes = caminho.split(".");
  const ultima = partes.pop();
  return { [[...partes, `==${ultima}`].join(".")]: valor };
}
const fmt = (k, d) => game.i18n.format(k, d);
const esc = t => foundry.utils.escapeHTML(String(t ?? ""));

/* -------------------------------------------- */
/*  Consultas                                   */
/* -------------------------------------------- */

/** O Conflito em andamento, ou null. */
export function conflitoAtivo() {
  let id = "";
  try { id = game.settings.get(SIS, "conflitoAtivo"); } catch { return null; }
  const ator = id ? game.actors.get(id) : null;
  return ((ator?.type === "conflito") && ator.system.cena.ativa) ? ator : null;
}

/** Ameaças vinculadas, na ordem de ação. */
export function ameacasDo(conflito) {
  return (conflito?.system.ameacas ?? []).map(id => game.actors.get(id)).filter(a => a?.type === "ameaca");
}

/** Atores presentes na cena. */
export function presentesDo(conflito) {
  return (conflito?.system.cena.presentes ?? []).map(id => game.actors.get(id)).filter(Boolean);
}

/** O ator está na cena do Conflito ativo (presente e sem ter fugido)? */
export function estaNoConflito(ator) {
  const c = conflitoAtivo();
  if ( !c || !ator ) return false;
  const id = ator.id ?? ator;
  return c.system.naCena.includes(id) || (!c.system.cena.presentes.length);
}

/** Quem rola e investe pool: Conflito e Ameaça. */
function temPool(ator) {
  return !!ator?.system?.saldo && ["conflito", "ameaca"].includes(ator.type);
}

/**
 * Estado de um Objetivo no contexto do Conflito: meta, progresso e se está completo.
 * Objetivos vinculados a uma Ameaça espelham a Neutralização dela.
 */
export function estadoObjetivo(conflito, obj) {
  const st = obj.system;
  const ameaca = st.ameaca ? game.actors.get(st.ameaca) : null;
  if ( ameaca?.type === "ameaca" ) {
    const n = ameaca.system.neutralizacao;
    return {
      meta: n.max, atual: Math.min(n.value, n.max), completo: !!ameaca.system.neutralizada,
      ameaca, individual: false, contribuicoes: st.contribuicoes, concluidos: [], faltamMinimo: []
    };
  }
  const cena = conflito?.system.cena;
  const presentes = cena?.presentes ?? [];
  const naCena = conflito?.system.naCena ?? [];
  if ( st.individual ) {
    const concluidos = Object.entries(st.contribuicoes).filter(([, v]) => v >= st.meta).map(([id]) => id);
    const completo = (st.repeticao === "porInfectado")
      ? (presentes.length > 0) && presentes.every(id => concluidos.includes(id))
      : concluidos.length > 0;
    const atual = Math.max(0, ...Object.values(st.contribuicoes));
    return { meta: st.meta, atual: Math.min(atual, st.meta), completo, concluidos, individual: true,
      contribuicoes: st.contribuicoes, faltamMinimo: [] };
  }
  const minimo = st.custo.minimoPorInfectado;
  const faltamMinimo = minimo ? naCena.filter(id => (st.contribuicoes[id] ?? 0) < minimo) : [];
  const completo = (st.repeticao === "multipla")
    ? st.conclusoes > 0
    : (st.progresso.total >= st.meta) && !faltamMinimo.length;
  return { meta: st.meta, atual: st.atual, completo, concluidos: [], individual: false,
    contribuicoes: st.contribuicoes, faltamMinimo };
}

/** Texto do custo de um Objetivo, ex.: "5A + AA por Infectado além do primeiro". */
export function custoObjetivoTexto(obj) {
  const c = obj.system.custo;
  const A = n => "A".repeat(Math.min(n, 12)) + (n > 12 ? `×${n}` : "");
  const partes = [];
  if ( c.base ) partes.push(obj.system.individual ? fmt("ASSIMILACAO.Objetivo.custoCada", { a: A(c.base) }) : A(c.base));
  if ( c.porInfectadoExtra ) partes.push(fmt("ASSIMILACAO.Objetivo.custoExtra", { a: A(c.porInfectadoExtra) }));
  if ( c.porInfectado && !obj.system.individual ) partes.push(fmt("ASSIMILACAO.Objetivo.custoPor", { a: A(c.porInfectado) }));
  if ( c.minimoPorInfectado ) partes.push(fmt("ASSIMILACAO.Objetivo.custoMinimo", { a: A(c.minimoPorInfectado) }));
  return partes.join(" · ") || "—";
}

/**
 * Para onde o A de um Infectado pode ir no Conflito ativo.
 * @returns {{destino: string, rotulo: string, faltam: number}[]}
 */
export function destinosPara(conflito, atorId) {
  if ( !conflito ) return [];
  const lista = [];
  const ameacasEmObjetivo = new Set();
  const objetivos = conflito.items.filter(i => i.type === "objetivo")
    .sort((a, b) => (a.system.categoria === b.system.categoria ? a.sort - b.sort : (a.system.categoria === "principal" ? -1 : 1)));
  for ( const obj of objetivos ) {
    if ( obj.system.ameaca ) ameacasEmObjetivo.add(obj.system.ameaca);
    const est = estadoObjetivo(conflito, obj);
    let faltam;
    if ( est.individual ) faltam = est.meta - (est.contribuicoes[atorId] ?? 0);
    else if ( obj.system.repeticao === "multipla" ) faltam = est.meta - obj.system.progresso.total;
    else {
      faltam = est.meta - est.atual;
      const minimo = obj.system.custo.minimoPorInfectado;
      if ( (faltam <= 0) && minimo ) faltam = minimo - (est.contribuicoes[atorId] ?? 0);
    }
    if ( faltam <= 0 ) continue;
    lista.push({ destino: `obj:${obj.id}`, rotulo: obj.name, faltam, principal: obj.system.categoria === "principal" });
  }
  for ( const am of ameacasDo(conflito) ) {
    if ( ameacasEmObjetivo.has(am.id) || am.system.neutralizada ) continue;
    const n = am.system.neutralizacao;
    lista.push({ destino: `neu:${am.id}`, rotulo: fmt("ASSIMILACAO.Partitura.neutralizar", { nome: am.name }), faltam: n.max - n.value });
  }
  return lista;
}

/* -------------------------------------------- */
/*  Registro e anúncios                         */
/* -------------------------------------------- */

function linhaLog(conflito, texto) {
  const log = [...(conflito.system.cena.log ?? []), { rodada: conflito.system.cena.rodada, texto }];
  return log.slice(-MAX_LOG);
}

export async function registrar(conflito, texto) {
  return conflito.update({ "system.cena.log": linhaLog(conflito, texto) });
}

async function anunciar(conflito, titulo, corpo = "", classe = "") {
  return ChatMessage.create({
    speaker: { alias: conflito.name },
    content: `<div class="asm-card asm-papel conflito-card ${classe}">
      <header class="asm-card-cabecalho">
        <img class="asm-card-retrato" src="${esc(conflito.img)}" alt="">
        <div class="asm-card-titulos"><span class="asm-etiqueta">${esc(loc("TYPES.Actor.conflito"))}</span><h3>${esc(titulo)}</h3></div>
      </header>${corpo}</div>`
  });
}

/* -------------------------------------------- */
/*  Investimentos (sempre pelo GM)              */
/* -------------------------------------------- */

/**
 * Investe A de um Infectado num Objetivo. Devolve quantos A foram de fato usados.
 */
export async function investirObjetivo(conflito, obj, atorId, n) {
  const st = obj.system;
  const antes = estadoObjetivo(conflito, obj);
  if ( antes.ameaca ) return investirNeutralizacao(conflito, antes.ameaca, atorId, n);
  if ( n <= 0 ) return 0;
  const contrib = st.contribuicoes[atorId] ?? 0;
  const upd = {};
  let usar;
  if ( st.individual ) {
    if ( contrib >= st.meta ) return 0;
    usar = Math.min(n, st.meta - contrib);
    upd["system.progresso.total"] = st.progresso.total + usar;
  } else if ( st.repeticao === "multipla" ) {
    usar = n;
    let total = st.progresso.total + usar;
    let conclusoes = st.conclusoes;
    while ( total >= st.meta ) { total -= st.meta; conclusoes += 1; }
    upd["system.progresso.total"] = total;
    upd["system.conclusoes"] = conclusoes;
  } else {
    const espacoTotal = Math.max(0, st.meta - st.progresso.total);
    const espacoMinimo = Math.max(0, st.custo.minimoPorInfectado - contrib);
    usar = Math.min(n, Math.max(espacoTotal, espacoMinimo));
    if ( usar <= 0 ) return 0;
    upd["system.progresso.total"] = Math.min(st.meta, st.progresso.total + usar);
  }
  if ( atorId ) upd[`system.progresso.porInfectado.${atorId}`] = contrib + usar;
  await obj.update(upd);

  const nome = game.actors.get(atorId)?.name ?? "";
  const textos = [fmt("ASSIMILACAO.Partitura.logInvestiu", { nome, n: usar, destino: obj.name })];
  const cenaUpd = {};

  // Fuga individual: quem completa a própria barra sai da cena (p. 199)
  if ( st.individual && (contrib + usar >= st.meta) ) {
    if ( !st.concluidoPor.includes(atorId) ) await obj.update({ "system.concluidoPor": [...st.concluidoPor, atorId] });
    if ( st.fuga && conflito.system.cena.presentes.includes(atorId) && !conflito.system.cena.fugiram.includes(atorId) ) {
      cenaUpd["system.cena.fugiram"] = [...conflito.system.cena.fugiram, atorId];
      textos.push(fmt("ASSIMILACAO.Partitura.logFugiu", { nome }));
      await anunciar(conflito, fmt("ASSIMILACAO.Partitura.fugiu", { nome }));
    }
  }
  if ( st.repeticao === "multipla" && (upd["system.conclusoes"] > st.conclusoes) ) {
    textos.push(fmt("ASSIMILACAO.Partitura.logConcluiuVez", { destino: obj.name, n: upd["system.conclusoes"] }));
  }
  let log = conflito.system.cena.log ?? [];
  for ( const t of textos ) log = [...log, { rodada: conflito.system.cena.rodada, texto: t }];
  cenaUpd["system.cena.log"] = log.slice(-MAX_LOG);
  await conflito.update(cenaUpd);
  if ( cenaUpd["system.cena.fugiram"] ) await sincronizarAmeacas(conflito);

  const depois = estadoObjetivo(conflito, obj);
  if ( !antes.completo && depois.completo ) await anunciarObjetivo(conflito, obj);
  return usar;
}

async function anunciarObjetivo(conflito, obj) {
  const principal = obj.system.categoria === "principal";
  const corpo = `<p class="asm-nota">${esc(loc(principal ? "ASSIMILACAO.Partitura.principalConcluido" : "ASSIMILACAO.Partitura.secundarioConcluido"))}</p>
    ${obj.system.recompensa ? `<p class="asm-nota"><strong>${esc(loc("ASSIMILACAO.Objetivo.FIELDS.recompensa.label"))}:</strong> ${esc(obj.system.recompensa)}</p>` : ""}`;
  await registrar(conflito, fmt("ASSIMILACAO.Partitura.logConcluiu", { destino: obj.name }));
  return anunciar(conflito, fmt("ASSIMILACAO.Partitura.objetivoConcluido", { nome: obj.name }), corpo, principal ? "principal" : "");
}

/** Investe A na Neutralização de uma Ameaça. */
export async function investirNeutralizacao(conflito, ameaca, atorId, n) {
  const nz = ameaca.system.neutralizacao;
  if ( ameaca.system.neutralizada || (n <= 0) ) return 0;
  const usar = Math.min(n, nz.max - nz.value);
  if ( usar <= 0 ) return 0;
  await ameaca.update({ "system.neutralizacao.value": nz.value + usar });
  const nome = game.actors.get(atorId)?.name ?? "";
  if ( conflito ) await registrar(conflito, fmt("ASSIMILACAO.Partitura.logInvestiu", {
    nome, n: usar, destino: fmt("ASSIMILACAO.Partitura.neutralizar", { nome: ameaca.name }) }));
  if ( ameaca.system.neutralizada ) {
    const corpo = ameaca.system.neutralizacao.consequencia
      ? `<p class="asm-nota">${esc(ameaca.system.neutralizacao.consequencia)}</p>` : "";
    if ( conflito ) {
      await registrar(conflito, fmt("ASSIMILACAO.Partitura.logNeutralizada", { nome: ameaca.name }));
      await anunciar(conflito, fmt("ASSIMILACAO.Partitura.ameacaNeutralizada", { nome: ameaca.name }), corpo);
    }
  }
  return usar;
}

/**
 * O(A) GM usa 1 C do saldo do Conflito para retirar 1 A de progresso de um Objetivo (p. 198).
 * @param {string} [atorId]  em Objetivos individuais, de quem retirar
 */
export async function retirarProgresso(conflito, obj, { atorId, usarC = true } = {}) {
  const st = obj.system;
  if ( usarC && (conflito.system.saldo.C < 1) ) {
    ui.notifications.warn(loc("ASSIMILACAO.Partitura.semCParaRetirar"));
    return false;
  }
  const upd = {};
  if ( st.individual ) {
    const id = atorId ?? Object.keys(st.contribuicoes).find(k => st.contribuicoes[k] > 0);
    if ( !id || !st.contribuicoes[id] ) return false;
    upd[`system.progresso.porInfectado.${id}`] = st.contribuicoes[id] - 1;
    upd["system.progresso.total"] = Math.max(0, st.progresso.total - 1);
  } else {
    if ( st.progresso.total < 1 ) return false;
    upd["system.progresso.total"] = st.progresso.total - 1;
  }
  await obj.update(upd);
  const cUpd = { "system.cena.log": linhaLog(conflito, fmt("ASSIMILACAO.Partitura.logRetirou", { destino: obj.name })) };
  if ( usarC ) {
    cUpd["system.saldo.C"] = conflito.system.saldo.C - 1;
  }
  await conflito.update(cUpd);
  return true;
}

/**
 * Clique numa casa de custo de Ativação: marca ou desmarca, consumindo o saldo rolado
 * (e devolvendo ao saldo o que foi investido neste turno).
 */
export async function investirCasa(dono, ativacao, s, i) {
  const custo = ativacao.system.custo[s];
  const atual = ativacao.system.progresso[s];
  const novo = Math.clamp((i <= atual) ? i - 1 : i, 0, custo);
  const delta = novo - atual;
  if ( !delta ) return;
  if ( temPool(dono) ) {
    const saldo = { ...dono.system.saldo };
    const turno = { ...dono.system.turno };
    if ( delta > 0 ) {
      const usar = Math.min(delta, saldo[s]);
      saldo[s] -= usar;
      turno[s] += usar;
    } else {
      const devolver = Math.min(-delta, turno[s]);
      saldo[s] += devolver;
      turno[s] -= devolver;
    }
    await dono.update({ "system.saldo": saldo, "system.turno": turno });
  }
  return ativacao.update({ [`system.progresso.${s}`]: novo });
}

/** Soma ao saldo do dono os símbolos de uma rolagem de pool. */
export async function aplicarSaldo(roll) {
  const o = roll.options;
  if ( !o.dono || o.saldoAplicado ) return false;
  const dono = await fromUuid(o.dono);
  if ( !temPool(dono) ) return false;
  const s = roll.simbolosMantidos;
  const saldo = dono.system.saldo;
  await dono.update({ "system.saldo": { A: saldo.A + s.A, B: saldo.B + s.B, C: saldo.C + s.C } });
  o.saldoAplicado = true;
  const c = conflitoAtivo();
  if ( c ) await registrar(c, fmt("ASSIMILACAO.Partitura.logRolou", { nome: dono.name, A: s.A, B: s.B, C: s.C }));
  return true;
}

/** C de uma rolagem de Infectado vão para o saldo do Conflito (p. 198). */
export async function levarCParaPartitura(message) {
  const conflito = conflitoAtivo();
  const roll = message.rolls?.[0];
  if ( !conflito || !roll ) return 0;
  const o = roll.options;
  const n = Math.max(0, roll.resultado.C - (o.cLevadas ?? 0) - (o.ajustes?.cDeterminacao ?? 0));
  if ( !n ) return 0;
  await conflito.update({
    "system.saldo.C": conflito.system.saldo.C + n,
    "system.cena.log": linhaLog(conflito, fmt("ASSIMILACAO.Partitura.logC", { n, nome: o.ator?.nome ?? "" }))
  });
  o.cLevadas = (o.cLevadas ?? 0) + n;
  await message.update({ rolls: [roll.toJSON()] });
  return n;
}

/**
 * Investe A de uma mensagem de teste num destino ("obj:<id>" ou "neu:<id>"). Executado pelo GM.
 */
export async function investirDaMensagem(message, destino, n = 1, userId = game.user.id) {
  const conflito = conflitoAtivo();
  const roll = message?.rolls?.[0];
  if ( !conflito || !roll ) return 0;
  const o = roll.options;
  const user = game.users.get(userId);
  if ( !user?.isGM && (message.author?.id !== userId) ) return 0;
  if ( !(o.travado || roll.mantemTodos) ) return 0;
  const investidos = (o.investimentos ?? []).reduce((t, i) => t + i.A, 0);
  const restam = Math.max(0, roll.resultado.A - investidos);
  const pedir = Math.min(Math.max(1, Number(n) || 1), restam);
  if ( !pedir ) return 0;
  const atorId = o.ator?.uuid ? (fromUuidSync(o.ator.uuid)?.id ?? null) : null;

  const [tipo, id] = String(destino).split(":");
  let usados = 0;
  let rotulo = "";
  if ( tipo === "obj" ) {
    const obj = conflito.items.get(id);
    if ( !obj ) return 0;
    rotulo = obj.name;
    usados = await investirObjetivo(conflito, obj, atorId, pedir);
  } else if ( tipo === "neu" ) {
    const am = game.actors.get(id);
    if ( am?.type !== "ameaca" ) return 0;
    rotulo = fmt("ASSIMILACAO.Partitura.neutralizar", { nome: am.name });
    usados = await investirNeutralizacao(conflito, am, atorId, pedir);
  }
  if ( !usados ) return 0;
  const lista = [...(o.investimentos ?? [])];
  const existente = lista.find(i => i.destino === destino);
  if ( existente ) existente.A += usados;
  else lista.push({ destino, rotulo, A: usados });
  o.investimentos = lista;
  await message.update({ rolls: [roll.toJSON()] });
  return usados;
}

/** Pedido de investimento vindo de qualquer usuário: aplica direto (GM) ou pede ao GM pelo socket. */
export async function pedirInvestimento(message, destino, n = 1) {
  if ( game.user.isGM ) return investirDaMensagem(message, destino, n);
  if ( !game.users.activeGM ) {
    ui.notifications.warn(loc("ASSIMILACAO.Partitura.semGM"));
    return 0;
  }
  game.socket.emit(CANAL, { tipo: "investir", msgId: message.id, destino, n, userId: game.user.id });
  return null;
}

export function registrarSocket() {
  game.socket.on(CANAL, async dados => {
    if ( !game.users.activeGM?.isSelf ) return;
    try {
      if ( dados?.tipo === "investir" ) {
        const msg = game.messages.get(dados.msgId);
        if ( msg ) await investirDaMensagem(msg, dados.destino, dados.n, dados.userId);
      }
    } catch(err) {
      console.error("Assimilação | erro ao aplicar investimento", err);
    }
  });
}

/* -------------------------------------------- */
/*  Cena: início, fases, presentes e fim        */
/* -------------------------------------------- */

/** Ordem das fases numa rodada: quem desencadeou o Conflito começa (p. 69). */
export function ordemFases(conflito) {
  return conflito.system.cena.iniciante === "assimilador"
    ? ["assimilador", "infectados", "fim"]
    : ["infectados", "assimilador", "fim"];
}

/** Mantém o número de Infectados presentes das Ameaças igual ao da cena. */
export async function sincronizarAmeacas(conflito) {
  const n = conflito.system.presentesEfetivos;
  for ( const am of ameacasDo(conflito) ) {
    if ( am.system.infectadosPresentes !== n ) await am.update({ "system.infectadosPresentes": n });
  }
}

/**
 * Inicia a cena de Conflito.
 * @param {Actor} conflito
 * @param {object} [opcoes]  { presentes: ids, iniciante: "infectados" | "assimilador", motivo }
 */
export async function iniciar(conflito, { presentes, iniciante = "infectados", motivo = "" } = {}) {
  if ( !game.user.isGM || (conflito?.type !== "conflito") ) return null;
  const outro = conflitoAtivo();
  if ( outro && (outro !== conflito) ) await encerrar(outro, { fimDeCena: false, anunciar: false });
  presentes ??= game.assimilacao.infectadosDoGrupo().map(a => a.id);
  const zero = { A: 0, B: 0, C: 0 };
  await conflito.update({
    "system.saldo": zero,
    "system.turno": zero,
    "system.infectadosPresentes": Math.clamp(presentes.length || 1, 1, 12),
    "system.cena": {
      ativa: true, rodada: 1, fase: iniciante, iniciante, motivo,
      presentes, fugiram: [],
      log: [{ rodada: 1, texto: loc("ASSIMILACAO.Partitura.logInicio") }]
    }
  });
  for ( const am of ameacasDo(conflito) ) await am.update({ "system.saldo": zero, "system.turno": zero });
  await sincronizarAmeacas(conflito);
  await game.settings.set(SIS, "conflitoAtivo", conflito.id);
  const nomes = presentesDo(conflito).map(a => esc(a.name)).join(", ");
  await anunciar(conflito, fmt("ASSIMILACAO.Partitura.iniciado", { nome: conflito.name }), `
    ${motivo ? `<p class="asm-card-intencao">“${esc(motivo)}”</p>` : ""}
    <p class="asm-nota">${esc(fmt("ASSIMILACAO.Partitura.comeca", { lado: loc(`ASSIMILACAO.Conflito.iniciante.${iniciante}`) }))}</p>
    ${nomes ? `<p class="asm-nota">${esc(loc("ASSIMILACAO.Partitura.presentes"))}: ${nomes}</p>` : ""}`, "inicio");
  return conflito;
}

/** Donos de pool que ainda agem nesta cena (Conflito e Ameaças não neutralizadas). */
export function donosDePool(conflito) {
  return [conflito, ...ameacasDo(conflito).filter(a => !a.system.neutralizada)];
}

/** Ativações completas que ainda não dispararam. */
export function ativacoesProntas(conflito) {
  return donosDePool(conflito).flatMap(d => d.items.filter(i => (i.type === "ativacao") && i.system.completa && !i.system.esgotada)
    .map(i => ({ dono: d, ativacao: i })));
}

/**
 * Avança para a próxima fase. No fim do turno do(a) Assimilador(a), todos os A e C rolados
 * precisam estar investidos (p. 70); com `forcar`, avança assim mesmo.
 * @returns {Promise<boolean>}
 */
export async function proximaFase(conflito, { forcar = false } = {}) {
  if ( !game.user.isGM ) return false;
  const cena = conflito.system.cena;
  const ordem = ordemFases(conflito);
  const atual = cena.fase;
  const donos = donosDePool(conflito);

  if ( (atual === "assimilador") && !forcar ) {
    const comSaldo = donos.filter(d => d.system.temSaldoObrigatorio);
    if ( comSaldo.length ) {
      ui.notifications.warn(fmt("ASSIMILACAO.Partitura.saldoPendente", { nomes: comSaldo.map(d => d.name).join(", ") }));
      return false;
    }
    const prontas = ativacoesProntas(conflito);
    if ( prontas.length ) {
      ui.notifications.warn(fmt("ASSIMILACAO.Partitura.ativacoesPendentes", { nomes: prontas.map(p => p.ativacao.name).join(", ") }));
      return false;
    }
  }

  let idx = ordem.indexOf(atual);
  let rodada = cena.rodada;
  let proxima;
  if ( (idx < 0) || (idx >= ordem.length - 1) ) {
    proxima = ordem[0];
    if ( idx >= 0 ) rodada += 1;
  } else proxima = ordem[idx + 1];

  // Saindo do turno do Assimilador: B não usados se perdem; o que foi investido fica.
  const zero = { A: 0, B: 0, C: 0 };
  if ( atual === "assimilador" ) {
    for ( const d of donos ) {
      await d.update({ "system.saldo.B": 0, "system.turno": zero });
    }
  }
  if ( proxima === "assimilador" ) {
    for ( const d of donos ) await d.update({ "system.turno": zero });
  }

  const log = [...cena.log];
  if ( rodada !== cena.rodada ) log.push({ rodada, texto: fmt("ASSIMILACAO.Partitura.logRodada", { n: rodada }) });
  log.push({ rodada, texto: loc(CONFIG.ASSIMILACAO.FASES[proxima]) });
  await conflito.update({ "system.cena.fase": proxima, "system.cena.rodada": rodada, "system.cena.log": log.slice(-MAX_LOG) });
  return true;
}

export async function definirPresentes(conflito, presentes) {
  const fugiram = conflito.system.cena.fugiram.filter(id => presentes.includes(id));
  await conflito.update({ "system.cena.presentes": [...new Set(presentes)], "system.cena.fugiram": fugiram });
  if ( conflito.system.cena.ativa ) await sincronizarAmeacas(conflito);
}

export async function adicionarPresente(conflito, atorId) {
  if ( conflito.system.cena.presentes.includes(atorId) ) return;
  return definirPresentes(conflito, [...conflito.system.cena.presentes, atorId]);
}

export async function removerPresente(conflito, atorId) {
  return definirPresentes(conflito, conflito.system.cena.presentes.filter(id => id !== atorId));
}

export async function alternarFuga(conflito, atorId) {
  const f = conflito.system.cena.fugiram;
  const fugiram = f.includes(atorId) ? f.filter(id => id !== atorId) : [...f, atorId];
  const nome = game.actors.get(atorId)?.name ?? "";
  await conflito.update({
    "system.cena.fugiram": fugiram,
    "system.cena.log": linhaLog(conflito, fmt(f.includes(atorId) ? "ASSIMILACAO.Partitura.logVoltou" : "ASSIMILACAO.Partitura.logFugiu", { nome }))
  });
  await sincronizarAmeacas(conflito);
}

export async function vincularAmeaca(conflito, ameacaId) {
  if ( conflito.system.ameacas.includes(ameacaId) ) return;
  await conflito.update({ "system.ameacas": [...conflito.system.ameacas, ameacaId] });
  if ( conflito.system.cena.ativa ) await sincronizarAmeacas(conflito);
}

export async function desvincularAmeaca(conflito, ameacaId) {
  return conflito.update({ "system.ameacas": conflito.system.ameacas.filter(id => id !== ameacaId) });
}

export async function moverAmeaca(conflito, ameacaId, passo) {
  const lista = [...conflito.system.ameacas];
  const i = lista.indexOf(ameacaId);
  const j = i + passo;
  if ( (i < 0) || (j < 0) || (j >= lista.length) ) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return conflito.update({ "system.ameacas": lista });
}

/**
 * Encerra a cena: resumo no chat, fim de cena para os presentes (e voltam ao máximo) e,
 * se pedido, zera o progresso da partitura para reaproveitá-la.
 */
export async function encerrar(conflito, { fimDeCena = true, zerar = false, anunciar: comAnuncio = true } = {}) {
  if ( !game.user.isGM || (conflito?.type !== "conflito") ) return null;
  const objetivos = conflito.items.filter(i => i.type === "objetivo");
  const concluidos = objetivos.filter(o => estadoObjetivo(conflito, o).completo);
  const neutralizadas = ameacasDo(conflito).filter(a => a.system.neutralizada);
  if ( comAnuncio ) {
    const li = lista => lista.length ? `<ul class="asm-lista-nomes">${lista.join("")}</ul>` : `<p class="asm-nota">—</p>`;
    const recompensas = [conflito.system.recompensas, ...concluidos.map(o => o.system.recompensa)].filter(Boolean);
    const corpo = `
      <p class="asm-nota">${esc(fmt("ASSIMILACAO.Partitura.rodadas", { n: conflito.system.cena.rodada }))}</p>
      <h4>${esc(loc("ASSIMILACAO.Partitura.objetivosConcluidos"))}</h4>
      ${li(concluidos.map(o => `<li>${esc(o.name)} <small>(${esc(loc(CONFIG.ASSIMILACAO.CATEGORIAS_OBJETIVO[o.system.categoria]))})</small></li>`))}
      ${neutralizadas.length ? `<h4>${esc(loc("ASSIMILACAO.Partitura.ameacasNeutralizadas"))}</h4>${li(neutralizadas.map(a => `<li>${esc(a.name)}</li>`))}` : ""}
      ${recompensas.length ? `<h4>${esc(loc("ASSIMILACAO.Conflito.FIELDS.recompensas.label"))}</h4>${li(recompensas.map(r => `<li>${esc(r)}</li>`))}` : ""}
      <p class="asm-nota"><strong>${esc(fmt("ASSIMILACAO.Partitura.xpSugerida", { n: conflito.system.recompensaXP }))}</strong></p>`;
    await anunciar(conflito, fmt("ASSIMILACAO.Partitura.encerrado", { nome: conflito.name }), corpo, "fim");
  }
  if ( fimDeCena ) {
    for ( const ator of presentesDo(conflito) ) {
      if ( ator.isOwner && ator.encerrarCena ) await ator.encerrarCena();
    }
  }
  const zero = { A: 0, B: 0, C: 0 };
  await conflito.update({ "system.cena.ativa": false, "system.cena.fase": "encerrado", "system.saldo": zero, "system.turno": zero });
  if ( zerar ) await zerarPartitura(conflito);
  if ( game.settings.get(SIS, "conflitoAtivo") === conflito.id ) await game.settings.set(SIS, "conflitoAtivo", "");
  return conflito;
}

/** Zera progresso, disparos e Neutralizações para reaproveitar a partitura. */
export async function zerarPartitura(conflito) {
  const zero = { A: 0, B: 0, C: 0 };
  const limpar = ator => ator.items.map(i => {
    if ( i.type === "ativacao" ) return { _id: i.id, "system.progresso": zero, "system.disparos": 0 };
    if ( i.type === "objetivo" ) return { _id: i.id, "system.progresso.total": 0, "system.conclusoes": 0, "system.concluidoPor": [] };
    return null;
  }).filter(Boolean);
  const upd = limpar(conflito);
  if ( upd.length ) await conflito.updateEmbeddedDocuments("Item", upd);
  // ObjectField: zerar as contribuições exige substituir o objeto inteiro
  for ( const obj of conflito.items.filter(i => i.type === "objetivo") ) {
    if ( Object.keys(obj.system.progresso.porInfectado ?? {}).length ) {
      await obj.update(substituir("system.progresso.porInfectado", {}));
    }
  }
  for ( const am of ameacasDo(conflito) ) {
    const u = limpar(am);
    if ( u.length ) await am.updateEmbeddedDocuments("Item", u);
    await am.update({ "system.neutralizacao.value": 0, "system.saldo": zero, "system.turno": zero });
  }
  await conflito.update({ "system.cena.log": [], "system.cena.rodada": 0, "system.cena.fase": "preparacao", "system.cena.fugiram": [] });
}
