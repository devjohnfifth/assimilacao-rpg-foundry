import { RolagemAssimilacao } from "./roll.mjs";

/**
 * Interações do card de rolagem (escolha de dados, uso de B, painel do GM).
 * O estado vive em message.rolls[0].options; cada ação atualiza a mensagem,
 * e o card é renderizado de novo a partir desse estado.
 */
export function registrarChat() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const roll = message.rolls?.[0];
    if ( !(roll instanceof RolagemAssimilacao) ) return;
    const card = html.querySelector(".asm-card");
    if ( !card ) return;
    card.addEventListener("click", ev => {
      const alvo = ev.target.closest("[data-acao]");
      if ( !alvo || !card.contains(alvo) ) return;
      ev.preventDefault();
      ev.stopPropagation();
      tratarAcao(message, alvo.dataset.acao, alvo.dataset).catch(err => {
        console.error("Assimilação | erro na ação do card", err);
        ui.notifications.error(err.message);
      });
    });
    card.addEventListener("keydown", ev => {
      if ( (ev.key !== "Enter") && (ev.key !== " ") ) return;
      const alvo = ev.target.closest("[data-acao='alternar']");
      if ( !alvo ) return;
      ev.preventDefault();
      tratarAcao(message, "alternar", alvo.dataset);
    });
  });
}

function podeEditar(message) {
  return game.user.isGM || message.isAuthor;
}

async function salvar(message, roll) {
  return message.update({ rolls: [roll.toJSON()] });
}

async function tratarAcao(message, acao, dataset) {
  const roll = message.rolls[0];
  const o = roll.options;
  const aj = o.ajustes;

  // Ações do GM
  if ( acao.startsWith("gm-") ) {
    if ( !game.user.isGM ) return;
    if ( acao === "gm-c-det" ) {
      const ator = o.ator?.uuid ? await fromUuid(o.ator.uuid) : null;
      if ( !ator ) return ui.notifications.warn(game.i18n.localize("ASSIMILACAO.Avisos.semAtor"));
      await ator.gastarDeterminacao?.(1, { motivo: game.i18n.localize("ASSIMILACAO.Rolagem.gmAbaterD") });
      aj.cDeterminacao = (aj.cDeterminacao ?? 0) + 1;
      return salvar(message, roll);
    }
    if ( acao === "gm-reverter" ) {
      aj.bAnulaC = 0;
      aj.bIgnoraPen = 0;
      aj.cDeterminacao = 0;
      return salvar(message, roll);
    }
    return;
  }

  if ( !podeEditar(message) ) {
    return ui.notifications.warn(game.i18n.localize("ASSIMILACAO.Avisos.naoDono"));
  }

  switch ( acao ) {
    case "alternar": {
      if ( o.travado ) return;
      const i = Number(dataset.indice);
      const sel = new Set(o.mantidos);
      const { max } = roll.limitesManter;
      if ( sel.has(i) ) sel.delete(i);
      else {
        if ( sel.size >= max ) {
          if ( max === 1 ) sel.clear();
          else return ui.notifications.info(game.i18n.format("ASSIMILACAO.Avisos.maxMantidos", { max }));
        }
        sel.add(i);
      }
      o.mantidos = [...sel].sort((a, b) => a - b);
      return salvar(message, roll);
    }
    case "sugerir": {
      if ( o.travado ) return;
      o.mantidos = roll.sugerirMantidos();
      return salvar(message, roll);
    }
    case "confirmar": {
      if ( o.travado ) return;
      const { min, max } = roll.limitesManter;
      const n = o.mantidos.length;
      if ( (n < min) || (n > max) ) {
        return ui.notifications.warn(game.i18n.format("ASSIMILACAO.Avisos.qtdMantidos", { min, max }));
      }
      o.travado = true;
      roll.aplicarDescartes();
      return salvar(message, roll);
    }
    case "b-anula-c": {
      const r = roll.resultado;
      if ( !roll.podeAnularC || (r.B < 1) || (r.C < 1) ) return;
      aj.bAnulaC += 1;
      return salvar(message, roll);
    }
    case "b-ignora-pen": {
      const r = roll.resultado;
      if ( (r.B < 1) || (r.penRestante < 1) ) return;
      aj.bIgnoraPen += 1;
      return salvar(message, roll);
    }
    case "bb-ativa": {
      const r = roll.resultado;
      if ( !o.exigeBB || (r.B < 2) || r.ativou ) return;
      aj.bIgnoraPen += 2;
      return salvar(message, roll);
    }
  }
}
