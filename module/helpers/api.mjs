/**
 * Funções de alto nível usadas pelas macros do compêndio "Macros do Assimilação"
 * e expostas em game.assimilacao.
 */
import { EscolherAtor } from "../apps/escolher-ator.mjs";
import { RolagemAssimilacao } from "../dice/roll.mjs";

const TIPOS_TESTE = ["infectado", "personagem"];
const loc = k => game.i18n.localize(k);
const esc = t => foundry.utils.escapeHTML(String(t ?? ""));

/**
 * Atores dos tipos pedidos de que o usuário é dono. O personagem atribuído vem primeiro;
 * para o(a) GM, os personagens dos jogadores vêm antes dos NPCs.
 * @param {string[]} [tipos]
 * @returns {Actor[]}
 */
export function atoresDoUsuario(tipos = TIPOS_TESTE) {
  const meu = game.user.character;
  return game.actors
    .filter(a => tipos.includes(a.type) && a.isOwner)
    .sort((a, b) => ((b === meu) - (a === meu))
      || (Number(b.hasPlayerOwner) - Number(a.hasPlayerOwner))
      || a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Decide quem age: um único token controlado vai direto; vários tokens controlados ou vários
 * personagens do usuário abrem a lista de escolha.
 * @param {object} [opcoes]  { tipos, titulo, dica, tokens: considerar tokens controlados }
 * @returns {Promise<Actor|null>}
 */
export async function escolherAtor({ tipos = TIPOS_TESTE, titulo, dica, tokens = true } = {}) {
  if ( tokens && canvas?.ready ) {
    const controlados = [...new Set(canvas.tokens.controlled
      .map(t => t.actor)
      .filter(a => a?.isOwner && tipos.includes(a.type)))];
    if ( controlados.length === 1 ) return controlados[0];
    if ( controlados.length > 1 ) return EscolherAtor.escolher(controlados, { titulo, dica });
  }
  const lista = atoresDoUsuario(tipos);
  if ( !lista.length ) {
    ui.notifications.warn(loc("ASSIMILACAO.Escolher.nenhum"));
    return null;
  }
  if ( lista.length === 1 ) return lista[0];
  return EscolherAtor.escolher(lista, { titulo, dica });
}

/**
 * Abre a tela "Montar Teste" do personagem do usuário (ou da lista, se houver mais de um).
 * @param {object} [opcoes]  { ator, instinto, aptidao, modo }
 */
export async function abrirTeste({ ator, ...opcoes } = {}) {
  ator ??= await escolherAtor({ titulo: loc("ASSIMILACAO.Escolher.tituloTeste") });
  if ( !ator ) return null;
  return ator.rolarTeste(opcoes);
}

/* -------------------------------------------- */
/*  Ações em grupo                              */
/* -------------------------------------------- */

/**
 * Infectados do grupo: para o(a) GM, os que têm jogador dono (ou todos, se nenhum tiver);
 * para jogadores, os próprios.
 * @returns {Actor[]}
 */
export function infectadosDoGrupo() {
  const todos = game.actors.filter(a => a.type === "infectado");
  if ( !game.user.isGM ) return todos.filter(a => a.isOwner);
  const dosJogadores = todos.filter(a => a.hasPlayerOwner);
  return dosJogadores.length ? dosJogadores : todos;
}

async function acaoEmGrupo(metodo, { titulo, texto, icone, confirmar = true, atores } = {}) {
  atores ??= infectadosDoGrupo();
  if ( !atores.length ) {
    ui.notifications.warn(loc("ASSIMILACAO.Macro.semInfectados"));
    return [];
  }
  const lista = `<ul class="asm-lista-nomes">${atores.map(a => `<li>${esc(a.name)}</li>`).join("")}</ul>`;
  if ( confirmar ) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: titulo, icon: icone },
      content: `<p>${esc(texto)}</p>${lista}`,
      rejectClose: false
    });
    if ( !ok ) return [];
  }
  for ( const ator of atores ) await ator[metodo]();
  await ChatMessage.create({
    speaker: { alias: game.user.name },
    content: `<div class="asm-card asm-papel aviso-grupo">
      <h3><i class="${esc(icone)}"></i> ${esc(titulo)}</h3>
      <p class="asm-nota">${esc(texto)}</p>${lista}</div>`
  });
  return atores;
}

/** Fim de cena para todo o grupo: recupera os e e renova os usos por cena. */
export function encerrarCenaGrupo(opcoes = {}) {
  return acaoEmGrupo("encerrarCena", {
    titulo: loc("ASSIMILACAO.Macro.encerrarCenaGrupo"), texto: loc("ASSIMILACAO.Ficha.encerrarCenaDica"),
    icone: "fa-solid fa-clapperboard", ...opcoes
  });
}

/** Nova sessão para todo o grupo: libera as Origens e renova os usos por sessão. */
export function novaSessaoGrupo(opcoes = {}) {
  return acaoEmGrupo("novaSessao", {
    titulo: loc("ASSIMILACAO.Macro.novaSessaoGrupo"), texto: loc("ASSIMILACAO.Ficha.novaSessaoDica"),
    icone: "fa-solid fa-sun", ...opcoes
  });
}

/** Repouso completo para todo o grupo. */
export function repousoGrupo(opcoes = {}) {
  return acaoEmGrupo("repousoCompleto", {
    titulo: loc("ASSIMILACAO.Macro.repousoGrupo"), texto: loc("ASSIMILACAO.Ficha.repousoDica"),
    icone: "fa-solid fa-campground", ...opcoes
  });
}

/* -------------------------------------------- */
/*  Rolagens avulsas                            */
/* -------------------------------------------- */

/**
 * Rola uma fórmula de símbolos mantendo todos os dados.
 * @param {string} formula  ex.: "3dl", "2dq + 1dp"
 * @param {object} [opcoes] { tipo: "livre" | "dano", titulo, ator }
 */
export async function rolar(formula, { ator, ...opcoes } = {}) {
  if ( (opcoes.tipo === "dano") ) formula = formula.replace(/(\d*)d([qlp])(?![a-z])/gi, (m, n, d) => `${n || 1}d${d.toLowerCase()}sim`);
  const dadosAtor = ator ? { uuid: ator.uuid, nome: ator.name, img: ator.img } : undefined;
  const roll = new RolagemAssimilacao(formula, {}, { tipo: "livre", autor: game.user.id, ator: dadosAtor, ...opcoes });
  await roll.evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker(ator ? { actor: ator } : {}) });
  return roll;
}

/** Diálogo para rolar ■ ◆ ⬟ avulsos (rolagem livre ou dano). */
export async function rolarDadosDialogo({ tipo = "livre" } = {}) {
  const { DialogV2 } = foundry.applications.api;
  const linha = (k, forma) => `<div class="form-group">
      <label><span class="asm-glifo ${forma}"></span> ${esc(loc(`ASSIMILACAO.Dado.${k}`))}</label>
      <div class="form-fields"><input type="number" name="${k}" value="0" min="0" max="30" step="1"></div>
    </div>`;
  const content = `<div class="asm-rolar-dados">
      ${linha("q", "quadrado")}${linha("l", "losango")}${linha("p", "pentagono")}
      <div class="form-group"><label>${esc(loc("ASSIMILACAO.Macro.tipoRolagem"))}</label>
        <div class="form-fields"><select name="tipo">
          <option value="livre" ${tipo === "livre" ? "selected" : ""}>${esc(loc("ASSIMILACAO.Rolagem.tipo.livre"))}</option>
          <option value="dano" ${tipo === "dano" ? "selected" : ""}>${esc(loc("ASSIMILACAO.Rolagem.tipo.dano"))}</option>
        </select></div></div>
      <div class="form-group"><label>${esc(loc("ASSIMILACAO.Macro.tituloRolagem"))}</label>
        <div class="form-fields"><input type="text" name="titulo" placeholder="${esc(loc("ASSIMILACAO.Macro.tituloRolagemDica"))}"></div></div>
    </div>`;
  const dados = await DialogV2.prompt({
    window: { title: loc("ASSIMILACAO.Macro.rolarDados"), icon: "fa-solid fa-dice" },
    classes: ["assimilacao"],
    content,
    ok: { label: loc("ASSIMILACAO.Teste.rolar"), callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if ( !dados ) return null;
  const termos = ["q", "l", "p"].filter(k => Number(dados[k]) > 0).map(k => `${Math.min(Number(dados[k]), 30)}d${k}`);
  if ( !termos.length ) {
    ui.notifications.warn(loc("ASSIMILACAO.Teste.semDados"));
    return null;
  }
  return rolar(termos.join(" + "), { tipo: dados.tipo, titulo: dados.titulo?.trim() || undefined });
}

/** Rola o pool da Ameaça do token controlado (ou da lista de Ameaças). */
export async function rolarPoolAmeaca({ ator } = {}) {
  ator ??= await escolherAtor({ tipos: ["ameaca"], titulo: loc("ASSIMILACAO.Escolher.tituloAmeaca") });
  if ( !ator ) return null;
  return ator.rolarPool();
}
