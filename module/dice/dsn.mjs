/**
 * Integração com Dice So Nice (seções 3.10 e 26.6 da especificação).
 * Visual inspirado nos dados oficiais de resina: petróleo marmorizado com ícones brancos.
 * Os rótulos de cada tipo de dado têm margens próprias para caber na face (quadrado, pipa, pentágono).
 * Os arquivos são gerados por scripts/gerar-dados-dsn.py.
 */
const SIS = "systems/assimilacao";
const FORMAS = { q: "d6", l: "d10", p: "d12" };

export function registrarDiceSoNice() {
  Hooks.once("diceSoNiceReady", async dice3d => {
    try {
      dice3d.addSystem({ id: "assimilacao", name: "Assimilação RPG" }, "preferred");

      await dice3d.addTexture("asm-marmore", {
        name: "Assimilação — mármore petróleo",
        composite: "source-over",
        source: `${SIS}/assets/dsn/marmore-petroleo.webp`,
        bump: ""
      });

      await dice3d.addColorset({
        name: "asm-petroleo",
        description: "Assimilação — petróleo marmorizado",
        category: "Assimilação RPG",
        foreground: "#ffffff",
        background: "#0a3a46",
        outline: "none",
        edge: "#06303a",
        texture: "asm-marmore",
        material: "plastic"
      }, "default");

      for ( const [denom, forma] of Object.entries(FORMAS) ) {
        const faces = CONFIG.ASSIMILACAO.FACES[denom];
        const imagens = Object.keys(faces)
          .sort((a, b) => Number(a) - Number(b))
          .map(n => faces[n] ? `${SIS}/assets/dsn/${denom}/${faces[n]}.png` : " ");
        dice3d.addDicePreset({
          type: `d${denom}`,
          labels: imagens,
          bumpMaps: imagens.map(i => (i === " " ? "" : i)),
          system: "assimilacao",
          colorset: "asm-petroleo"
        }, forma);
      }
    } catch(err) {
      console.error("Assimilação | Falha ao registrar os dados no Dice So Nice", err);
    }
  });
}
