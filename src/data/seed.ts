import type { HubState, MemberProfile, Project } from '../types';

const now = '2026-09-26T12:00:00.000Z';

const memberSamples = {
  ana: {
    memberId: 'member-ana',
    name: 'Ana Clara',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ana%20Clara',
    role: 'UX/UI',
    contributionIntent: 'Mapear jornadas, prototipar fluxos e validar acessibilidade.',
    joinedAt: now
  },
  bruno: {
    memberId: 'member-bruno',
    name: 'Bruno Lima',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Bruno%20Lima',
    role: 'Backend',
    contributionIntent: 'Modelar APIs, autenticação e regras de negócio.',
    joinedAt: now
  },
  carol: {
    memberId: 'member-carol',
    name: 'Carol Nunes',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Carol%20Nunes',
    role: 'Data Analysis',
    contributionIntent: 'Criar análises, indicadores e visualizações claras.',
    joinedAt: now
  },
  diego: {
    memberId: 'member-diego',
    name: 'Diego Torres',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Diego%20Torres',
    role: 'QA',
    contributionIntent: 'Definir cenários, testes exploratórios e suíte end-to-end.',
    joinedAt: now
  }
};

export const initialProfile: MemberProfile = {
  id: 'member-you',
  name: 'Artur Ribeiro',
  avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Artur%20Ribeiro',
  bio: 'Membro da comunidade Focus interessado em construir projetos reais com squads multidisciplinares.',
  primaryRole: 'Full Stack',
  secondaryRoles: ['Backend', 'Product'],
  areas: ['Full Stack', 'Backend', 'Product'],
  technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  interests: ['Projetos colaborativos', 'Arquitetura', 'APIs', 'Mentoria técnica'],
  availability: '6 horas por semana',
  links: {
    github: 'https://github.com/',
    linkedin: 'https://www.linkedin.com/'
  },
  currentProjectIds: [],
  completedProjectIds: [],
  evidence: [
    {
      id: 'evidence-profile-created',
      label: 'Perfil inicial criado no Focus Hub',
      recordedAt: now
    }
  ]
};

export const initialProjects: Project[] = [
  {
    id: 'template-help-desk',
    name: 'Sistema de Chamados / Help Desk',
    shortDescription: 'Fluxo de abertura, triagem, priorização e resolução de chamados internos ou de clientes.',
    category: 'Operações',
    status: 'Aberto',
    memberLimit: 6,
    suggestedTechnologies: ['Java', 'Spring', 'React', 'PostgreSQL', 'Docker'],
    recommendedAreas: ['Backend', 'Frontend', 'QA', 'UX/UI', 'Product'],
    difficulty: 'Intermediário',
    suggestedDuration: '4 a 6 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Backend', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'UX/UI', amount: 1 },
      { role: 'QA', amount: 1 }
    ],
    possibleStacks: [
      'Java + Spring + React',
      'Node.js + TypeScript + Vue',
      'Python + FastAPI + Angular',
      '.NET + React'
    ],
    outcomes: ['CRUD de chamados', 'Controle de status', 'Histórico de interações', 'Painel de métricas'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.ana, memberSamples.bruno]
  },
  {
    id: 'template-library',
    name: 'Sistema de Biblioteca',
    shortDescription: 'Cadastro de acervo, empréstimos, devoluções, reservas e histórico de leitores.',
    category: 'Educação',
    status: 'Em formação',
    memberLimit: 5,
    suggestedTechnologies: ['Java', 'Spring', 'Python', 'FastAPI', 'React', 'Angular', 'PostgreSQL'],
    recommendedAreas: ['Backend', 'Frontend', 'UX/UI', 'QA'],
    difficulty: 'Iniciante',
    suggestedDuration: '3 a 5 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Backend', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'UX/UI', amount: 1 },
      { role: 'QA', amount: 1 }
    ],
    possibleStacks: [
      'Java + Spring + React',
      'Python + FastAPI + React',
      'PHP + JavaScript',
      '.NET + Angular',
      'Outras combinações definidas pela squad'
    ],
    outcomes: ['Catálogo pesquisável', 'Fluxo de empréstimo', 'Reservas', 'Relatórios simples'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.diego]
  },
  {
    id: 'template-delivery',
    name: 'Sistema de Delivery',
    shortDescription: 'Cardápio, pedidos, acompanhamento de entrega e visão operacional para estabelecimentos.',
    category: 'Comércio',
    status: 'Aberto',
    memberLimit: 7,
    suggestedTechnologies: ['React Native', 'Flutter', 'Node.js', 'PostgreSQL', 'Docker'],
    recommendedAreas: ['Mobile', 'Backend', 'Frontend', 'UX/UI', 'QA', 'Product'],
    difficulty: 'Avançado',
    suggestedDuration: '6 a 8 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Mobile', amount: 1 },
      { role: 'Backend', amount: 1 },
      { role: 'UX/UI', amount: 1 },
      { role: 'QA', amount: 1 }
    ],
    possibleStacks: ['Flutter + FastAPI', 'React Native + Node.js', 'Kotlin + Spring', 'Next.js + .NET'],
    outcomes: ['Catálogo de produtos', 'Carrinho', 'Acompanhamento de pedido', 'Dashboard do lojista'],
    createdBy: 'Focus Tecnologia',
    members: []
  },
  {
    id: 'template-inventory',
    name: 'Sistema de Estoque',
    shortDescription: 'Controle de entradas, saídas, níveis mínimos, fornecedores e movimentações.',
    category: 'Gestão',
    status: 'Em andamento',
    memberLimit: 6,
    suggestedTechnologies: ['C#', '.NET', 'Angular', 'MySQL', 'Docker'],
    recommendedAreas: ['Backend', 'Frontend', 'QA', 'Product'],
    difficulty: 'Intermediário',
    suggestedDuration: '4 a 6 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Backend', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'QA', amount: 1 },
      { role: 'Product', amount: 1 }
    ],
    possibleStacks: ['.NET + Angular', 'Java + Vue', 'Node.js + React', 'PHP + JavaScript'],
    outcomes: ['Movimentações de estoque', 'Alertas de reposição', 'Cadastro de fornecedores', 'Auditoria básica'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.bruno, memberSamples.diego]
  },
  {
    id: 'template-personal-finance',
    name: 'Sistema Financeiro Pessoal',
    shortDescription: 'Organização de receitas, despesas, metas, categorias e projeções simples.',
    category: 'Finanças',
    status: 'Aberto',
    memberLimit: 5,
    suggestedTechnologies: ['React', 'Next.js', 'Node.js', 'MongoDB', 'PostgreSQL'],
    recommendedAreas: ['Frontend', 'Backend', 'Data Analysis', 'UX/UI'],
    difficulty: 'Iniciante',
    suggestedDuration: '3 a 4 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Frontend', amount: 1 },
      { role: 'Backend', amount: 1 },
      { role: 'UX/UI', amount: 1 }
    ],
    possibleStacks: ['Next.js + PostgreSQL', 'React + Node.js', 'Vue + FastAPI', 'Angular + .NET'],
    outcomes: ['Lançamentos financeiros', 'Categorias', 'Metas', 'Resumo mensal'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.ana]
  },
  {
    id: 'template-public-data-dashboard',
    name: 'Dashboard de Dados Públicos',
    shortDescription: 'Coleta, tratamento e visualização de dados públicos em indicadores acessíveis.',
    category: 'Dados',
    status: 'Aberto',
    memberLimit: 6,
    suggestedTechnologies: ['Python', 'Pandas', 'Power BI', 'React', 'PostgreSQL'],
    recommendedAreas: ['Data Analysis', 'Data Engineering', 'Frontend', 'UX/UI'],
    difficulty: 'Misto',
    suggestedDuration: '4 a 6 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Data Analysis', amount: 1 },
      { role: 'Data Engineering', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'UX/UI', amount: 1 }
    ],
    possibleStacks: ['Python + Pandas + Power BI', 'Python + FastAPI + React', 'Next.js + PostgreSQL'],
    outcomes: ['Pipeline simples', 'Indicadores filtráveis', 'Visualizações responsivas', 'Documentação da fonte'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.carol]
  },
  {
    id: 'template-authentication',
    name: 'Sistema de Autenticação',
    shortDescription: 'Base reutilizável para cadastro, login, permissões, recuperação de senha e auditoria.',
    category: 'Infraestrutura de Produto',
    status: 'Aberto',
    memberLimit: 5,
    suggestedTechnologies: ['Node.js', 'TypeScript', 'Java', 'Spring', 'PostgreSQL', 'Cybersecurity'],
    recommendedAreas: ['Backend', 'Cybersecurity', 'Frontend', 'QA'],
    difficulty: 'Intermediário',
    suggestedDuration: '3 a 5 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Backend', amount: 1 },
      { role: 'Cybersecurity', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'QA', amount: 1 }
    ],
    possibleStacks: ['Node.js + TypeScript', 'Java + Spring Security', '.NET Identity', 'Django Auth'],
    outcomes: ['Login e cadastro', 'Papéis e permissões', 'Recuperação de senha', 'Checklist de segurança'],
    createdBy: 'Focus Tecnologia',
    members: []
  },
  {
    id: 'template-ngo',
    name: 'Sistema para ONG',
    shortDescription: 'Gestão de voluntários, campanhas, doações, beneficiários e prestação de contas.',
    category: 'Impacto Social',
    status: 'Em formação',
    memberLimit: 7,
    suggestedTechnologies: ['React', 'Python', 'Django', 'PostgreSQL', 'Cloud'],
    recommendedAreas: ['Product', 'UX/UI', 'Backend', 'Frontend', 'Cloud', 'QA'],
    difficulty: 'Misto',
    suggestedDuration: '5 a 7 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Product', amount: 1 },
      { role: 'UX/UI', amount: 1 },
      { role: 'Backend', amount: 1 },
      { role: 'Frontend', amount: 1 }
    ],
    possibleStacks: ['Django + React', 'Spring + Angular', 'Next.js + PostgreSQL', 'Laravel + Vue'],
    outcomes: ['Cadastro de voluntários', 'Campanhas', 'Controle de doações', 'Relatório de impacto'],
    createdBy: 'Focus Tecnologia',
    members: [memberSamples.ana, memberSamples.carol]
  },
  {
    id: 'template-small-business',
    name: 'Sistema para Pequeno Comércio',
    shortDescription: 'Cadastro de produtos, vendas, clientes, fiado, caixa e relatórios simples.',
    category: 'Comércio',
    status: 'Aberto',
    memberLimit: 6,
    suggestedTechnologies: ['PHP', 'JavaScript', 'MySQL', 'React', 'Docker'],
    recommendedAreas: ['Backend', 'Frontend', 'UX/UI', 'QA', 'Product'],
    difficulty: 'Iniciante',
    suggestedDuration: '4 a 6 semanas',
    type: 'Focus Project',
    suggestedRoles: [
      { role: 'Backend', amount: 1 },
      { role: 'Frontend', amount: 1 },
      { role: 'UX/UI', amount: 1 },
      { role: 'QA', amount: 1 }
    ],
    possibleStacks: ['PHP + JavaScript', 'Node.js + React', 'Java + Spring + Vue', '.NET + Angular'],
    outcomes: ['Cadastro de produtos', 'Registro de vendas', 'Controle de clientes', 'Resumo diário'],
    createdBy: 'Focus Tecnologia',
    members: []
  }
];

export const initialState: HubState = {
  profile: initialProfile,
  projects: initialProjects
};
