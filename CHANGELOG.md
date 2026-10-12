# Histórico de versões

## 0.3.0
- Partitura de Conflito completa: novo ator Conflito (pool, Condicionantes, Ativações, Objetivos, Ameaças vinculadas)
  e janela da cena para GM e jogadores, com rodadas, fases, presentes, fuga individual e registro.
- Novos itens: Objetivo (custo por Infectado, coletivo ou individual, uma vez, por Infectado ou repetível, vínculo
  com a Neutralização de uma Ameaça) e Condicionante.
- Saldo do(a) Assimilador(a): pools rolados viram A/B/C a investir nas casas; desmarcar devolve ao saldo; a fase não
  avança com A ou C sobrando nem com Ativação completa sem disparar.
- Dificuldades de jogo (Exploração, Sofrimento, Desastre, Colapso) com ⬟ extras e escolha dos mantidos.
- Card de teste em Conflito: botões para investir os A nos Objetivos e na Neutralização; GM leva as C para a partitura.
- Card de dano: GM aplica o dano aos tokens marcados como alvo.
- Ameaça pode virar o próprio Conflito com um clique.
- Macro "Abrir Partitura de Conflito".

## 0.2.0
- Personagens do(a) Assimilador(a) (NPCs): relação com o grupo, grupo, segredos só do GM e ficha simplificada.
- Ameaças: ficha no visual da partitura, pool próprio, Ativações com casas de custo, disparo com dano rolado ou fixo,
  uso único, Neutralização que cresce com os Infectados presentes e assistente de balanceamento (p. 206–211).
- Novo item: Ativação.
- Compêndio "Macros do Assimilação" com seis macros; a macro Rolar Teste abre a lista quando você tem mais de um personagem.
- Fim de cena, repouso e nova sessão renovam os usos das Características e Mutações conforme a renovação de cada uma.
- API: `abrirTeste`, `escolherAtor`, `rolarDadosDialogo`, `encerrarCenaGrupo`, `repousoGrupo`, `novaSessaoGrupo`, `rolarPoolAmeaca`.

## 0.1.1
- Contraste: campos, listas e caixas de marcar legíveis no tema escuro do Foundry (tinta sobre papel).
- Ícones da barra de título das fichas voltaram a aparecer.
- Naipes das Mutações aparecem com o nome (♥ Evolutivas, ♦ Adaptativas, ♠ Inoportunas, ♣ Singulares).
- Diálogo "Montar Teste": o resumo atualiza sem redesenhar os campos; o clique em Rolar não se perde e o clique duplo não rola duas vezes.
- Ficha se adapta a janelas estreitas (tablet): colunas empilhadas, sem rolagem lateral.
- Dice So Nice: dados de petróleo marmorizado com ícones brancos, inspirados nos dados oficiais; margens próprias para d6, d10 e d12 (ícones não são mais cortados).
- Suíte de testes automáticos: `game.assimilacao.testar()`.

## 0.1.0
- Primeira versão: dados ■◆⬟, Teste de Ação com escolha de dados no chat, ficha de Infectado(a), Cabo de Guerra, Saúde, itens e Dice So Nice.
