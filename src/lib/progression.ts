import { UserAccount } from '../types';

export const ECONOMIC_LEVELS = [
  {
    level: 1,
    name: "Participante",
    description: "Iniciando a jornada econômica e conhecendo o sistema.",
    criteria: "Nível inicial para todos os usuários.",
    requirements: { transactions: 0, diversity: 0 }
  },
  {
    level: 2,
    name: "Colaborador",
    description: "Aquele que já contribui com pequenas movimentações.",
    criteria: "5 transações e pelo menos 1 compra no mercado.",
    requirements: { transactions: 5, purchases: 1 }
  },
  {
    level: 3,
    name: "Empreendedor",
    description: "Iníciou atividades comerciais e criação de valor.",
    criteria: "15 transações, 3 compras e 1 venda ou curso criado.",
    requirements: { transactions: 15, purchases: 3, special: 1 } // special = sales + coursesCreated
  },
  {
    level: 4,
    name: "Articulador",
    description: "Um elo importante na circulação de recursos.",
    criteria: "30 transações, 5 compras e 3 ações especiais.",
    requirements: { transactions: 30, purchases: 5, special: 3 }
  },
  {
    level: 5,
    name: "Estrategista",
    description: "Envolvimento avançado com planejamento e execução.",
    criteria: "50 transações, 10 compras e 7 ações especiais.",
    requirements: { transactions: 50, purchases: 10, special: 7 }
  },
  {
    level: 6,
    name: "Mestre Econômico",
    description: "Referência em atividade e diversidade econômica.",
    criteria: "80 transações, 15 compras e 15 ações especiais.",
    requirements: { transactions: 80, purchases: 15, special: 15 }
  },
  {
    level: 7,
    name: "Patrono",
    description: "Nível máximo de engajamento e fomento ao sistema.",
    criteria: "120 transações, 30 compras e 25 ações especiais.",
    requirements: { transactions: 120, purchases: 30, special: 25 }
  }
];

export const KNOWLEDGE_ACTION_POINTS = {
  COMPLETE_LESSON: 5,
  COMPLETE_COURSE: 30,
  CREATE_COURSE: 50,
  PARTICIPATE_ACTIVITY: 10
};

export const KP_PER_LEVEL = 100;

export function calculateEconomicLevel(stats: UserAccount['stats']): number {
  if (!stats) return 1;
  
  const transactions = stats.transactionsCount || 0;
  const purchases = stats.purchasesCount || 0;
  const special = (stats.salesCount || 0) + (stats.coursesCreatedCount || 0);

  let level = 1;
  for (let i = ECONOMIC_LEVELS.length - 1; i >= 0; i--) {
    const req = ECONOMIC_LEVELS[i].requirements;
    if (
      transactions >= (req.transactions || 0) &&
      purchases >= (req.purchases || 0) &&
      special >= (req.special || 0)
    ) {
      level = ECONOMIC_LEVELS[i].level;
      break;
    }
  }
  return level;
}

export function getKnowledgeProgress(points: number) {
  const level = Math.floor(points / KP_PER_LEVEL) + 1;
  const progressInLevel = points % KP_PER_LEVEL;
  return {
    level,
    progressPercentage: (progressInLevel / KP_PER_LEVEL) * 100,
    currentPoints: progressInLevel,
    maxPoints: KP_PER_LEVEL
  };
}
