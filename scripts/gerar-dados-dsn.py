"""
Gera os arquivos do Dice So Nice do sistema Assimilação:
  - assets/dsn/marmore-petroleo.webp  (textura dos dados, inspirada nos dados oficiais de resina)
  - assets/dsn/{q,l,p}/{COMBO}.png    (rótulos das faces: ícones brancos com contorno escuro)

Cada tipo de dado tem a área útil ajustada à face que o Dice So Nice desenha
(quadrado no d6, pipa no d10, pentágono no d12), para os ícones não serem cortados.

Uso:  python scripts/gerar-dados-dsn.py      (requer numpy, pillow, cairosvg)
"""
import io
import os
import numpy as np
import cairosvg
from PIL import Image, ImageFilter

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "dsn")
S = 512
rng = np.random.default_rng(7)


def ruido(oitavas):
    tot = np.zeros((S, S))
    amp, soma = 1.0, 0.0
    for o in range(oitavas):
        n = 4 * 2 ** o
        g = rng.random((n + 1, n + 1))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)
        tot += amp * (np.asarray(im) / 255.0)
        soma += amp
        amp *= 0.5
    return tot / soma


def textura():
    y, x = np.mgrid[0:S, 0:S] / S
    t1, t2 = ruido(6), ruido(5)
    veio = np.sin((x * 2.6 + y * 1.5) * np.pi * 2 + t1 * 10.0)
    veio2 = np.sin((x * -1.2 + y * 2.2) * np.pi * 2 + t2 * 8.0)
    v = 0.6 * (veio + 1) / 2 + 0.25 * (veio2 + 1) / 2 + 0.15 * t1
    v = (v - v.min()) / (v.max() - v.min())
    v = v ** 1.35
    pal = np.array([[3, 24, 32], [8, 50, 62], [18, 82, 95], [52, 132, 142], [150, 200, 204]], float)
    pos = np.array([0.0, 0.33, 0.6, 0.85, 1.0])
    cor = np.stack([np.interp(v, pos, pal[:, c]) for c in range(3)], -1)
    fio = np.clip(1 - np.abs(np.sin((x * 4 + t2 * 3.5) * np.pi * 3)) * 14, 0, 1) * 0.45
    cor = cor + fio[..., None] * np.array([110, 170, 175])
    Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8)).save(os.path.join(RAIZ, "marmore-petroleo.webp"), quality=88)


NOMES = {"A": "sucesso", "B": "adaptacao", "C": "pressao"}
# centro (x, y) e lado da área útil, em fração do quadro da face no Dice So Nice
GEOM = {"q": (0.5, 0.52, 0.66), "l": (0.5, 0.60, 0.44), "p": (0.5, 0.54, 0.52)}
ARRANJO = {
    1: [(0, 0, 1.0)],
    2: [(-.27, 0, .56), (.27, 0, .56)],
    3: [(0, -.25, .5), (-.26, .2, .5), (.26, .2, .5)],
    4: [(-.25, -.24, .48), (.25, -.24, .48), (-.25, .24, .48), (.25, .24, .48)]
}
COMBOS = ["C", "BC", "A", "AA", "AB", "ABC", "AAC", "ABBC", "CC"]


def icone(nome, tam):
    png = cairosvg.svg2png(url=os.path.join(RAIZ, "fonte", f"{nome}.svg"), output_width=tam, output_height=tam)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def com_contorno(im):
    alfa = im.split()[3]
    sombra = alfa.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    base = Image.new("RGBA", im.size, (0, 20, 26, 0))
    base.putalpha(sombra.point(lambda p: int(p * 0.75)))
    base.alpha_composite(im)
    return base


def rotulos():
    for d, (cx, cy, area) in GEOM.items():
        os.makedirs(os.path.join(RAIZ, d), exist_ok=True)
        for combo in COMBOS:
            quadro = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            for ch, (dx, dy, esc) in zip(combo, ARRANJO[len(combo)]):
                tam = int(S * area * esc)
                im = icone(NOMES[ch], tam)
                px = int(S * (cx + dx * area) - tam / 2)
                py = int(S * (cy + dy * area) - tam / 2)
                quadro.alpha_composite(im, (px, py))
            com_contorno(quadro).save(os.path.join(RAIZ, d, f"{combo}.png"))


if __name__ == "__main__":
    textura()
    rotulos()
    print("Arquivos do Dice So Nice gerados em", os.path.normpath(RAIZ))
