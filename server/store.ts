import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  Article,
  Category,
  Comment,
  MediaItem,
  NewsletterSubscriber,
} from '../src/types.ts';

interface AdminAccount {
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface DatabaseSchema {
  categories: Category[];
  articles: Article[];
  comments: Comment[];
  newsletterSubscribers?: NewsletterSubscriber[];
  admin?: AdminAccount;
  sessionSecret?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'complice-db.json');

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function createInitialData(): DatabaseSchema {
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const categories: Category[] = [
    {
      id: 'cat-politica',
      name: 'Política & Diplomacia',
      slug: 'politica-diplomacia',
      description: 'Cimeiras, acordos multilaterais e geopolítica no espaço da CPLP.',
      createdAt: hoursAgo(240),
    },
    {
      id: 'cat-economia',
      name: 'Economia & Energia',
      slug: 'economia-energia',
      description: 'Transição energética, mercados atlânticos e infraestruturas sustentáveis.',
      createdAt: hoursAgo(230),
    },
    {
      id: 'cat-cultura',
      name: 'Cultura & Cinema',
      slug: 'cultura-cinema',
      description: 'Literatura, cinema contemporâneo, artes visuais e património lusófono.',
      createdAt: hoursAgo(220),
    },
    {
      id: 'cat-tecnologia',
      name: 'Tecnologia & Inovação',
      slug: 'tecnologia-inovacao',
      description: 'Ecossistemas digitais, engenharia de software e investigação aplicada.',
      createdAt: hoursAgo(210),
    },
    {
      id: 'cat-ciencia',
      name: 'Ciência & Ambiente',
      slug: 'ciencia-ambiente',
      description: 'Investigação oceânica, clima e preservação da biodiversidade.',
      createdAt: hoursAgo(200),
    },
    {
      id: 'cat-compliance-officer',
      name: 'Compliance Officer',
      slug: 'compliance-officer',
      description: 'Governação corporativa, gestão de risco, ética institucional e inteligência artificial.',
      createdAt: hoursAgo(195),
    },
    {
      id: 'cat-angola',
      name: 'Angola',
      slug: 'angola',
      description: 'Atualidade económica, regulação, inovação e sociedade em Angola.',
      createdAt: hoursAgo(190),
    },
  ];

  const articles: Article[] = [
    {
      id: 'art-cimeira-lisboa',
      title: 'Cimeira Atlântica em Lisboa sela novo corredor científico e comercial entre oito capitais lusófonas',
      subtitle: 'Chefes de delegação aprovaram um fundo conjunto de mobilidade académica, cabos submarinos de investigação e facilitação alfandegária para indústrias criativas.',
      slug: 'cimeira-atlantica-lisboa-corredor-cientifico',
      categoryId: 'cat-politica',
      author: 'Mariana Alencar',
      location: 'Lisboa',
      coverImage: '/src/assets/images/hero_lusophone_summit_1794841997008.jpg',
      videoUrl: '',
      mediaGallery: [
        {
          id: 'med-1',
          type: 'image',
          url: '/src/assets/images/article_caboverde_ocean_1794841998571.jpg',
          caption: 'Fig. 1 — Estação atlântica de Mindelo integrará a nova rede de monitorização oceânica.',
        },
      ],
      content: `Durante três dias de negociações à beira do Tejo, ministros e representantes de Portugal, Brasil, Angola, Moçambique, Cabo Verde, Guiné-Bissau, São Tomé e Príncipe e Timor-Leste consolidaram um roteiro pragmático para a próxima década de cooperação multilateral.

O texto final, assinado ao final da tarde de sexta-feira, estabelece um mecanismo de reconhecimento célere de diplomas universitários nas áreas de engenharia, ciências do mar e saúde pública, acompanhado de uma linha de financiamento anual dedicada a laboratórios partilhados entre universidades dos dois lados do Atlântico e do Índico.

Para além da agenda diplomática tradicional, o encontro ficou marcado pelo peso crescente das empresas tecnológicas de média dimensão e dos consórcios energéticos. Delegações de Luanda e Maputo apresentaram metas concretas para interligar centros de dados alimentados por energia solar a programas de formação técnica em língua portuguesa.

"A língua comum deixou há muito de ser apenas um património afetivo; tornou-se uma infraestrutura económica de redução de custos de transação", sublinhou o relator da comissão de infraestruturas digitais durante a sessão plenária de encerramento.

Nos próximos noventa dias, um grupo técnico permanente sediado entre Lisboa, Brasília e Mindelo deverá publicar o calendário de candidaturas para os primeiros vinte projetos-piloto, com prioridade para investigação climática e arquivos audiovisuais digitais.`,
      featured: false,
      status: 'published',
      publishedAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
      readTimeMinutes: 4,
      likes: 18,
    },
    {
      id: 'art-energia-angola',
      title: 'Corredor solar no sul de Angola ultrapassa metas iniciais e acelera eletrificação rural',
      subtitle: 'Novos parques fotovoltaicos híbridos já abastecem redes municipais e unidades agroindustriais com armazenamento em baterias de longa duração.',
      slug: 'corredor-solar-angola-eletrificacao-rural',
      categoryId: 'cat-economia',
      author: 'Mateus Kiala',
      location: 'Luanda / Huíla',
      coverImage: '/src/assets/images/article_luanda_energy_1794841997378.jpg',
      videoUrl: '',
      mediaGallery: [],
      content: `A paisagem de terra vermelha no planalto sul de Angola acolhe hoje uma das maiores expansões de energia fotovoltaica descentralizada da África Austral. Com a entrada em operação da segunda fase de painéis bifaciais na província da Huíla, mais de cento e oitenta mil agregados familiares passaram a contar com fornecimento contínuo mesmo após o pôr do sol.

O projeto combina geração solar em larga escala com sistemas modulares de armazenamento que substituem geradores a gasóleo em cooperativas agrícolas, hospitais distritais e pequenas unidades de transformação alimentar. Segundo os engenheiros responsáveis pela operação, a redução nos custos operacionais das explorações locais atingiu 42% nos primeiros seis meses.

Equipas técnicas formadas em institutos politécnicos de Luanda e Benguela lideram agora a manutenção preditiva das centrais através de sensores remotos que monitorizam poeira atmosférica e rendimento térmico em tempo real.

O modelo despertou o interesse de investidores institucionais de Cabo Verde e São Tomé e Príncipe, que avaliam adaptar o mesmo desenho híbrido para redes insulares isoladas.`,
      featured: false,
      status: 'published',
      publishedAt: hoursAgo(11),
      updatedAt: hoursAgo(11),
      readTimeMinutes: 3,
      likes: 12,
    },
    {
      id: 'art-cinema-saopaulo',
      title: 'Mostra de Cinema Lusófono em São Paulo reúne 38 longas restauradas e novos realizadores',
      subtitle: 'Ciclo dedicado ao diálogo entre cineastas do Brasil, Cabo Verde, Moçambique e Portugal esgota sessões históricas no centro paulistano.',
      slug: 'mostra-cinema-lusofono-sao-paulo',
      categoryId: 'cat-cultura',
      author: 'Beatriz Vasconcelos',
      location: 'São Paulo',
      coverImage: '/src/assets/images/article_brasil_cinema_1794841998199.jpg',
      videoUrl: '',
      mediaGallery: [],
      content: `Com salas cheias desde a sessão de abertura, a sexta edição da Mostra de Cinema Lusófono transformou o centro histórico de São Paulo num ponto de encontro raro entre cinematecas, distribuidoras independentes e jovens realizadores estreantes.

O programa deste ano destacou o restauro em 4K de obras fundamentais dos anos 1970 e 1980 filmadas entre Maputo, Praia e Recife, colocando-as em diálogo direto com documentários contemporâneos sobre urbanismo, memória oral e música eletrónica periférica.

Um dos momentos mais debatidos da semana foi a mesa-redonda sobre circulação internacional de filmes falados em português. Produtores de três continentes anunciaram um catálogo conjunto de distribuição em salas independentes e plataformas educativas universitárias, reduzindo a dependência de intermediários externos.

Até domingo, o público poderá assistir ainda a dez estreias mundiais seguidas de debates com equipas técnicas e compositores de bandas sonoras.`,
      featured: false,
      status: 'published',
      publishedAt: hoursAgo(19),
      updatedAt: hoursAgo(19),
      readTimeMinutes: 3,
      likes: 9,
    },
    {
      id: 'art-maputo-tecnologia',
      title: 'Estúdios de engenharia em Maputo exportam plataformas financeiras e ferramentas de saúde digital',
      subtitle: 'Nova geração de programadores moçambicanos constrói soluções de baixa conectividade adotadas por clínicas e municípios em quatro países.',
      slug: 'estudios-engenharia-maputo-saude-digital',
      categoryId: 'cat-tecnologia',
      author: 'Helder Mondlane',
      location: 'Maputo',
      coverImage: '/src/assets/images/article_maputo_tech_1794841999071.jpg',
      videoUrl: '',
      mediaGallery: [],
      content: `Num edifício envidraçado da baixa de Maputo, equipas multidisciplinares de engenheiros de software e designers de produto trabalham em sistemas desenhados especificamente para funcionar com fiabilidade em redes móveis intermitentes.

O que começou há quatro anos como um pequeno coletivo de desenvolvimento para cooperativas agrícolas locais evoluiu para um polo exportador de tecnologia cívica. Atualmente, três plataformas nascidas na capital moçambicana gerem registos clínicos offline-first e pagamentos instantâneos para mais de quatrocentas unidades de saúde comunitárias.

"Projetar para constrangimentos reais de largura de banda e autonomia energética obrigou-nos a escrever código mais limpo e resiliente", explica a diretora de arquitetura de sistemas de um dos estúdios visitados pela Complice Week Lusophone.

Universidades locais e empresas de Lisboa e Porto já firmaram protocolos de estágio remoto para absorver parte dos novos licenciados em ciência da computação sem exigir emigração permanente.`,
      featured: false,
      status: 'published',
      publishedAt: hoursAgo(28),
      updatedAt: hoursAgo(28),
      readTimeMinutes: 4,
      likes: 15,
    },
    {
      id: 'art-caboverde-oceano',
      title: 'Observatório oceânico no Mindelo mapeia correntes profundas e biodiversidade do Atlântico Central',
      subtitle: 'Campanha científica conjunta recolhe dados inéditos sobre temperatura abissal e rotas migratórias pelágicas ao largo de São Vicente.',
      slug: 'observatorio-oceanico-mindelo-atlantico-central',
      categoryId: 'cat-ciencia',
      author: 'Inês Tavares',
      location: 'Mindelo, Cabo Verde',
      coverImage: '/src/assets/images/article_caboverde_ocean_1794841998571.jpg',
      videoUrl: '',
      mediaGallery: [],
      content: `Ancorado na baía do Porto Grande antes de zarpar para mais uma campanha de catorze dias em mar aberto, o navio de investigação oceanográfica transporta sensores autónomos capazes de descer até quatro mil metros de profundidade.

A expedição reúne investigadores cabo-verdianos, portugueses e brasileiros num esforço coordenado para preencher uma das maiores lacunas de dados climáticos do Atlântico Tropical. As medições realizadas nas últimas semanas revelaram variações subtis na salinidade das massas de água intermédias que influenciam diretamente o regime de chuvas na África Ocidental e no Nordeste brasileiro.

Além da componente atmosférica e climática, as câmaras de baixa luminosidade instaladas nos veículos submersíveis documentaram novos habitats de corais de águas frias ao longo das encostas vulcânicas submersas do arquipélago.

Todos os conjuntos de dados serão publicados em acesso aberto no portal científico lusófono no próximo trimestre, permitindo que estudantes e centros meteorológicos utilizem as séries históricas em modelos preditivos.`,
      featured: false,
      status: 'published',
      publishedAt: hoursAgo(36),
      updatedAt: hoursAgo(36),
      readTimeMinutes: 4,
      likes: 11,
    },
  ];

  const comments: Comment[] = [
    {
      id: 'com-1',
      articleId: 'art-cimeira-lisboa',
      authorName: 'Joana Monteiro',
      content: 'Excelente cobertura. A equivalência célere de diplomas científicos entre universidades lusófonas era uma reivindicação antiga dos investigadores.',
      likes: 4,
      createdAt: hoursAgo(2),
    },
    {
      id: 'com-2',
      articleId: 'art-cimeira-lisboa',
      parentId: 'com-1',
      authorName: 'Carlos Eduardo Silva',
      content: 'Concordo plenamente. Será importante acompanhar os prazos de implementação nos próximos 90 dias para garantir que os projetos-piloto cheguem fora das capitais.',
      likes: 2,
      createdAt: hoursAgo(1),
    },
    {
      id: 'com-3',
      articleId: 'art-maputo-tecnologia',
      authorName: 'Sofia Nogueira',
      content: 'A engenharia pensada para baixa conectividade é uma lição de eficiência para toda a indústria de software.',
      likes: 3,
      createdAt: hoursAgo(5),
    },
  ];

  return { categories, articles, comments };
}

class EditorialStore {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        this.data = {
          categories: parsed.categories ?? [],
          articles: (parsed.articles ?? []).map((a) => ({
            ...a,
            likes: typeof a.likes === 'number' ? a.likes : 0,
            mediaGallery: Array.isArray(a.mediaGallery) ? a.mediaGallery : [],
          })),
          comments: (parsed.comments ?? []).map((c) => ({
            ...c,
            likes: typeof c.likes === 'number' ? c.likes : 0,
          })),
          newsletterSubscribers: Array.isArray(parsed.newsletterSubscribers)
            ? parsed.newsletterSubscribers
            : [],
          admin: parsed.admin,
          sessionSecret: parsed.sessionSecret,
        };
      } catch {
        this.data = { ...createInitialData(), newsletterSubscribers: [] };
        this.save();
      }
    } else {
      this.data = { ...createInitialData(), newsletterSubscribers: [] };
      this.save();
    }
    this.ensureRequiredSeedAdditions();
  }

  private ensureRequiredSeedAdditions(): void {
    let changed = false;
    const now = new Date().toISOString();

    if (!this.data.categories.some((c) => c.slug === 'compliance-officer')) {
      this.data.categories.push({
        id: 'cat-compliance-officer',
        name: 'Compliance Officer',
        slug: 'compliance-officer',
        description: 'Governação corporativa, gestão de risco, ética institucional e inteligência artificial.',
        createdAt: now,
      });
      changed = true;
    }

    if (!this.data.categories.some((c) => c.slug === 'angola')) {
      this.data.categories.push({
        id: 'cat-angola',
        name: 'Angola',
        slug: 'angola',
        description: 'Atualidade económica, regulação, inovação e sociedade em Angola.',
        createdAt: now,
      });
      changed = true;
    }

    if (!this.data.articles.some((a) => a.id === 'art-compliance-ai-angola')) {
      this.data.articles.unshift({
        id: 'art-compliance-ai-angola',
        title: 'Inteligência Artificial está a mudar o Compliance e a criar novos riscos para as organizações',
        subtitle: 'Edição Nº 05 — Especial Angola analisa como os conselhos de administração e Compliance Officers enfrentam a governação algorítmica, integridade e sustentabilidade.',
        slug: 'inteligencia-artificial-compliance-novos-riscos-angola',
        categoryId: 'cat-compliance-officer',
        author: 'Redação Compliance Week Angola',
        location: 'Luanda, Angola',
        coverImage: '/assets/aistudio/WhatsApp_Image_2026-11-15_at_8.31.50_AM_a3db616e.jpeg',
        videoUrl: '',
        mediaGallery: [],
        content: `A adoção acelerada de sistemas de inteligência artificial no setor financeiro, energético e de telecomunicações em Angola está a redefinir as responsabilidades do Compliance Officer contemporâneo.

Nesta Edição Nº 05 da Compliance Week, especialistas em risco, integridade e decisão corporativa examinam o impacto direto da automação na prevenção de branqueamento de capitais, proteção de dados e auditoria contínua.

Para além do ganho operacional na deteção precoce de anomalias, os novos modelos trazem riscos inéditos de opacidade algorítmica e responsabilidade regulatória, exigindo programas de governação claros e supervisão humana permanente.

As organizações que integram critérios de ética digital, sustentabilidade e controlo interno desde a conceção dos seus fluxos tecnológicos garantem maior confiança junto de reguladores e parceiros internacionais.`,
        featured: true,
        status: 'published',
        publishedAt: now,
        updatedAt: now,
        readTimeMinutes: 3,
        likes: 0,
      });
      this.data.articles = this.data.articles.map((a) =>
        a.id === 'art-compliance-ai-angola' ? a : { ...a, featured: false }
      );
      changed = true;
    } else {
      const complianceArt = this.data.articles.find((a) => a.id === 'art-compliance-ai-angola');
      const lisboaArt = this.data.articles.find((a) => a.id === 'art-cimeira-lisboa');
      if (complianceArt && !complianceArt.featured && lisboaArt?.featured) {
        this.data.articles = this.data.articles.map((a) => ({
          ...a,
          featured: a.id === 'art-compliance-ai-angola',
        }));
        changed = true;
      }
    }

    if (changed) {
      this.save();
    }
  }

  private save(): void {
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH);
  }

  exportSnapshot(): Pick<
    DatabaseSchema,
    'categories' | 'articles' | 'comments' | 'newsletterSubscribers'
  > {
    return {
      categories: this.data.categories,
      articles: this.data.articles,
      comments: this.data.comments,
      newsletterSubscribers: this.data.newsletterSubscribers ?? [],
    };
  }

  getOrCreateSessionSecret(): string {
    if (!this.data.sessionSecret) {
      this.data.sessionSecret = crypto.randomBytes(32).toString('hex');
      this.save();
    }
    return this.data.sessionSecret;
  }

  hasAdminAccount(): boolean {
    return Boolean(this.data.admin && this.data.admin.email && this.data.admin.passwordHash);
  }

  getAdminAccount(): AdminAccount | undefined {
    return this.data.admin;
  }

  setAdminAccount(email: string, passwordHash: string, salt: string): AdminAccount {
    const account: AdminAccount = {
      email: email.trim().toLowerCase(),
      passwordHash,
      salt,
      createdAt: this.data.admin?.createdAt || new Date().toISOString(),
    };
    this.data.admin = account;
    this.save();
    return account;
  }

  getCategories(): Category[] {
    return this.data.categories.map((cat) => ({
      ...cat,
      articleCount: this.data.articles.filter((a) => a.categoryId === cat.id).length,
    }));
  }

  createCategory(input: { name: string; description?: string }): Category {
    const name = input.name.trim();
    if (!name) {
      throw new Error('O nome da categoria é obrigatório.');
    }
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 2;
    while (this.data.categories.some((c) => c.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    const category: Category = {
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      name,
      slug,
      description: (input.description ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    this.data.categories.push(category);
    this.save();
    return { ...category, articleCount: 0 };
  }

  updateCategory(id: string, input: { name?: string; description?: string }): Category {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error('Categoria não encontrada.');
    }
    const current = this.data.categories[idx];
    const nextName = input.name !== undefined ? input.name.trim() : current.name;
    if (!nextName) {
      throw new Error('O nome da categoria não pode ficar vazio.');
    }
    let nextSlug = current.slug;
    if (nextName !== current.name) {
      const baseSlug = slugify(nextName);
      nextSlug = baseSlug;
      let counter = 2;
      while (this.data.categories.some((c) => c.slug === nextSlug && c.id !== id)) {
        nextSlug = `${baseSlug}-${counter++}`;
      }
    }
    this.data.categories[idx] = {
      ...current,
      name: nextName,
      slug: nextSlug,
      description: input.description !== undefined ? input.description.trim() : current.description,
    };
    this.save();
    return {
      ...this.data.categories[idx],
      articleCount: this.data.articles.filter((a) => a.categoryId === id).length,
    };
  }

  deleteCategory(id: string, reassignToId?: string): void {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error('Categoria não encontrada.');
    }
    const linkedArticles = this.data.articles.filter((a) => a.categoryId === id);
    if (linkedArticles.length > 0) {
      if (reassignToId && reassignToId !== id && this.data.categories.some((c) => c.id === reassignToId)) {
        this.data.articles = this.data.articles.map((a) =>
          a.categoryId === id ? { ...a, categoryId: reassignToId } : a
        );
      } else {
        throw new Error(
          `Esta categoria possui ${linkedArticles.length} artigo(s) associado(s). Reatribua os artigos ou escolha outra categoria antes de excluir.`
        );
      }
    }
    this.data.categories.splice(idx, 1);
    this.save();
  }

  getArticles(filters?: { categorySlug?: string; status?: string; q?: string }): Article[] {
    let list = [...this.data.articles];

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((a) => a.status === filters.status);
    }

    if (filters?.categorySlug && filters.categorySlug !== 'all') {
      const cat = this.data.categories.find(
        (c) => c.slug === filters.categorySlug || c.id === filters.categorySlug
      );
      if (cat) {
        list = list.filter((a) => a.categoryId === cat.id);
      } else {
        list = [];
      }
    }

    if (filters?.q && filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.subtitle.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return list.map((article) => ({
      ...article,
      likes: article.likes ?? 0,
      commentCount: this.data.comments.filter((c) => c.articleId === article.id).length,
    }));
  }

  getArticleById(id: string): Article | undefined {
    const article = this.data.articles.find((a) => a.id === id || a.slug === id);
    if (!article) return undefined;
    return {
      ...article,
      likes: article.likes ?? 0,
      commentCount: this.data.comments.filter((c) => c.articleId === article.id).length,
    };
  }

  createArticle(input: {
    title: string;
    subtitle: string;
    categoryId: string;
    author: string;
    location: string;
    coverImage: string;
    videoUrl?: string;
    mediaGallery?: MediaItem[];
    content: string;
    featured?: boolean;
    status?: 'published' | 'draft';
  }): Article {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) throw new Error('O título do artigo é obrigatório.');
    if (!content) throw new Error('O conteúdo do artigo é obrigatório.');
    if (!this.data.categories.some((c) => c.id === input.categoryId)) {
      throw new Error('Categoria selecionada inválida.');
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 2;
    while (this.data.articles.some((a) => a.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const now = new Date().toISOString();
    const isFeatured = Boolean(input.featured);
    if (isFeatured) {
      this.data.articles = this.data.articles.map((a) => ({ ...a, featured: false }));
    }

    const article: Article = {
      id: `art-${crypto.randomUUID().slice(0, 8)}`,
      title,
      subtitle: (input.subtitle ?? '').trim(),
      slug,
      categoryId: input.categoryId,
      author: (input.author || 'Redação Lusophone').trim(),
      location: (input.location || 'Lisboa').trim(),
      coverImage: (input.coverImage ?? '').trim(),
      videoUrl: (input.videoUrl ?? '').trim(),
      mediaGallery: Array.isArray(input.mediaGallery) ? input.mediaGallery : [],
      content,
      featured: isFeatured,
      status: input.status === 'draft' ? 'draft' : 'published',
      publishedAt: now,
      updatedAt: now,
      readTimeMinutes: estimateReadTime(content),
      likes: 0,
    };

    this.data.articles.unshift(article);
    this.save();
    return { ...article, commentCount: 0 };
  }

  updateArticle(
    id: string,
    input: Partial<{
      title: string;
      subtitle: string;
      categoryId: string;
      author: string;
      location: string;
      coverImage: string;
      videoUrl: string;
      mediaGallery: MediaItem[];
      content: string;
      featured: boolean;
      status: 'published' | 'draft';
    }>
  ): Article {
    const idx = this.data.articles.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error('Artigo não encontrado.');
    }
    const current = this.data.articles[idx];
    if (input.categoryId && !this.data.categories.some((c) => c.id === input.categoryId)) {
      throw new Error('Categoria selecionada inválida.');
    }
    if (input.featured === true) {
      this.data.articles = this.data.articles.map((a) =>
        a.id === id ? a : { ...a, featured: false }
      );
    }

    const nextTitle = input.title !== undefined ? input.title.trim() : current.title;
    const nextContent = input.content !== undefined ? input.content.trim() : current.content;
    if (!nextTitle) throw new Error('O título do artigo é obrigatório.');
    if (!nextContent) throw new Error('O conteúdo do artigo é obrigatório.');

    const updated: Article = {
      ...current,
      title: nextTitle,
      subtitle: input.subtitle !== undefined ? input.subtitle.trim() : current.subtitle,
      categoryId: input.categoryId ?? current.categoryId,
      author: input.author !== undefined ? input.author.trim() : current.author,
      location: input.location !== undefined ? input.location.trim() : current.location,
      coverImage: input.coverImage !== undefined ? input.coverImage.trim() : current.coverImage,
      videoUrl: input.videoUrl !== undefined ? input.videoUrl.trim() : current.videoUrl,
      mediaGallery: input.mediaGallery !== undefined ? input.mediaGallery : current.mediaGallery,
      content: nextContent,
      featured: input.featured !== undefined ? input.featured : current.featured,
      status: input.status ?? current.status,
      updatedAt: new Date().toISOString(),
      readTimeMinutes: estimateReadTime(nextContent),
      likes: current.likes ?? 0,
    };

    this.data.articles[idx] = updated;
    this.save();
    return {
      ...updated,
      commentCount: this.data.comments.filter((c) => c.articleId === id).length,
    };
  }

  likeArticle(id: string): Article {
    const idx = this.data.articles.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error('Artigo não encontrado.');
    }
    const nextLikes = (this.data.articles[idx].likes ?? 0) + 1;
    this.data.articles[idx] = { ...this.data.articles[idx], likes: nextLikes };
    this.save();
    return {
      ...this.data.articles[idx],
      commentCount: this.data.comments.filter((c) => c.articleId === id).length,
    };
  }

  deleteArticle(id: string): void {
    const idx = this.data.articles.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error('Artigo não encontrado.');
    }
    this.data.articles.splice(idx, 1);
    this.data.comments = this.data.comments.filter((c) => c.articleId !== id);
    this.save();
  }

  getCommentsForArticle(articleId: string): Comment[] {
    return this.data.comments
      .filter((c) => c.articleId === articleId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllComments(): Comment[] {
    return [...this.data.comments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  createComment(input: {
    articleId: string;
    authorName: string;
    content: string;
    parentId?: string;
  }): Comment {
    const article = this.data.articles.find((a) => a.id === input.articleId);
    if (!article) {
      throw new Error('Artigo não encontrado para comentar.');
    }
    const authorName = input.authorName.trim();
    const content = input.content.trim();
    if (!authorName || authorName.length < 2) {
      throw new Error('Indique o seu nome (mínimo 2 caracteres).');
    }
    if (!content || content.length < 2) {
      throw new Error('Escreva um comentário antes de enviar.');
    }
    if (input.parentId && !this.data.comments.some((c) => c.id === input.parentId && c.articleId === article.id)) {
      throw new Error('Comentário de origem não encontrado.');
    }
    const comment: Comment = {
      id: `com-${crypto.randomUUID().slice(0, 10)}`,
      articleId: article.id,
      parentId: input.parentId || undefined,
      authorName: authorName.slice(0, 80),
      content: content.slice(0, 2000),
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.comments.unshift(comment);
    this.save();
    return comment;
  }

  likeComment(commentId: string): Comment {
    const idx = this.data.comments.findIndex((c) => c.id === commentId);
    if (idx === -1) {
      throw new Error('Comentário não encontrado.');
    }
    const nextLikes = (this.data.comments[idx].likes ?? 0) + 1;
    this.data.comments[idx] = { ...this.data.comments[idx], likes: nextLikes };
    this.save();
    return this.data.comments[idx];
  }

  deleteComment(commentId: string): Comment | null {
    const idx = this.data.comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return null;
    const [removed] = this.data.comments.splice(idx, 1);
    // Also remove replies linked to removed comment
    this.data.comments = this.data.comments.filter((c) => c.parentId !== commentId);
    this.save();
    return removed;
  }

  getNewsletterSubscribers(): NewsletterSubscriber[] {
    return [...(this.data.newsletterSubscribers ?? [])].sort(
      (a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime()
    );
  }

  subscribeNewsletter(input: {
    email: string;
    name?: string;
  }): { subscriber: NewsletterSubscriber; alreadySubscribed: boolean } {
    const email = (input.email ?? '').trim().toLowerCase();
    const name = (input.name ?? '').trim().slice(0, 80);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error('Por favor, indique um endereço de e-mail válido.');
    }

    const list = this.data.newsletterSubscribers ?? [];
    const existing = list.find((s) => s.email === email);
    if (existing) {
      if (name && !existing.name) {
        existing.name = name;
        this.save();
      }
      return { subscriber: existing, alreadySubscribed: true };
    }

    const subscriber: NewsletterSubscriber = {
      id: `sub-${crypto.randomUUID().slice(0, 10)}`,
      email,
      name: name || undefined,
      subscribedAt: new Date().toISOString(),
    };
    this.data.newsletterSubscribers = [subscriber, ...list];
    this.save();
    return { subscriber, alreadySubscribed: false };
  }

  deleteNewsletterSubscriber(id: string): boolean {
    const list = this.data.newsletterSubscribers ?? [];
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.data.newsletterSubscribers = list;
    this.save();
    return true;
  }
}

export const store = new EditorialStore();
