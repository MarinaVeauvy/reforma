// utils.js — Utilitários: máscara moeda, busca, QR code, histórico, WhatsApp

// ===== MÁSCARA DE MOEDA =====
const MoedaMask = {
  // Aplicar em todos os inputs monetários
  init() {
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('input-moeda')) {
        this.format(e.target);
      }
    });
  },

  format(input) {
    let v = input.value.replace(/\D/g, '');
    if (!v) { input.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2);
    input.value = v;
  },

  // Converter display para número
  parse(value) {
    if (!value) return 0;
    return parseFloat(String(value).replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;
  },
};

// ===== BUSCA GLOBAL =====
const BuscaGlobal = {
  isOpen: false,

  toggle() {
    const el = document.getElementById('busca-overlay');
    this.isOpen = !this.isOpen;
    el.classList.toggle('active', this.isOpen);
    if (this.isOpen) {
      document.getElementById('busca-input').value = '';
      document.getElementById('busca-input').focus();
      document.getElementById('busca-resultados').innerHTML = '';
    }
  },

  buscar() {
    const termo = document.getElementById('busca-input').value.trim().toLowerCase();
    if (termo.length < 2) {
      document.getElementById('busca-resultados').innerHTML =
        '<p class="text-muted text-sm text-center">Digite ao menos 2 caracteres</p>';
      return;
    }

    const resultados = [];

    // Buscar em gastos
    Storage.getAll('gastos').forEach(g => {
      if (this._match(g.descricao, termo) || this._match(g.comodo, termo) || this._match(g.categoria, termo)) {
        resultados.push({
          tipo: 'Gasto',
          titulo: g.descricao,
          detalhe: `${Fmt.moeda(g.valor)} - ${g.comodo} - ${Fmt.data(g.data)}`,
          acao: () => { BuscaGlobal.toggle(); App.navigate('gastos'); },
        });
      }
    });

    // Buscar em materiais
    Storage.getAll('materiais').forEach(m => {
      if (this._match(m.nome, termo) || this._match(m.comodo, termo)) {
        resultados.push({
          tipo: 'Material',
          titulo: m.nome,
          detalhe: `${m.quantidade} ${m.unidade} - ${m.comodo} - ${m.status}`,
          acao: () => { BuscaGlobal.toggle(); App.navigate('materiais'); },
        });
      }
    });

    // Buscar em tarefas
    Storage.getAll('tarefas').forEach(t => {
      if (this._match(t.descricao, termo) || this._match(t.comodo, termo) || this._match(t.responsavel, termo)) {
        resultados.push({
          tipo: 'Tarefa',
          titulo: t.descricao,
          detalhe: `${t.comodo} - ${t.status}`,
          acao: () => { BuscaGlobal.toggle(); App.navigate('cronograma'); },
        });
      }
    });

    // Buscar em profissionais
    Storage.getAll('profissionais').forEach(p => {
      if (this._match(p.nome, termo) || this._match(p.especialidade, termo)) {
        resultados.push({
          tipo: 'Profissional',
          titulo: p.nome,
          detalhe: `${p.especialidade} - ${Fmt.moeda(p.valor)}`,
          acao: () => { BuscaGlobal.toggle(); App.navigate('mao-de-obra'); },
        });
      }
    });

    // Buscar em fornecedores
    Storage.getAll('fornecedores').forEach(f => {
      if (this._match(f.nome, termo) || this._match(f.tipo, termo)) {
        resultados.push({
          tipo: 'Fornecedor',
          titulo: f.nome,
          detalhe: `${f.tipo} - ${f.contato || ''}`,
          acao: () => { BuscaGlobal.toggle(); App.navigate('mais'); App.navigateSub('fornecedores'); },
        });
      }
    });

    this._renderResultados(resultados, termo);
  },

  _match(str, termo) {
    return str && str.toLowerCase().includes(termo);
  },

  _renderResultados(resultados, termo) {
    const container = document.getElementById('busca-resultados');
    if (resultados.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm text-center">Nenhum resultado para "${termo}"</p>`;
      return;
    }

    container.innerHTML = resultados.slice(0, 20).map((r, i) => `
      <div class="item-row" onclick="BuscaGlobal._resultados[${i}].acao()" style="cursor:pointer">
        <div class="item-info">
          <div class="item-title">${this._esc(r.titulo)}</div>
          <div class="item-subtitle">${this._esc(r.detalhe)}</div>
        </div>
        <span class="status-badge pendente">${r.tipo}</span>
      </div>
    `).join('');

    this._resultados = resultados;
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};

// ===== QR CODE =====
const QRCode = {
  gerar() {
    const url = window.location.href;
    // Usar API do Google Charts para QR (simples, sem lib)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;

    document.getElementById('qr-img').src = qrUrl;
    document.getElementById('qr-url').textContent = url;
    Modal.open('modal-qrcode');
  },

  copiarLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => Toast.show('Link copiado!'))
      .catch(() => Toast.show('Erro ao copiar'));
  },
};

// ===== HISTÓRICO DE ALTERAÇÕES =====
const Historico = {
  MAX_ENTRIES: 200,

  registrar(acao, tipo, descricao) {
    const log = this.getAll();
    log.unshift({
      id: Storage._generateId(),
      acao,       // 'criar' | 'editar' | 'excluir'
      tipo,       // 'gasto' | 'material' | 'tarefa' | etc.
      descricao,
      data: new Date().toISOString(),
    });
    // Limitar tamanho
    if (log.length > this.MAX_ENTRIES) log.length = this.MAX_ENTRIES;
    localStorage.setItem('reforma_historico', JSON.stringify(log));
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem('reforma_historico')) || [];
    } catch { return []; }
  },

  render() {
    const log = this.getAll();
    const container = document.getElementById('historico-lista');

    if (log.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center">Nenhuma alteração registrada</p>';
      return;
    }

    const icones = { criar: '+', editar: '✎', excluir: '✕' };
    const cores = { criar: 'entregue', editar: 'comprado', excluir: 'atrasado' };

    container.innerHTML = log.slice(0, 50).map(entry => `
      <div class="item-row">
        <span class="status-badge ${cores[entry.acao] || 'pendente'}">${icones[entry.acao] || '•'} ${entry.acao}</span>
        <div class="item-info">
          <div class="item-title">${this._esc(entry.descricao)}</div>
          <div class="item-subtitle">${entry.tipo} - ${Fmt.data(entry.data)} ${new Date(entry.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join('');
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};

// ===== COMPARTILHAR WHATSAPP =====
const WhatsApp = {
  compartilharResumo() {
    const totalGasto = Storage.getTotalGastos();
    const orc = Storage.getOrcamento();
    const totalOrc = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const pct = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;
    const atrasadas = tarefas.filter(t => t.status === 'atrasado').length;

    let texto = `🏗️ *RESUMO DA REFORMA*\n`;
    texto += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    texto += `💰 Total Gasto: ${Fmt.moeda(totalGasto)}\n`;
    texto += `📊 Orçamento: ${Fmt.moeda(totalOrc)}\n`;
    texto += `💵 Saldo: ${Fmt.moeda(totalOrc - totalGasto)}\n\n`;
    texto += `📋 Progresso: ${pct}% (${concluidas}/${tarefas.length} tarefas)\n`;
    if (atrasadas > 0) texto += `⚠️ ${atrasadas} tarefa(s) atrasada(s)\n`;

    texto += `\n🔗 ${window.location.href}`;

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  compartilharListaCompras() {
    const materiais = Storage.getAll('materiais').filter(m => m.status === 'pendente');
    if (materiais.length === 0) { Toast.show('Lista vazia'); return; }

    let texto = `🛒 *LISTA DE COMPRAS - REFORMA*\n\n`;
    const porComodo = {};
    materiais.forEach(m => {
      if (!porComodo[m.comodo]) porComodo[m.comodo] = [];
      porComodo[m.comodo].push(m);
    });

    const nomes = { churrasqueira: '🔥 Churrasqueira', banheiro: '🚿 Banheiro', quarto: '🛏️ Quarto' };
    for (const [comodo, items] of Object.entries(porComodo)) {
      texto += `*${nomes[comodo] || comodo}*\n`;
      items.forEach(i => {
        texto += `  ☐ ${i.nome} - ${i.quantidade} ${i.unidade}\n`;
      });
      texto += '\n';
    }

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  compartilharRelatorio() {
    const orc = Storage.getOrcamento();
    const totalOrc = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const totalGasto = Storage.getTotalGastos();
    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const emAndamento = tarefas.filter(t => t.status === 'em-andamento').length;
    const atrasadas = tarefas.filter(t => t.status === 'atrasado').length;
    const pct = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;

    let texto = `🏗️ *RELATÓRIO DA REFORMA*\n`;
    texto += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;

    // Resumo financeiro
    texto += `💰 *RESUMO FINANCEIRO*\n`;
    texto += `Orçamento: ${Fmt.moeda(totalOrc)}\n`;
    texto += `Total Gasto: ${Fmt.moeda(totalGasto)}\n`;
    texto += `Saldo: ${Fmt.moeda(totalOrc - totalGasto)}\n`;
    texto += `Progresso: ${pct}% (${concluidas}/${tarefas.length} tarefas)\n\n`;

    // Gastos por cômodo
    const comodos = ['churrasqueira', 'banheiro', 'quarto', 'geral'];
    const icones = { churrasqueira: '🔥', banheiro: '🚿', quarto: '🛏️', geral: '📦' };
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto', geral: 'Geral' };

    texto += `📊 *GASTOS POR CÔMODO*\n`;
    comodos.forEach(c => {
      const gasto = Storage.getTotalGastos({ comodo: c });
      const budget = orc[c] || 0;
      if (gasto > 0 || budget > 0) {
        texto += `${icones[c]} *${nomes[c]}*: ${Fmt.moeda(gasto)} / ${Fmt.moeda(budget)}\n`;
      }
    });
    texto += '\n';

    // Materiais
    const materiais = Storage.getAll('materiais');
    const pendentes = materiais.filter(m => m.status === 'pendente').length;
    const comprados = materiais.filter(m => m.status === 'comprado').length;
    const entregues = materiais.filter(m => m.status === 'entregue').length;
    const aplicados = materiais.filter(m => m.status === 'aplicado').length;

    texto += `📦 *MATERIAIS*\n`;
    texto += `Pendentes: ${pendentes} | Comprados: ${comprados} | Entregues: ${entregues} | Aplicados: ${aplicados}\n\n`;

    // Mão de obra
    const profissionais = Storage.getAll('profissionais');
    if (profissionais.length > 0) {
      texto += `👷 *MÃO DE OBRA*\n`;
      profissionais.forEach(p => {
        const totalPago = Storage.getTotalPagamentos({ profissionalId: p.id });
        texto += `• ${p.nome} (${p.especialidade || '-'}): Pago ${Fmt.moeda(totalPago)} de ${Fmt.moeda(p.valor)}\n`;
      });
      texto += '\n';
    }

    // Cronograma
    texto += `📋 *CRONOGRAMA*\n`;
    texto += `Concluídas: ${concluidas} | Em andamento: ${emAndamento} | Atrasadas: ${atrasadas}\n`;
    if (atrasadas > 0) {
      const listaAtrasadas = tarefas.filter(t => t.status === 'atrasado');
      listaAtrasadas.forEach(t => {
        texto += `⚠️ ${t.descricao} (${nomes[t.comodo] || t.comodo})\n`;
      });
    }

    texto += `\n🔗 ${window.location.href}`;

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  abrirOpcoes() {
    const modal = document.getElementById('modal-whatsapp');
    if (modal) modal.classList.add('active');
  },

  fecharOpcoes() {
    const modal = document.getElementById('modal-whatsapp');
    if (modal) modal.classList.remove('active');
  },
};

// ===== CATEGORIAS CUSTOMIZÁVEIS =====
const CategoriasCustom = {
  getCategoriasGastos() {
    const config = Storage.getConfig();
    const padrao = ['material', 'mao-de-obra', 'frete', 'ferramentas', 'outros'];
    return [...padrao, ...(config.categoriasExtras || [])];
  },

  getComodos() {
    const config = Storage.getConfig();
    const padrao = ['churrasqueira', 'banheiro', 'quarto'];
    return [...padrao, ...(config.comodosExtras || [])];
  },

  addCategoria(nome) {
    if (!nome || nome.length < 2) return;
    const config = Storage.getConfig();
    if (!config.categoriasExtras) config.categoriasExtras = [];
    const slug = nome.toLowerCase().trim().replace(/\s+/g, '-');
    if (!config.categoriasExtras.includes(slug)) {
      config.categoriasExtras.push(slug);
      Storage.saveConfig(config);
      Toast.show(`Categoria "${nome}" adicionada!`);
    }
  },

  addComodo(nome) {
    if (!nome || nome.length < 2) return;
    const config = Storage.getConfig();
    if (!config.comodosExtras) config.comodosExtras = [];
    const slug = nome.toLowerCase().trim().replace(/\s+/g, '-');
    if (!config.comodosExtras.includes(slug)) {
      config.comodosExtras.push(slug);
      Storage.saveConfig(config);
      Toast.show(`Cômodo "${nome}" adicionado!`);
    }
  },

  // Atualizar selects dinâmicamente
  refreshSelects() {
    const categorias = this.getCategoriasGastos();
    const comodos = this.getComodos();
    const nomesCat = {
      'material': 'Material', 'mao-de-obra': 'Mão de Obra', 'frete': 'Frete',
      'ferramentas': 'Ferramentas', 'outros': 'Outros',
    };
    const nomesComodo = {
      'churrasqueira': 'Churrasqueira', 'banheiro': 'Banheiro', 'quarto': 'Quarto', 'geral': 'Geral',
    };

    // Atualizar selects de categoria
    document.querySelectorAll('select[data-dynamic="categoria"]').forEach(sel => {
      const current = sel.value;
      sel.innerHTML = categorias.map(c =>
        `<option value="${c}">${nomesCat[c] || c.charAt(0).toUpperCase() + c.slice(1)}</option>`
      ).join('');
      if (current) sel.value = current;
    });

    // Atualizar selects de cômodo
    document.querySelectorAll('select[data-dynamic="comodo"]').forEach(sel => {
      const current = sel.value;
      const includeGeral = sel.dataset.includeGeral === 'true';
      let opts = comodos.map(c =>
        `<option value="${c}">${nomesComodo[c] || c.charAt(0).toUpperCase() + c.slice(1)}</option>`
      ).join('');
      if (includeGeral) opts += '<option value="geral">Geral</option>';
      sel.innerHTML = opts;
      if (current) sel.value = current;
    });
  },

  openModal() {
    Modal.open('modal-categorias');
    this._renderListas();
  },

  _renderListas() {
    const config = Storage.getConfig();
    const extras = config.categoriasExtras || [];
    const comodosExtras = config.comodosExtras || [];

    document.getElementById('cat-extras-lista').innerHTML = extras.length === 0
      ? '<span class="text-sm text-muted">Nenhuma categoria extra</span>'
      : extras.map(c => `
          <span class="filter-chip">${c} <button onclick="CategoriasCustom.removeCategoria('${c}')" style="background:none;border:none;cursor:pointer;color:var(--danger)">✕</button></span>
        `).join('');

    document.getElementById('comodo-extras-lista').innerHTML = comodosExtras.length === 0
      ? '<span class="text-sm text-muted">Nenhum cômodo extra</span>'
      : comodosExtras.map(c => `
          <span class="filter-chip">${c} <button onclick="CategoriasCustom.removeComodo('${c}')" style="background:none;border:none;cursor:pointer;color:var(--danger)">✕</button></span>
        `).join('');
  },

  addFromInput(tipo) {
    const input = document.getElementById(`add-${tipo}-input`);
    const nome = input.value.trim();
    if (!nome) return;
    if (tipo === 'categoria') this.addCategoria(nome);
    else this.addComodo(nome);
    input.value = '';
    this._renderListas();
    this.refreshSelects();
  },

  removeCategoria(slug) {
    const config = Storage.getConfig();
    config.categoriasExtras = (config.categoriasExtras || []).filter(c => c !== slug);
    Storage.saveConfig(config);
    this._renderListas();
    this.refreshSelects();
  },

  removeComodo(slug) {
    const config = Storage.getConfig();
    config.comodosExtras = (config.comodosExtras || []).filter(c => c !== slug);
    Storage.saveConfig(config);
    this._renderListas();
    this.refreshSelects();
  },
};

// ===== PARCELAMENTO =====
const Parcelamento = {
  toggleFields() {
    const parcelado = document.getElementById('gasto-parcelado').checked;
    document.getElementById('gasto-parcelas-group').classList.toggle('hidden', !parcelado);
  },

  gerarParcelas(gasto, totalParcelas) {
    const valorParcela = gasto.valor / totalParcelas;
    const parcelas = [];
    const dataBase = new Date(gasto.data || Date.now());

    for (let i = 0; i < totalParcelas; i++) {
      const dataParcela = new Date(dataBase);
      dataParcela.setMonth(dataParcela.getMonth() + i);
      parcelas.push({
        ...gasto,
        descricao: `${gasto.descricao} (${i + 1}/${totalParcelas})`,
        valor: Math.round(valorParcela * 100) / 100,
        data: dataParcela.toISOString().slice(0, 10),
        parcelamento: { total: totalParcelas, atual: i + 1 },
      });
    }
    return parcelas;
  },
};

// ===== DUPLICAR ITEM =====
const Duplicar = {
  gasto(id) {
    const item = Storage.getById('gastos', id);
    if (!item) return;
    const novo = { ...item, data: Fmt.hoje() };
    delete novo.id;
    delete novo.criadoEm;
    delete novo.atualizadoEm;
    Storage.add('gastos', novo);
    Historico.registrar('criar', 'gasto', `Duplicado: ${novo.descricao}`);
    Toast.show('Gasto duplicado!');
    Gastos.render();
  },

  material(id) {
    const item = Storage.getById('materiais', id);
    if (!item) return;
    const novo = { ...item, status: 'pendente' };
    delete novo.id;
    delete novo.criadoEm;
    delete novo.atualizadoEm;
    Storage.add('materiais', novo);
    Historico.registrar('criar', 'material', `Duplicado: ${novo.nome}`);
    Toast.show('Material duplicado!');
    Materiais.render();
  },

  tarefa(id) {
    const item = Storage.getById('tarefas', id);
    if (!item) return;
    const novo = { ...item, status: 'pendente' };
    delete novo.id;
    delete novo.criadoEm;
    delete novo.atualizadoEm;
    Storage.add('tarefas', novo);
    Historico.registrar('criar', 'tarefa', `Duplicada: ${novo.descricao}`);
    Toast.show('Tarefa duplicada!');
    Cronograma.render();
  },
};

// ===== MODO APRESENTAÇÃO =====
const Apresentacao = {
  abrir() {
    const totalGasto = Storage.getTotalGastos();
    const orc = Storage.getOrcamento();
    const totalOrc = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const pct = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;
    const atrasadas = tarefas.filter(t => t.status === 'atrasado').length;
    const comodos = ['churrasqueira', 'banheiro', 'quarto'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };

    let html = `
      <div style="max-width:600px;margin:0 auto;font-family:system-ui;color:var(--text);padding:20px">
        <h1 style="text-align:center;font-size:1.5rem;margin-bottom:4px">🏗️ Reforma Residencial</h1>
        <p style="text-align:center;color:var(--text-secondary);margin-bottom:24px">${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase">Total Gasto</div>
            <div style="font-size:1.5rem;font-weight:800">${Fmt.moeda(totalGasto)}</div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase">Orçamento</div>
            <div style="font-size:1.5rem;font-weight:800">${Fmt.moeda(totalOrc)}</div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase">Progresso</div>
            <div style="font-size:1.5rem;font-weight:800;color:var(--success)">${pct}%</div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase">Saldo</div>
            <div style="font-size:1.5rem;font-weight:800;color:${totalOrc - totalGasto < 0 ? 'var(--danger)' : 'var(--success)'}">${Fmt.moeda(totalOrc - totalGasto)}</div>
          </div>
        </div>

        <h2 style="font-size:1.1rem;margin-bottom:12px">Por Cômodo</h2>
        ${comodos.map(c => {
          const gasto = Storage.getTotalGastos({ comodo: c });
          const budget = orc[c] || 0;
          const p = budget > 0 ? Math.min(Math.round((gasto / budget) * 100), 100) : 0;
          const tarefasC = tarefas.filter(t => t.comodo === c);
          const conclC = tarefasC.filter(t => t.status === 'concluido').length;
          return `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <strong>${nomes[c]}</strong>
                <span style="font-size:0.85rem">${Fmt.moeda(gasto)} / ${Fmt.moeda(budget)}</span>
              </div>
              <div style="background:var(--gray-200);border-radius:20px;height:8px;overflow:hidden">
                <div style="width:${p}%;height:100%;border-radius:20px;background:${p >= 100 ? 'var(--danger)' : p >= 80 ? 'var(--warning)' : 'var(--success)'}"></div>
              </div>
              <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px">
                Tarefas: ${conclC}/${tarefasC.length} concluídas
              </div>
            </div>
          `;
        }).join('')}

        ${atrasadas > 0 ? `
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:12px;padding:14px;margin-top:16px;text-align:center">
            <strong style="color:#991b1b">⚠️ ${atrasadas} tarefa(s) atrasada(s)</strong>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('apresentacao-content').innerHTML = html;
    document.getElementById('apresentacao-overlay').classList.add('active');
  },

  fechar() {
    document.getElementById('apresentacao-overlay').classList.remove('active');
  },
};
