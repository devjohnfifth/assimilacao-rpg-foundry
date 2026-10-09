/**
 * Integração com Dice So Nice (seção 3.10 e 26.6 da especificação).
 * Preset "Livro": dado cor osso, ícones em tinta e arestas verde-oliva, como as planificações da p. 35.
 */
const SIS = "systems/assimilacao";
const FORMAS = { q: "d6", l: "d10", p: "d12" };

export function registrarDiceSoNice() {
  Hooks.once("diceSoNiceReady", dice3d => {
    dice3d.addSystem({ id: "assimilacao", name: "Assimilação RPG" }, "preferred");

    dice3d.addColorset({
      name: "asm-livro",
      description: "Assimilação — Livro (osso e tinta)",
      category: "Assimilação RPG",
      foreground: "#1d1a1b",
      background: "#f2eee6",
      outline: "#5a7040",
      edge: "#5a7040",
      texture: "none",
      material: "plastic"
    }, "default");

    for ( const [denom, forma] of Object.entries(FORMAS) ) {
      const faces = CONFIG.ASSIMILACAO.FACES[denom];
      const labels = Object.keys(faces)
        .sort((a, b) => Number(a) - Number(b))
        .map(n => faces[n] ? `${SIS}/assets/dsn/${faces[n]}.png` : " ");
      dice3d.addDicePreset({
        type: `d${denom}`,
        labels,
        system: "assimilacao",
        colorset: "asm-livro"
      }, forma);
    }
  });
}
