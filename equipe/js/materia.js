/* Matérias do escritório — "escritório virtual por matéria" (v1.0, 30/10/2026).
 * Catálogo das áreas (RD Trib, RD EF, RD Prev, RD Consul, RD Trab, RD Cível, RD Adm, RD Emp, RD Imob): sigla, justiça habitual,
 * perguntas de triagem, documentos a pedir ao cliente, prazos típicos (materiais e processuais) e teses iniciais.
 * As teses e os prazos são apoio interno: tudo passa pela revisão do advogado antes de chegar ao cliente ("a validar" = ainda não aprovada pela Direção).
 * Usado pelo Atendimento RD, pelo CRM e pelas rotinas. Navegador (window.Materia) e node. */
(function (root) {
  'use strict';
  // contagem: 'uteis' (dias úteis, CPC art. 219 / CLT art. 775 / Lei 9.099 art. 12-A), 'corridos' (dias corridos; prorroga para o dia útil seguinte, CC art. 132, § 1º),
  // 'conferir' (há divergência sobre a contagem), ou unidade 'anos'/'meses' (prazos materiais: prescrição e decadência). n = null: sem contagem (só referência).
  const P = (nome, base, n, contagem, nota) => Object.assign({ nome, base, n, contagem: contagem || (n == null ? '' : 'uteis') }, nota ? { nota } : {});
  const MATERIAS = {
    'Tributário': { sigla: 'RD Trib', justica: ['jf', 'tjce'], resp: 'Rafael', checklist: 'recuperacao',
      descricao: 'Planejamento, recuperação de créditos e defesa em autuações (federal, estadual e municipal).',
      perguntas: ['Qual o regime tributário da empresa (Simples, Lucro Presumido ou Lucro Real)?', 'Qual o faturamento médio mensal e a atividade principal (CNAE)?',
        'Há autuação, notificação ou cobrança em curso? Recebida em que data?', 'Quem faz a contabilidade (nome do contador)?',
        'O objetivo é reduzir a carga daqui para a frente, recuperar o que foi pago a mais nos últimos 5 anos, ou os dois?'],
      documentos: ['Cartão CNPJ e contrato social', 'SPED Fiscal (EFD ICMS/IPI) e EFD-Contribuições dos últimos 60 meses', 'XML das notas fiscais de entrada e saída',
        'PGDAS/DCTF e guias pagas', 'Balancetes e DRE', 'Autos de infração, notificações ou CDAs recebidas'],
      prazos: [P('Repetição de indébito / compensação', 'CTN, art. 168, I (5 anos do pagamento indevido)', 5, 'anos'),
        P('Decadência do lançamento', 'CTN, art. 150, § 4º, e art. 173 (5 anos)', 5, 'anos'), P('Prescrição da cobrança', 'CTN, art. 174 (5 anos da constituição definitiva)', 5, 'anos'),
        P('Impugnação administrativa federal', 'Decreto 70.235/1972, arts. 5º e 15 (30 dias corridos da intimação)', 30, 'corridos'),
        P('Recurso voluntário ao CARF', 'Decreto 70.235/1972, art. 33 (30 dias corridos)', 30, 'corridos'),
        P('Manifestação de inconformidade (PER/DCOMP não homologado)', 'Lei 9.430/1996, art. 74, §§ 7º e 9º (30 dias)', 30, 'corridos'),
        P('Mandado de segurança', 'Lei 12.016/2009, art. 23 (120 dias da ciência do ato)', 120, 'corridos')],
      teses: ['Biblioteca de teses tributárias (55 teses, com situação e grau) — ver o PlanejaTrib e a Biblioteca'] },
    'Execução fiscal': { sigla: 'RD EF', justica: ['tjce', 'jf'], resp: 'Rafael', checklist: 'execucao',
      descricao: 'Defesa do contribuinte em execuções fiscais municipais, estaduais e federais.',
      perguntas: ['Foi citado ou recebeu mandado do oficial de justiça? Em que data?', 'Houve bloqueio de conta (Sisbajud) ou penhora de bens?',
        'Qual o valor cobrado, de que tributo e de que período?', 'Já parcelou ou pagou parte da dívida?', 'Tem bens para garantir a execução (imóvel, veículo, seguro-garantia)?'],
      documentos: ['Mandado de citação ou intimação, com a data do recebimento', 'CDA (certidão de dívida ativa) e petição inicial', 'Comprovantes de pagamento ou de parcelamento',
        'Extratos do bloqueio (Sisbajud), se houver', 'Contrato social e cartão CNPJ (ou documentos pessoais)'],
      prazos: [P('Pagar ou garantir a execução', 'LEF (Lei 6.830/1980), art. 8º (5 dias da citação)', 5, 'conferir', 'há divergência sobre contagem em dias úteis ou corridos; adotar a leitura mais curta'),
        P('Embargos à execução fiscal', 'LEF, art. 16 (30 dias do depósito, da fiança/seguro ou da intimação da penhora)', 30, 'conferir', 'contagem a conferir; sem garantia os embargos não são admitidos (art. 16, § 1º)'),
        P('Exceção de pré-executividade', 'Sem prazo: matéria de ordem pública conhecível de ofício, sem dilação probatória (Súmula 393 do STJ)', null),
        P('Impugnação à penhora ou ao bloqueio', 'CPC, art. 525, § 11, ou art. 917, § 1º (15 dias úteis)', 15, 'uteis'),
        P('Apelação', 'CPC, art. 1.003, § 5º (15 dias úteis); até 50 ORTN só embargos infringentes em 10 dias (LEF, art. 34)', 15, 'uteis'),
        P('Prescrição da cobrança', 'CTN, art. 174 (5 anos)', 5, 'anos'),
        P('Prescrição intercorrente', 'LEF, art. 40, § 4º; Temas 566 a 571 do STJ (1 ano de suspensão + 5 anos, automáticos)', 6, 'anos')],
      teses: ['Nulidade da CDA (requisitos do art. 2º, §§ 5º e 6º, da LEF)', 'Prescrição e prescrição intercorrente (Temas 566 a 571 do STJ)', 'Decadência do lançamento',
        'Ilegitimidade do sócio redirecionado (Súmula 430 do STJ; Temas 962 e 981 do STJ)', 'Excesso de execução e erro de cálculo (multa, juros, encargo)',
        'Substituição da garantia por seguro-garantia ou fiança (LEF, arts. 9º e 15)', 'Impenhorabilidade (CPC, art. 833; bem de família, Lei 8.009/1990)'] },
    'Previdenciário': { sigla: 'RD Prev', justica: ['jf'], resp: 'Rafael', checklist: 'previdenciario',
      descricao: 'Benefícios do INSS: concessão, revisão e restabelecimento, na via administrativa e no Juizado Especial Federal.',
      perguntas: ['O pedido ao INSS já foi feito? Em que data (DER) e com que resultado (concessão, indeferimento, cessação)?',
        'Qual o benefício pretendido ou em discussão (aposentadoria, auxílio, pensão, BPC, salário-maternidade)?',
        'Há vínculos ou períodos que não aparecem no CNIS (rural, informal, atividade especial)?', 'Recebeu carta ou comunicado do INSS? Em que data?',
        'Já houve processo anterior sobre o mesmo pedido?'],
      documentos: ['CNIS completo e extrato de contribuições (Meu INSS)', 'Carta de concessão ou comunicado de decisão do INSS, com a data', 'CTPS, carnês (GPS) e PPP/LTCAT (atividade especial)',
        'Provas do período rural, quando houver', 'Laudos e documentos médicos (benefício por incapacidade)', 'RG, CPF, comprovante de residência e certidões (casamento/óbito, para pensão)'],
      prazos: [P('Revisão do ato de concessão (decadência)', 'Lei 8.213/1991, art. 103 (10 anos, do 1º dia do mês seguinte ao do 1º pagamento)', 10, 'anos'),
        P('Parcelas vencidas (prescrição)', 'Lei 8.213/1991, art. 103, parágrafo único (5 anos)', 5, 'anos'),
        P('Recurso administrativo ao CRPS', 'Decreto 3.048/1999, art. 305 (30 dias da ciência da decisão)', 30, 'corridos'),
        P('Pensão por morte com efeitos desde o óbito', 'Lei 8.213/1991, art. 74, I e II (requerimento em até 180 dias — menores de 16 — ou 90 dias)', 90, 'corridos'),
        P('Recurso inominado (JEF)', 'Lei 9.099/1995, art. 42, c/c Lei 10.259/2001, art. 1º (10 dias úteis, art. 12-A)', 10, 'uteis'),
        P('Embargos de declaração (JEF)', 'Lei 9.099/1995, art. 49 (5 dias úteis)', 5, 'uteis'),
        P('Apelação (vara federal comum)', 'CPC, art. 1.003, § 5º (15 dias úteis)', 15, 'uteis')],
      teses: ['Tempo especial (PPP/LTCAT) e conversão em comum até 13/11/2019 (EC 103/2019, art. 25, § 2º)', 'Tempo rural e segurado especial: início de prova material + testemunhas (Súmula 149 do STJ)',
        'Revisão por salários não computados ou CNIS incompleto', 'Restabelecimento de benefício por incapacidade cessado indevidamente (DIB desde a cessação)',
        'BPC/LOAS: critério de 1/4 do salário mínimo não é absoluto (RE 567.985, Tema 27 do STF)', 'Auxílio-acidente: concessão e cálculo',
        'Não oferecer — desaposentação/reaposentação vedada (Tema 503 do STF)', 'Não oferecer — revisão da vida toda afastada pelo STF nas ADIs 2.110 e 2.111 (março/2024)',
        'Contribuição patronal sobre salário-maternidade inconstitucional (Tema 72 do STF): recuperação é tese tributária (RD Trib)'] },
    'Consumidor': { sigla: 'RD Consul', justica: ['tjce'], resp: 'Rafael', checklist: 'consumidor',
      descricao: 'Relações de consumo: cobranças indevidas, negativação, contratos bancários, planos de saúde, produtos e serviços.',
      perguntas: ['O que aconteceu, com qual empresa e quando?', 'Há contrato, fatura, protocolo de reclamação ou conversa por escrito?',
        'Houve negativação (SPC/Serasa), cobrança indevida ou desconto em conta ou benefício?', 'Já reclamou no Procon ou no consumidor.gov.br? Qual foi a resposta?',
        'Qual o valor envolvido e o que espera (cancelar, receber de volta, indenização)?'],
      documentos: ['Contrato, proposta, fatura ou boleto', 'Comprovantes de pagamento e extratos bancários', 'Protocolos de atendimento, e-mails e conversas (prints com data)',
        'Consulta SPC/Serasa com a data da inclusão', 'Laudo ou orçamento do defeito (produto ou serviço)', 'RG, CPF e comprovante de residência'],
      prazos: [P('Reclamar vício aparente (decadência)', 'CDC, art. 26 (30 dias — não duráveis; 90 dias — duráveis); obsta-se pela reclamação ao fornecedor (§ 2º)', 90, 'corridos'),
        P('Vício oculto', 'CDC, art. 26, § 3º (conta do momento em que o defeito aparece)', 90, 'corridos'),
        P('Reparação por fato do produto ou do serviço', 'CDC, art. 27 (5 anos do conhecimento do dano e da autoria)', 5, 'anos'),
        P('Repetição de indébito (cobrança indevida)', 'CC, art. 205 (10 anos — EAREsp 738.991/RS, STJ); em dobro: CDC, art. 42, parágrafo único', 10, 'anos'),
        P('Baixa da negativação após o pagamento', 'Súmula 548 do STJ (5 dias úteis, a cargo do credor)', 5, 'uteis'),
        P('Recurso inominado (JEC)', 'Lei 9.099/1995, art. 42 (10 dias úteis, art. 12-A)', 10, 'uteis'), P('Embargos de declaração (JEC)', 'Lei 9.099/1995, art. 49 (5 dias úteis)', 5, 'uteis'),
        P('Apelação (vara cível)', 'CPC, art. 1.003, § 5º (15 dias úteis)', 15, 'uteis')],
      teses: ['Negativação indevida: dano moral presumido, salvo anotação legítima anterior (Súmula 385 do STJ)',
        'Repetição em dobro independe de má-fé para cobranças após 30/3/2021 (EAREsp 676.608/RS, STJ)', 'Empréstimo consignado ou cartão RMC não contratado: nulidade, devolução e danos',
        'Plano de saúde: negativa de cobertura e rol da ANS (Lei 14.454/2022)', 'Tarifas e encargos abusivos em financiamentos (Temas 618 e 958 do STJ)',
        'Fraude bancária: responsabilidade objetiva por fortuito interno (Súmula 479 do STJ)', 'Atraso e cancelamento de voo, extravio de bagagem (Tema 210 do STF para voos internacionais)',
        'Superendividamento: repactuação de dívidas (Lei 14.181/2021; CDC, arts. 104-A a 104-C)', 'Venda casada e cobrança de serviço não contratado (CDC, art. 39, I e III)'] },
    'Trabalhista': { sigla: 'RD Trab', justica: ['trt'], resp: 'Rafael', checklist: 'trabalhista',
      descricao: 'Defesa do empregador em reclamações trabalhistas e consultivo (rescisões, regulamentos, acordos).',
      perguntas: ['A empresa recebeu notificação de reclamação trabalhista? Qual a data da audiência?', 'O que se discute (admissão, demissão, função, salário, horas extras) e o que se pede?',
        'Há acordo, TRCT, homologação ou documentos assinados?', 'A empresa tem controle de ponto, holerites e recibos?', 'Se for consulta: qual a situação (demissão, afastamento, regulamento, acordo)?'],
      documentos: ['Notificação da Vara do Trabalho e petição inicial (PJe)', 'Contrato de trabalho, ficha de registro e CTPS', 'Controles de ponto, holerites, recibos de férias e 13º',
        'TRCT e comprovantes das verbas rescisórias', 'Atestados, advertências, comunicados e e-mails relevantes', 'Convenção coletiva aplicável'],
      prazos: [P('Prescrição para ajuizar', 'CF, art. 7º, XXIX (2 anos após o fim do contrato, limitada aos 5 anos anteriores)', 2, 'anos'),
        P('Pagamento das verbas rescisórias', 'CLT, art. 477, § 6º (10 dias do término do contrato; multa do § 8º)', 10, 'corridos'),
        P('Contestação e documentos', 'CLT, art. 847 (até a audiência; pelo PJe, antes dela)', null),
        P('Recurso ordinário', 'CLT, art. 895 (8 dias úteis, art. 775)', 8, 'uteis'), P('Embargos de declaração', 'CLT, art. 897-A (5 dias úteis)', 5, 'uteis'),
        P('Agravo de petição / recurso de revista', 'CLT, arts. 897 e 896 (8 dias úteis)', 8, 'uteis'),
        P('Suspensão dos prazos no recesso', 'CLT, art. 775-A (20/12 a 20/1)', null), P('Homologação de acordo extrajudicial', 'CLT, arts. 855-B a 855-E', null)],
      teses: ['Horas extras: validade dos controles de ponto e do banco de horas (CLT, art. 59; Súmula 338 do TST)', 'Justa causa: requisitos e prova (CLT, art. 482)',
        'Terceirização e pejotização: licitude de contratos civis (Tema 725 do STF; Tema 1.389 do STF — conferir o julgamento)',
        'Dano moral: parâmetros do art. 223-G da CLT (ADIs 6.050, 6.069 e 6.082 — valores são parâmetros, não tetos)',
        'Honorários de sucumbência do beneficiário da justiça gratuita (ADI 5.766)', 'Grupo econômico e responsabilidade solidária (CLT, art. 2º, §§ 2º e 3º)',
        'Intervalo intrajornada e adicionais de insalubridade/periculosidade (perícia)'] },
    'Cível': { sigla: 'RD Cível', justica: ['tjce'], resp: 'Rafael', checklist: 'civel',
      descricao: 'Cobranças, execuções, contratos, responsabilidade civil e defesas em geral.',
      perguntas: ['Qual a relação entre as partes (contrato, dívida, acidente, vizinhança, família)?', 'Há documento escrito (contrato, nota promissória, cheque, mensagens)?',
        'Qual o valor e desde quando existe o problema (data do fato ou do vencimento)?', 'Já houve cobrança, protesto, negociação ou processo?', 'O que espera: cobrar, se defender, indenização, rescisão?'],
      documentos: ['Contrato, título (cheque, nota promissória, duplicata) ou provas da relação', 'Comprovantes de pagamento, extratos e notas fiscais', 'Mensagens, e-mails e notificações trocadas',
        'Boletim de ocorrência, laudos e orçamentos (acidente ou dano)', 'Documentos pessoais e comprovante de residência (ou contrato social)'],
      prazos: [P('Prescrição geral', 'CC, art. 205 (10 anos)', 10, 'anos'), P('Reparação civil', 'CC, art. 206, § 3º, V (3 anos)', 3, 'anos'),
        P('Dívida líquida de instrumento público ou particular', 'CC, art. 206, § 5º, I (5 anos)', 5, 'anos'),
        P('Execução de cheque', 'Lei 7.357/1985, art. 59 (6 meses após o prazo de apresentação de 30/60 dias)', 6, 'meses'),
        P('Execução de nota promissória ou duplicata', 'LUG, art. 70; Lei 5.474/1968, art. 18 (3 anos do vencimento)', 3, 'anos'),
        P('Contestação', 'CPC, art. 335 (15 dias úteis)', 15, 'uteis'), P('Embargos à execução', 'CPC, art. 915 (15 dias úteis da juntada do mandado)', 15, 'uteis'),
        P('Impugnação ao cumprimento de sentença', 'CPC, art. 525 (15 dias úteis após o prazo de pagamento)', 15, 'uteis'),
        P('Apelação / agravo de instrumento', 'CPC, art. 1.003, § 5º (15 dias úteis)', 15, 'uteis'), P('Embargos de declaração', 'CPC, art. 1.023 (5 dias úteis)', 5, 'uteis'),
        P('Ação rescisória', 'CPC, art. 975 (2 anos do trânsito em julgado)', 2, 'anos')],
      teses: ['Cobrança e execução de título extrajudicial; embargos (excesso, nulidade, prescrição)', 'Impenhorabilidade (CPC, art. 833; bem de família, Lei 8.009/1990)',
        'Revisão contratual e onerosidade excessiva (CC, arts. 478 a 480)', 'Responsabilidade civil e danos (CC, arts. 186, 927 e 944)',
        'Juros e correção monetária: Lei 14.905/2024 (IPCA e Selic como regra a partir de 30/8/2024)'] },
    'Administrativo e licitações': { sigla: 'RD Adm', justica: ['tjce', 'jf'], resp: 'Rafael', checklist: 'administrativo',
      descricao: 'Fornecedores e contratados do poder público: pagamentos, reajustes, sanções, licitações e omissões administrativas.',
      perguntas: ['Qual o órgão ou ente (município, Estado, União, autarquia) e qual o ato ou a omissão em discussão?',
        'Há contrato, empenho, nota fiscal ou medição pendente de pagamento? Valores e datas?', 'Há processo administrativo, licitação ou sanção em curso? Que prazo está correndo?',
        'Já protocolou requerimento ou recurso administrativo? Com que número e data?', 'Qual o resultado esperado (pagamento, reajuste, anulação, habilitação)?'],
      documentos: ['Edital, contrato, termos aditivos e ordem de serviço', 'Notas de empenho, notas fiscais, medições e comprovantes de entrega', 'Protocolos e respostas do órgão (ou prova da omissão)',
        'Decisão ou sanção impugnada e intimação, com a data', 'Contrato social e certidões da empresa'],
      prazos: [P('Prescrição contra a Fazenda Pública', 'Decreto 20.910/1932, art. 1º (5 anos)', 5, 'anos'), P('Mandado de segurança', 'Lei 12.016/2009, art. 23 (120 dias da ciência do ato)', 120, 'corridos'),
        P('Recurso em licitação', 'Lei 14.133/2021, art. 165 (3 dias úteis); impugnação ao edital até 3 dias úteis antes da abertura (art. 164)', 3, 'uteis'),
        P('Defesa em processo de sanção contratual', 'Lei 14.133/2021, arts. 157 e 158 (15 dias úteis da intimação)', 15, 'uteis'),
        P('Recurso administrativo (processo federal)', 'Lei 9.784/1999, art. 59 (10 dias da ciência); contagem contínua (art. 66)', 10, 'corridos'),
        P('Decisão da Administração sobre requerimento', 'Lei 9.784/1999, art. 49 (30 dias, prorrogáveis por igual período); omissão autoriza o mandado de segurança', 30, 'corridos'),
        P('Decadência para a Administração anular atos favoráveis', 'Lei 9.784/1999, art. 54 (5 anos)', 5, 'anos'),
        P('Ordem cronológica de pagamentos', 'Lei 14.133/2021, art. 141 (preterição indevida é ilegal)', null)],
      teses: ['Pagamento de empenhos liquidados e não pagos; ordem cronológica (Lei 14.133/2021, art. 141)', 'Reajuste, repactuação e reequilíbrio; apostilamento',
        'Nulidade de sanção sem processo regular; proporcionalidade', 'Omissão administrativa: mandado de segurança para obrigar a decidir (Lei 9.784/1999, art. 49)',
        'Honorários contra a Fazenda (CPC, art. 85, § 3º)'] },
    'Empresarial e societário': { sigla: 'RD Emp', justica: ['tjce'], resp: 'Rafael', checklist: 'empresarial',
      descricao: 'Holdings, reorganizações, entrada e saída de sócios, conflitos societários e contratos empresariais.',
      perguntas: ['Qual o tipo de sociedade (Ltda, S.A., SLU) e quantos sócios?', 'Qual o objetivo: holding e planejamento, entrada ou saída de sócio, conflito, reorganização, contrato?',
        'Há contrato social ou acordo de sócios atualizado e balanço recente?', 'Existe prazo ou evento próximo (assembleia, venda, sucessão)?', 'Há dívidas, garantias pessoais ou passivos relevantes?'],
      documentos: ['Contrato social ou estatuto consolidado e alterações (Junta Comercial)', 'Acordo de sócios ou acionistas', 'Balanço patrimonial e DRE dos últimos exercícios',
        'Cartão CNPJ e certidões', 'Contratos relevantes (fornecedores, bancos, imóveis)', 'Documentos pessoais dos sócios e matrículas dos bens (holding)'],
      prazos: [P('Registro de atos na Junta Comercial', 'Lei 8.934/1994, art. 36 (30 dias da assinatura, para efeitos desde a data do ato)', 30, 'corridos'),
        P('Anulação de deliberação de assembleia (S.A.)', 'Lei 6.404/1976, art. 286 (2 anos)', 2, 'anos'), P('Anulação de decisões da pessoa jurídica', 'CC, art. 48, parágrafo único (3 anos)', 3, 'anos'),
        P('Responsabilidade do sócio que se retira', 'CC, arts. 1.003, parágrafo único, e 1.032 (2 anos após a averbação)', 2, 'anos'),
        P('Responsabilidade de administradores (violação da lei ou do estatuto)', 'CC, art. 206, § 3º, VII (3 anos)', 3, 'anos'),
        P('Exclusão de sócio', 'CC, arts. 1.030 e 1.085 (reunião ou assembleia com direito de defesa)', null), P('Apuração de haveres', 'CC, art. 1.031; CPC, arts. 599 a 609 (dissolução parcial)', null)],
      teses: ['Holding familiar e planejamento sucessório (ITBI: imunidade do art. 156, § 2º, I, da CF; Tema 796 do STF)', 'Exclusão de sócio por justa causa (CC, art. 1.085)',
        'Dissolução parcial e apuração de haveres (balanço de determinação)', 'Desconsideração da personalidade jurídica: requisitos do art. 50 do CC (Lei 13.874/2019)',
        'Transformação, incorporação, fusão e cisão (Lei 6.404/1976, arts. 220 a 234)'] },
    'Imobiliário': { sigla: 'RD Imob', justica: ['tjce'], resp: 'Rafael', checklist: 'imobiliario',
      descricao: 'Compra e venda, locação, posse e usucapião, regularização e licenças de imóveis.',
      perguntas: ['Qual o imóvel (endereço, matrícula, cartório) e qual a situação (compra, venda, aluguel, posse, regularização)?', 'Há escritura, contrato ou só a posse? Desde quando?',
        'Há dívidas (IPTU, condomínio), penhoras ou disputas sobre o imóvel?', 'Qual o valor envolvido e há prazo (escritura, despejo, obra)?', 'Quem são as outras partes (vendedor, inquilino, vizinhos, prefeitura)?'],
      documentos: ['Matrícula atualizada e certidões do imóvel (ônus, IPTU)', 'Escritura, contrato de compra e venda, promessa ou contrato de locação',
        'Provas da posse (contas, IPTU, fotos, testemunhas) para usucapião', 'Planta, memorial descritivo e ART (regularização ou usucapião)', 'Documentos pessoais e certidões das partes', 'Alvarás, habite-se e protocolos na prefeitura'],
      prazos: [P('Usucapião', 'CC, arts. 1.238 a 1.242 (15, 10 ou 5 anos, conforme a modalidade); urbana especial: CF, art. 183 (5 anos, até 250 m²)', null),
        P('Vício oculto em imóvel', 'CC, art. 445 (1 ano da entrega; se já estava na posse, da alienação, reduzido à metade)', 1, 'anos'),
        P('Obra defeituosa (empreiteiro)', 'CC, art. 618 (garantia de 5 anos; ação em 180 dias do aparecimento do vício)', 180, 'corridos'),
        P('Purga da mora no despejo por falta de pagamento', 'Lei 8.245/1991, art. 62, II (15 dias da citação)', 15, 'uteis'),
        P('Desocupação após denúncia', 'Lei 8.245/1991, arts. 46, § 2º, e 57 (30 dias)', 30, 'corridos'),
        P('Preferência do locatário na venda', 'Lei 8.245/1991, art. 28 (30 dias para aceitar) e art. 33 (6 meses para a adjudicação)', 30, 'corridos'),
        P('Cobrança de cotas de condomínio', 'CC, art. 206, § 5º, I (5 anos — Tema 949 do STJ)', 5, 'anos')],
      teses: ['Usucapião extrajudicial (Lei 6.015/1973, art. 216-A) e judicial', 'Regularização fundiária (REURB, Lei 13.465/2017)', 'Adjudicação compulsória e outorga de escritura (CC, art. 1.418)',
        'Distrato e rescisão de compra e venda (Lei 13.786/2018: retenção de até 25% ou 50%)', 'ITBI: fato gerador no registro (Tema 1.124 do STF) e base de cálculo (Tema 1.113 do STJ) — RD Trib',
        'Habite-se e licenças: mandado de segurança contra omissão ou negativa'] },
    'Outra': { sigla: 'RD', justica: ['tjce'], resp: 'Rafael', checklist: 'contencioso', descricao: 'Demandas fora das áreas acima.',
      perguntas: ['Descreva a situação, as partes e as datas.', 'Há documentos ou processo em curso?', 'Há prazo correndo?'], documentos: ['Documentos pessoais ou contrato social', 'Documentos relacionados ao caso'],
      prazos: [P('Contestação', 'CPC, art. 335 (15 dias úteis)', 15, 'uteis'), P('Apelação', 'CPC, art. 1.003, § 5º (15 dias úteis)', 15, 'uteis'), P('Prescrição geral', 'CC, art. 205 (10 anos)', 10, 'anos')], teses: [] }
  };
  const LISTA = Object.keys(MATERIAS).filter(k => k !== 'Outra');
  // detecção pela conversa (mesma lista do cartão de lead): a primeira regra que casar manda
  const DETECCAO = [[/execu[cç][aã]o fiscal|penhora|\bCDA\b|d[ií]vida ativa|bloqueio|sisbajud/i, 'Execução fiscal'],
    [/\bINSS\b|aposentad|benef[ií]cio|previdenci|sal[aá]rio-maternidade|\bBPC\b|\bLOAS\b|aux[ií]lio-doen[cç]a|pens[aã]o por morte/i, 'Previdenciário'],
    [/licita|contrato administrativo|prefeitura|munic[ií]pio|empenho|reajuste de contrato|\bedital\b/i, 'Administrativo e licitações'],
    [/trabalhis|demiss|\bCLT\b|reclama[cç][aã]o trabalhista|funcion[aá]ri|rescis[aã]o|verbas rescis/i, 'Trabalhista'],
    [/holding|societ|s[oó]cio|contrato social|sucess/i, 'Empresarial e societário'],
    [/im[oó]ve(l|is)|escritura|matr[ií]cula|usucapi|ITBI|terreno|loteamento|aluguel|loca[cç][aã]o|despejo|inquilin/i, 'Imobiliário'],
    [/consumidor|negativ(a[cç][aã]o|ado|aram)|serasa|\bspc\b|plano de sa[uú]de|cobran[cç]a indevida|produto com defeito|operadora|cart[aã]o de cr[eé]dito|empr[eé]stimo consignado|\bvoo\b|bagagem/i, 'Consumidor'],
    [/\bICMS\b|\bISS\b|\bPIS\b|COFINS|imposto|tribut|Simples Nacional|\bIRPJ\b|\bCSLL\b|restitui|cr[eé]dito/i, 'Tributário'],
    [/cobran[cç]a|indeniza|execu[cç][aã]o de t[ií]tulo|contrato|danos|a[cç][aã]o c[ií]vel/i, 'Cível']];
  function detectar(texto) { const t = String(texto || ''); const a = DETECCAO.find(([re]) => re.test(t)); return a ? a[1] : ''; }
  const de = area => MATERIAS[area] || MATERIAS['Outra'];
  const sigla = area => (MATERIAS[area] || {}).sigla || (area ? 'RD' : '');
  const porSigla = s => Object.keys(MATERIAS).find(k => MATERIAS[k].sigla.toLowerCase() === String(s || '').trim().toLowerCase()) || '';
  // matéria de uma conversa do Atendimento: a definida na ficha, depois a detectada pelo pedido e pelas mensagens do cliente
  function daConversa(c) { if (!c) return ''; const f = c.ficha || {}; if (f.area) return f.area; if (c.area) return c.area;
    return detectar([f.resumo, ...((c.msgs || []).filter(m => m.de === 'cli').map(m => m.tx))].join('\n')); }
  // datas
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dia = s => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d, 12); };
  const soma = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const pp = () => root.PrazoProcessual || null;
  const utilSimples = d => d.getDay() !== 0 && d.getDay() !== 6;
  const ehUtil = (d, trib, com) => { const P2 = pp(); return P2 ? P2.util(iso(d), [], trib, com) : utilSimples(d); };
  const tribunalDe = area => { const j = de(area).justica[0]; return j === 'jf' ? 'jf' : j === 'tjce' ? 'tjce' : ''; };
  /* vencimentos(area, dataBase, { hoje, tribunal, comarca: 'sobral'|'' }) → prazos da matéria com a data-limite calculada a partir de dataBase (ciência, intimação, fato ou pagamento).
   * Dias úteis pela calculadora de prazos (feriados do tribunal e recesso); corridos com prorrogação para o dia útil seguinte; anos/meses pelo calendário. É estimativa a conferir. */
  function vencimentos(area, dataBase, o) {
    o = o || {}; const com = o.comarca || '', m = de(area), trib = o.tribunal != null ? o.tribunal : tribunalDe(area), hoje = o.hoje || iso(new Date()), base = dataBase ? dia(dataBase) : null;
    return m.prazos.map(p => { let venc = '', como = '';
      if (base && p.n != null) {
        if (p.contagem === 'anos' || p.contagem === 'meses') { const d = new Date(base); if (p.contagem === 'anos') d.setFullYear(d.getFullYear() + p.n); else d.setMonth(d.getMonth() + p.n); venc = iso(d); como = p.n + ' ' + (p.contagem === 'anos' ? (p.n === 1 ? 'ano' : 'anos') : 'meses') + ' pelo calendário'; }
        else if (p.contagem === 'uteis') { const P2 = pp(); if (P2) { try { venc = P2.calcular({ intimacao: iso(base), dias: p.n, tribunal: trib, comarca: com }).vencimento; } catch (e) { venc = ''; } }
          if (!venc) { let d = base, c = 0; while (c < p.n) { d = soma(d, 1); if (utilSimples(d)) c++; } venc = iso(d); } como = p.n + ' dias úteis' + (P2 ? ' (calendário ' + (trib || 'nacional') + ')' : ' (só fins de semana excluídos)'); }
        else { let d = soma(base, p.n); while (!ehUtil(d, trib, com)) d = soma(d, 1); venc = iso(d); como = p.n + ' dias corridos' + (p.contagem === 'conferir' ? ' — contagem a conferir' : ', prorrogado para o dia útil se cair em dia sem expediente'); }
      }
      return Object.assign({}, p, { vencimento: venc, como, vencido: !!(venc && venc < hoje), diasAte: venc ? Math.round((dia(venc) - dia(hoje)) / 864e5) : null }); });
  }
  /* contadores({ convs, tarefas, procs, pubs, leads }, hoje) → por matéria: conversas abertas, tarefas pendentes/vencidas, processos, publicações novas, leads abertos */
  function contadores(d, hoje) {
    d = d || {}; hoje = hoje || iso(new Date()); const out = {}; const k0 = a => { const k = a || 'Outra'; return out[k] = out[k] || { area: k, sigla: sigla(k), abertas: 0, concluidas: 0, tarefas: 0, vencidas: 0, processos: 0, publicacoes: 0, leads: 0, cnjs: new Set() }; };
    (d.convs || []).forEach(c => { if (!c.ficha) return; const r = k0(daConversa(c)); if (c.ficha.status === 'Concluída') r.concluidas++; else r.abertas++; if (c.ficha.astrea && c.ficha.astrea.cnj) r.cnjs.add(c.ficha.astrea.cnj); });
    (d.tarefas || []).forEach(t => { if (t.status === 'feita') return; const r = k0(t.area && MATERIAS[t.area] ? t.area : areaDoChecklist(t.checklist) || t.area); r.tarefas++; if (t.prazo && t.prazo < hoje) r.vencidas++; });
    const areaCnj = {}; (d.convs || []).forEach(c => { const cnj = c.ficha && c.ficha.astrea && c.ficha.astrea.cnj; if (cnj) areaCnj[cnj] = daConversa(c); });
    (d.procs || []).forEach(p => { if (p.cnj) k0(areaCnj[p.cnj] || p.area).cnjs.add(p.cnj); });
    (d.pubs || []).forEach(p => { if (p.status === 'nova') k0(areaCnj[p.cnj] || p.area).publicacoes++; });
    (d.leads || []).forEach(l => { if (['novo', 'reuniao', 'proposta'].includes(l.etapa)) k0(l.area).leads++; });
    Object.values(out).forEach(r => { r.processos = r.cnjs.size; delete r.cnjs; });
    return LISTA.concat(['Outra']).filter(a => out[a]).map(a => out[a]).concat(Object.values(out).filter(r => !MATERIAS[r.area]));
  }
  function areaDoChecklist(k) { return Object.keys(MATERIAS).find(a => MATERIAS[a].checklist === k) || ''; }
  // texto pronto para a equipe colar na conversa (perguntas e documentos); não é enviado automaticamente
  function textoTriagem(area) { const m = de(area); return 'Para avaliarmos o seu caso, poderia nos responder:\n' + m.perguntas.map((p, i) => (i + 1) + '. ' + p).join('\n') +
    '\n\nE, se tiver em mãos, enviar:\n' + m.documentos.map(x => '• ' + x).join('\n'); }
  const API = { MATERIAS, LISTA, detectar, de, sigla, porSigla, daConversa, vencimentos, contadores, textoTriagem, areaDoChecklist, tribunalDe, versao: '1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Materia = API;
})(typeof window !== 'undefined' ? window : globalThis);
