# Assimilação RPG — sistema para Foundry VTT (não-oficial)

Sistema em desenvolvimento para jogar **Assimilação RPG** (Editora Assimilar) no Foundry VTT v13+ (testado na v14).
A especificação completa, capítulo por capítulo, está em [`docs/`](docs/).

## O que já funciona (v0.3.0)

- **Dados de símbolos** ■ d6, ◆ d10 e ⬟ d12 (`dq`, `dl`, `dp`), com as faces do livro (p. 35 e 43):
  Sucesso, Adaptação e Pressão. Modificadores `sim`, `sa`, `sb`, `sc` para contar símbolos (ex.: `3dlsim` = dano).
- **Teste de Ação**: diálogo "Montar Teste" (Instinto + Conhecimento/Prática ou Rolagem Assimilada),
  Origens (1x por sessão), Empenho, bônus de dados, custos em d/e decididos antes de rolar.
- **Card de rolagem** no chat: escolha dos dados mantidos com sugestão automática, penalidades de Saúde,
  uso de Adaptação para anular Pressão ou ignorar penalidade, botão do(a) Assimilador(a) para abater Determinação.
- **Ficha de Infectado(a)** no visual da ficha oficial: Aptidões, Saúde em seis níveis com gotas,
  Cabo de Guerra com os 10 laços, Características, Assimilações por naipe, Inventário e notas.
- **Personagens do(a) Assimilador(a)** (NPCs): mesma ficha, com relação com o grupo, segredos que só o(a) GM vê
  e modo simplificado para figurantes (só Aptidões, Saúde e Cabo de Guerra).
- **Ameaças** no visual das partituras do livro: pool próprio, Ativações com custo desenhado em casas de símbolos
  (progresso parcial, disparo com dano rolado ou fixo, uso único), Neutralização que escala com os Infectados presentes
  e assistente de balanceamento (valor do pool × recomendado por nível do grupo).
- **Partitura de Conflito** (p. 68–72, 194–225): Conflito com pool, Condicionantes, Ativações, Objetivos Principais e
  Secundários (custo que cresce com os Infectados presentes; acúmulo coletivo ou individual, como na Fuga) e Ameaças
  vinculadas. A cena roda numa janela própria, para GM e jogadores: rodadas e fases, quem está presente e quem fugiu,
  pools rolados viram saldo a investir nas casas das Ativações (a fase não avança com A ou C sobrando), dificuldades
  Sofrimento/Desastre/Colapso com escolha dos ⬟ mantidos, e os jogadores investem os A dos testes nos Objetivos direto
  pelo card do chat. Uma Ameaça pode virar o próprio Conflito com um clique.
- **Itens**: Característica, Equipamento, Mutação, Ativação, Objetivo e Condicionante.
- **Compêndio "Macros do Assimilação"**: Rolar Teste (abre o teste do seu personagem ou a lista, se houver mais de um),
  Rolar Dados, Fim de Cena, Repouso Completo e Nova Sessão do grupo, Rolar Pool da Ameaça e Abrir Partitura de Conflito.
- **Dice So Nice**: dados de petróleo marmorizado com os ícones brancos dos símbolos, como os dados oficiais de resina.
- Fontes livres que lembram o livro (Barlow Semi Condensed, EB Garamond, Grape Nuts, Special Elite, Rock Salt).

## Próximos passos (roadmap da especificação, seção 24)

Assistente de criação, Baralho de Assimilações e Teste de Assimilação, usos de B em Conflito (Ajudar/Apoiar Aliado,
Adaptar Ação Anterior), simulador do balanceador, Baralho de Eventos, Regiões e Refúgios, tabelas 6×6 e jogo solo.

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
2. Se mexeu nos compêndios (`packs/_source/`), feche o mundo e rode `npm install` e `npm run build:packs`.
3. Rode `scripts/empacotar.ps1` para regerar `dist/assimilacao.zip`.
4. Faça o commit e o push para `main` (GitHub Desktop). O Foundry de quem instalou pelo link
   vai oferecer a atualização, porque o manifesto aponta para o `system.json` da `main`.

## Testes automáticos

Como GM, num mundo de teste, rode no console (F12) ou numa macro:

```js
game.assimilacao.testar()
```

A suíte cria um ator e mensagens temporários, verifica regras, ficha, diálogo de teste, card do chat,
itens, temas claro e escuro, Dice So Nice, chaves de idioma e erros no console, apaga o que criou e
publica o relatório no chat e no diário "Relatório de testes — Assimilação".

## Macros

As macros prontas estão no compêndio **Macros do Assimilação** (arraste para a barra de atalhos).
Para escrever as suas:

```js
// Abre o teste do seu personagem (token selecionado → seu personagem → lista para escolher)
game.assimilacao.abrirTeste();
game.assimilacao.abrirTeste({ aptidao: "atletismo" });
// Rolagem livre mantendo todos os dados (ex.: dano de 3◆)
game.assimilacao.rolar("3dl", { tipo: "dano", titulo: "Mordida" });
// Diálogo para rolar ■ ◆ ⬟ avulsos
game.assimilacao.rolarDadosDialogo();
// Ações em grupo (pedem confirmação)
game.assimilacao.encerrarCenaGrupo();
game.assimilacao.repousoGrupo();
game.assimilacao.novaSessaoGrupo();
// Pool da Ameaça do token selecionado
game.assimilacao.rolarPoolAmeaca();
// Partitura do Conflito em andamento
game.assimilacao.abrirPartitura();
// Motor da cena (GM): iniciar, avançar fase, encerrar
const c = game.actors.getName("Bloqueio na Estrada");
await game.assimilacao.conflito.iniciar(c, { iniciante: "infectados", motivo: "A estrada foi fechada" });
await game.assimilacao.conflito.proximaFase(c);
await game.assimilacao.conflito.encerrar(c, { fimDeCena: true });
```

### Como rodar um Conflito

1. Crie um ator do tipo **Conflito** (já vem com o Objetivo Fuga). Monte as Ativações, os Objetivos e as
   Condicionantes, e arraste as Ameaças do diretório para a ficha.
2. Clique em **Iniciar Conflito**: escolha o motivo, quem começa e quem está presente. A Partitura abre para todos.
3. Turno dos Infectados: cada jogador rola o teste (já marcado "em Conflito") e, depois de escolher os dados,
   clica no Objetivo no card para investir os A (Shift: todos). O GM pode levar as C do teste para a partitura.
4. Turno do(a) Assimilador(a): **Rolar pools**; os símbolos viram saldo; clique nas casas das Ativações para investir;
   dispare as completas. A fase só avança com todos os A e C investidos (Shift força).
5. **Encerrar Conflito** publica o resumo, faz o fim de cena dos presentes e, se pedido, zera a partitura.

## Direitos autorais

Assimilação RPG, seus textos, cartas, ilustrações e o nome pertencem à Editora Assimilar.
Este sistema não inclui textos nem artes do livro; os ícones dos símbolos são desenhos próprios
e as fontes são livres (licenças em `assets/fonts/`). Uso pessoal de mesa, sem fins comerciais.
