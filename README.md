# Assimilação RPG — sistema para Foundry VTT (não-oficial)

Sistema em desenvolvimento para jogar **Assimilação RPG** (Editora Assimilar) no Foundry VTT v13+ (testado na v14).
A especificação completa, capítulo por capítulo, está em [`docs/`](docs/).

## O que já funciona (v0.1.0)

- **Dados de símbolos** ■ d6, ◆ d10 e ⬟ d12 (`dq`, `dl`, `dp`), com as faces do livro (p. 35 e 43):
  Sucesso, Adaptação e Pressão. Modificadores `sim`, `sa`, `sb`, `sc` para contar símbolos (ex.: `3dlsim` = dano).
- **Teste de Ação**: diálogo "Montar Teste" (Instinto + Conhecimento/Prática ou Rolagem Assimilada),
  Origens (1x por sessão), Empenho, bônus de dados, custos em d/e decididos antes de rolar.
- **Card de rolagem** no chat: escolha dos dados mantidos com sugestão automática, penalidades de Saúde,
  uso de Adaptação para anular Pressão ou ignorar penalidade, botão do(a) Assimilador(a) para abater Determinação.
- **Ficha de Infectado(a)** no visual da ficha oficial: Aptidões, Saúde em seis níveis com gotas,
  Cabo de Guerra com os 10 laços, Características, Assimilações por naipe, Inventário e notas.
- **Itens**: Característica, Equipamento e Mutação.
- **Dice So Nice**: dados cor de osso com os ícones dos símbolos.
- Fontes livres que lembram o livro (Barlow Semi Condensed, EB Garamond, Grape Nuts, Special Elite, Rock Salt).

## Próximos passos (roadmap da especificação, seção 24)

Assistente de criação, Baralho de Assimilações e Teste de Assimilação, Partitura de Conflito e Ameaças,
Baralho de Eventos, Regiões e Refúgios, tabelas 6×6 e jogo solo.

## Instalação

**Pelo instalador do Foundry (mais fácil):** na tela de Setup, vá em **Sistemas de Jogo → Instalar Sistema**
e cole a URL de manifesto:

```
https://raw.githubusercontent.com/devjohnfifth/assimilacao-rpg-foundry/main/system.json
```

Depois crie um mundo com o sistema **Assimilação RPG**. As atualizações aparecem no próprio Foundry.

**Para desenvolvimento:** copie esta pasta para `Data/systems/assimilacao` (o nome da pasta precisa ser
`assimilacao`) ou rode `scripts/instalar.ps1` no PowerShell.

## Publicar uma versão nova

1. Suba `version` no `system.json` (ex.: `0.2.0`).
2. Rode `scripts/empacotar.ps1` para regerar `dist/assimilacao.zip`.
3. Faça o commit e o push para `main` (GitHub Desktop). O Foundry de quem instalou pelo link
   vai oferecer a atualização, porque o manifesto aponta para o `system.json` da `main`.

## Macros

```js
// Rolagem livre mantendo todos os dados (ex.: dano de 3◆)
game.assimilacao.rolar("3dl", { tipo: "dano", titulo: "Mordida" });
// Abrir o teste de um ator
game.actors.getName("Nome").rolarTeste({ aptidao: "atletismo" });
```

## Direitos autorais

Assimilação RPG, seus textos, cartas, ilustrações e o nome pertencem à Editora Assimilar.
Este sistema não inclui textos nem artes do livro; os ícones dos símbolos são desenhos próprios
e as fontes são livres (licenças em `assets/fonts/`). Uso pessoal de mesa, sem fins comerciais.
