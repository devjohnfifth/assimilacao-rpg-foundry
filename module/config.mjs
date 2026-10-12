/**
 * CONFIG.ASSIMILACAO — tabelas fixas do livro.
 * Fonte: Assimilação RPG, Livro Básico (Editora Assimilar).
 */

const SIS = "systems/assimilacao";

/** Símbolos de cada face (p. 35 e p. 43). Índice = face numérica. */
export const FACES = {
  q: { 1: "", 2: "", 3: "C", 4: "C", 5: "BC", 6: "A" },
  l: { 1: "", 2: "", 3: "C", 4: "C", 5: "BC", 6: "A", 7: "AA", 8: "AB", 9: "ABC", 10: "AAC" },
  p: { 1: "", 2: "", 3: "C", 4: "C", 5: "BC", 6: "A", 7: "AA", 8: "AB", 9: "ABC", 10: "AAC", 11: "ABBC", 12: "CC" }
};

export const DADOS = {
  q: { faces: 6, forma: "quadrado", glifo: "■", rotulo: "ASSIMILACAO.Dado.q" },
  l: { faces: 10, forma: "losango", glifo: "◆", rotulo: "ASSIMILACAO.Dado.l" },
  p: { faces: 12, forma: "pentagono", glifo: "⬟", rotulo: "ASSIMILACAO.Dado.p" }
};

export const SIMBOLOS = {
  A: { rotulo: "ASSIMILACAO.Simbolo.A", icone: `${SIS}/assets/simbolos/sucesso.svg` },
  B: { rotulo: "ASSIMILACAO.Simbolo.B", icone: `${SIS}/assets/simbolos/adaptacao.svg` },
  C: { rotulo: "ASSIMILACAO.Simbolo.C", icone: `${SIS}/assets/simbolos/pressao.svg` }
};

export const INSTINTOS = ["influencia", "percepcao", "potencia", "reacao", "resolucao", "sagacidade"];
export const CONHECIMENTOS = ["biologia", "erudicao", "engenharia", "geografia", "medicina", "seguranca"];
export const PRATICAS = ["armas", "atletismo", "expressao", "furtividade", "manufaturas", "sobrevivencia"];

/** Adjetivos por nível (Apêndice H da especificação; p. 44–56). */
export const ADJETIVOS = {
  influencia: ["—", "Tímida", "Equilibrada", "Persuasiva", "Magnética", "Líder"],
  percepcao: ["—", "Distraída", "Atenta", "Perspicaz", "Aguçada", "Vigilante"],
  potencia: ["—", "Fraca", "Funcional", "Forte", "Poderosa", "Titânica"],
  reacao: ["—", "Lenta", "Esperta", "Ágil", "Veloz", "Relâmpago"],
  resolucao: ["—", "Vacilante", "Estável", "Determinada", "Inquebrável", "Indomável"],
  sagacidade: ["—", "Ingênua", "Razoável", "Astuta", "Brilhante", "Genial"],
  biologia: ["Leiga", "Curiosa", "Naturalista", "Bióloga", "Especialista", "Pioneira"],
  erudicao: ["Leiga", "Informada", "Estudante", "Erudita", "Mentora", "Iluminada"],
  engenharia: ["Leiga", "Entusiasta", "Técnica", "Engenheira", "Inventora", "Visionária"],
  geografia: ["Leiga", "Inexperiente", "Viajante", "Exploradora", "Geógrafa", "Doutora em Geografia"],
  medicina: ["Leiga", "Primeiros Socorros", "Estudiosa de Medicina", "Médica", "Cirurgiã ou Pesquisadora", "Cientista Disruptiva"],
  seguranca: ["Leiga", "Precavida", "Vigia", "Protetora", "Estrategista", "Guardiã"],
  armas: ["Inábil", "Aficionada", "Habilidosa", "Duelista", "Armeira", "Veterana"],
  atletismo: ["Inábil", "Funcional", "Praticante", "Atleta", "Alta-Performance", "Imbatível"],
  expressao: ["Inábil", "Acanhada", "Comunicadora", "Persuasiva", "Encantadora", "Ícone"],
  furtividade: ["Inábil", "Discreta", "Cuidadosa", "Infiltradora", "Ninja", "Fantasma"],
  manufaturas: ["Inábil", "Coordenada", "Prendada", "Artesã", "Construtora", "Inovadora"],
  sobrevivencia: ["Inábil", "Campista", "Escoteira", "Patrulheira", "Mateira", "Exploradora"]
};

/** Níveis de Saúde (p. 52, 65–67 e ficha p. 313). */
export const SAUDE = {
  6: { nome: "Saudável", faixa: "alta", penalidadeA: 0 },
  5: { nome: "Escoriação", faixa: "alta", penalidadeA: 0 },
  4: { nome: "Laceração", faixa: "media", penalidadeA: 1 },
  3: { nome: "Ferimentos", faixa: "media", penalidadeA: 1 },
  2: { nome: "Debilitação", faixa: "critica", penalidadeA: 2 },
  1: { nome: "Incapacitação", faixa: "critica", penalidadeA: 0, exigeBB: true }
};

export const GERACOES = {
  pre: "ASSIMILACAO.Geracao.pre",
  colapso: "ASSIMILACAO.Geracao.colapso",
  pos: "ASSIMILACAO.Geracao.pos"
};

export const NAIPES = {
  copas: { glifo: "♥", rotulo: "ASSIMILACAO.Naipe.copas", categoria: "Evolutivas", icone: `${SIS}/assets/simbolos/sucesso.svg` },
  ouros: { glifo: "♦", rotulo: "ASSIMILACAO.Naipe.ouros", categoria: "Adaptativas", icone: `${SIS}/assets/simbolos/adaptacao.svg` },
  espadas: { glifo: "♠", rotulo: "ASSIMILACAO.Naipe.espadas", categoria: "Inoportunas", icone: `${SIS}/assets/simbolos/pressao.svg` },
  paus: { glifo: "♣", rotulo: "ASSIMILACAO.Naipe.paus", categoria: "Singulares", icone: `${SIS}/assets/simbolos/araucaria.svg` }
};

export const LOCAIS_INVENTARIO = {
  corpo: "ASSIMILACAO.Inventario.corpo",
  mochila: "ASSIMILACAO.Inventario.mochila",
  refugio: "ASSIMILACAO.Inventario.refugio"
};

export const ESCOPOS = {
  rodada: "ASSIMILACAO.Escopo.rodada",
  cena: "ASSIMILACAO.Escopo.cena",
  repouso: "ASSIMILACAO.Escopo.repouso",
  dia: "ASSIMILACAO.Escopo.dia",
  semana: "ASSIMILACAO.Escopo.semana",
  sessao: "ASSIMILACAO.Escopo.sessao",
  arco: "ASSIMILACAO.Escopo.arco",
  livre: "ASSIMILACAO.Escopo.livre"
};

/** Escala de consequências por quantidade de C (p. 40). */
export const CONSEQUENCIAS = ["", "menor", "relevante", "séria", "grave", "crítica", "devastadora"];

/** Nível do grupo para o balanceamento (p. 206–211). */
export const NIVEIS = {
  iniciante: "ASSIMILACAO.Nivel.iniciante",
  intermediario: "ASSIMILACAO.Nivel.intermediario",
  avancado: "ASSIMILACAO.Nivel.avancado",
  epico: "ASSIMILACAO.Nivel.epico"
};

/**
 * Valor recomendado do pool (■ = 1, ◆ = 2, ⬟ = 3): base + por Infectado (p. 206–208).
 * Uma Ameaça que é o único gerador do Conflito usa a faixa do Conflito.
 */
export const BALANCEAMENTO = {
  conflito: { iniciante: [3, 1], intermediario: [6, 2], avancado: [9, 3], epico: [12, 4] },
  ameaca: { iniciante: [2, 1], intermediario: [4, 2], avancado: [6, 3], epico: [8, 4] }
};

export const VALOR_DADO = { q: 1, l: 2, p: 3 };

/** Relação de um Personagem do(a) Assimilador(a) com o grupo (p. 249). */
export const RELACOES = {
  aliado: "ASSIMILACAO.Relacao.aliado",
  neutro: "ASSIMILACAO.Relacao.neutro",
  hostil: "ASSIMILACAO.Relacao.hostil",
  desconhecido: "ASSIMILACAO.Relacao.desconhecido"
};

/** Intenção do Conflito (p. 207): orienta o peso das Ativações de A e de C. */
export const INTENCOES = {
  hostil: "ASSIMILACAO.Intencao.hostil",
  neutra: "ASSIMILACAO.Intencao.neutra",
  amigavel: "ASSIMILACAO.Intencao.amigavel"
};

/** Escala do Conflito (p. 208): Simples ou Clímax. */
export const ESCALAS = {
  simples: "ASSIMILACAO.Escala.simples",
  climax: "ASSIMILACAO.Escala.climax"
};

/** Dificuldades de jogo (p. 211; seção 3.8): ⬟ extras rolados em todo pool de Conflito e Ameaça. */
export const DIFICULDADES = {
  exploracao: { rotulo: "ASSIMILACAO.Dificuldade.exploracao", extra: 0 },
  sofrimento: { rotulo: "ASSIMILACAO.Dificuldade.sofrimento", extra: 1 },
  desastre: { rotulo: "ASSIMILACAO.Dificuldade.desastre", extra: 2 },
  colapso: { rotulo: "ASSIMILACAO.Dificuldade.colapso", extra: 3 }
};

/** Objetivos (p. 199–205; seção 10.2). */
export const CATEGORIAS_OBJETIVO = {
  principal: "ASSIMILACAO.Objetivo.categoria.principal",
  secundario: "ASSIMILACAO.Objetivo.categoria.secundario"
};
export const ACUMULOS = {
  coletivo: "ASSIMILACAO.Objetivo.acumulo.coletivo",
  individual: "ASSIMILACAO.Objetivo.acumulo.individual"
};
export const REPETICOES = {
  unica: "ASSIMILACAO.Objetivo.repeticao.unica",
  porInfectado: "ASSIMILACAO.Objetivo.repeticao.porInfectado",
  multipla: "ASSIMILACAO.Objetivo.repeticao.multipla"
};

/** Fases de uma rodada de Conflito (p. 69–72; seção 10.4). */
export const FASES = {
  preparacao: "ASSIMILACAO.Fase.preparacao",
  infectados: "ASSIMILACAO.Fase.infectados",
  assimilador: "ASSIMILACAO.Fase.assimilador",
  fim: "ASSIMILACAO.Fase.fim",
  encerrado: "ASSIMILACAO.Fase.encerrado"
};

export const ASSIMILACAO = {
  FACES, DADOS, SIMBOLOS, INSTINTOS, CONHECIMENTOS, PRATICAS, ADJETIVOS, SAUDE, GERACOES,
  NAIPES, LOCAIS_INVENTARIO, ESCOPOS, CONSEQUENCIAS, NIVEIS, BALANCEAMENTO, VALOR_DADO, RELACOES,
  INTENCOES, ESCALAS, DIFICULDADES, CATEGORIAS_OBJETIVO, ACUMULOS, REPETICOES, FASES,
  CABO_TOTAL: 10,
  TETO_MANTIDOS: 4
};
