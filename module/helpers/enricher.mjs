/**
 * Enricher de texto: @sim[AAB] vira os ícones de Sucesso, Adaptação e Pressão;
 * @sim[■◆⬟] e @sim[qlp] viram as formas dos dados (seção 26.5).
 */
const MAPA_DADOS = { q: "quadrado", l: "losango", p: "pentagono", "■": "quadrado", "◆": "losango", "⬟": "pentagono" };

export function simbolosHTML(texto) {
  const S = CONFIG.ASSIMILACAO.SIMBOLOS;
  const span = document.createElement("span");
  span.classList.add("asm-simbolos-inline");
  for ( const c of texto ) {
    if ( S[c] ) {
      const img = document.createElement("img");
      img.src = S[c].icone;
      img.alt = c;
      img.classList.add("asm-sym", `asm-sym-${c}`);
      img.dataset.tooltip = game.i18n.localize(S[c].rotulo);
      span.append(img);
    } else if ( MAPA_DADOS[c] ) {
      const g = document.createElement("span");
      g.classList.add("asm-glifo", MAPA_DADOS[c]);
      span.append(g);
    } else span.append(document.createTextNode(c));
  }
  return span;
}

export function registrarEnricher() {
  CONFIG.TextEditor.enrichers.push({
    pattern: /@sim\[([^\]]+)\]/g,
    enricher: async match => simbolosHTML(match[1])
  });
}
