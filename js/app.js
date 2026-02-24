// app.js — Inicialização e navegação da SPA
const App = {
  currentPage: 'dashboard',
  currentSubPage: null,

  init() {
    this.setupNavigation();
    this.setupTheme();
    this.setupFAB();
    this.setupBackupButtons();
    this.registerSW();
    this.navigate('dashboard');

    // Inicializar módulos
    Dashboard.init();
    Gastos.init();
    Materiais.init();
    MaoDeObra.init();
    Cronograma.init();
    PlantaFotos.init();
    Recibos.init();
    Fornecedores.init();
  },

  // PWA Service Worker
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  // Navegação entre páginas
  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) this.navigate(page);
      });
    });
  },

  navigate(page) {
    this.currentPage = page;
    this.currentSubPage = null;

    // Atualizar abas ativas
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Mostrar página ativa
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Atualizar título
    const titles = {
      dashboard: 'Painel',
      gastos: 'Gastos',
      materiais: 'Materiais',
      'mao-de-obra': 'Mao de Obra',
      cronograma: 'Cronograma',
      mais: 'Mais',
    };
    document.getElementById('header-title').textContent = titles[page] || 'Reforma';

    // Atualizar FAB
    this.updateFAB(page);

    // Refresh
    if (page === 'dashboard') Dashboard.refresh();
    if (page === 'mais') this.showMaisMenu();
  },

  // Sub-navegação dentro de "Mais"
  navigateSub(subPage) {
    this.currentSubPage = subPage;
    document.querySelectorAll('#page-mais .sub-page').forEach(p => {
      p.classList.toggle('active', p.id === `sub-${subPage}`);
    });
    document.getElementById('mais-menu').classList.add('hidden');

    const titles = {
      'planta-fotos': 'Planta & Fotos',
      'recibos': 'Recibos',
      'fornecedores': 'Fornecedores',
      'comparativo': 'Comparativo',
      'lista-compras': 'Lista de Compras',
      'calculadora': 'Calculadora',
      'relatorio': 'Relatorio',
    };
    document.getElementById('header-title').textContent = titles[subPage] || 'Mais';

    // Render sub-pages
    if (subPage === 'planta-fotos') PlantaFotos.render();
    if (subPage === 'recibos') Recibos.render();
    if (subPage === 'fornecedores') Fornecedores.render();
    if (subPage === 'comparativo') Fornecedores.renderComparativo();
    if (subPage === 'lista-compras') ListaCompras.render();

    this.updateFAB('mais-' + subPage);
  },

  backToMais() {
    this.currentSubPage = null;
    document.querySelectorAll('#page-mais .sub-page').forEach(p => p.classList.remove('active'));
    document.getElementById('mais-menu').classList.remove('hidden');
    document.getElementById('header-title').textContent = 'Mais';
    this.updateFAB('mais');
  },

  showMaisMenu() {
    document.querySelectorAll('#page-mais .sub-page').forEach(p => p.classList.remove('active'));
    document.getElementById('mais-menu').classList.remove('hidden');
  },

  // FAB
  setupFAB() {
    document.getElementById('fab').addEventListener('click', () => {
      this.onFABClick();
    });
  },

  updateFAB(page) {
    const fab = document.getElementById('fab');
    const pagesWithFAB = ['gastos', 'materiais', 'mao-de-obra', 'cronograma', 'mais-recibos', 'mais-fornecedores', 'mais-planta-fotos'];
    fab.classList.toggle('hidden', !pagesWithFAB.includes(page));
  },

  onFABClick() {
    switch (this.currentPage) {
      case 'gastos': Gastos.openModal(); break;
      case 'materiais': Materiais.openModal(); break;
      case 'mao-de-obra': MaoDeObra.openModal(); break;
      case 'cronograma': Cronograma.openModal(); break;
      case 'mais':
        if (this.currentSubPage === 'recibos') Recibos.scan();
        else if (this.currentSubPage === 'fornecedores') Fornecedores.openModal();
        else if (this.currentSubPage === 'planta-fotos') PlantaFotos.uploadFoto();
        break;
    }
  },

  // Tema escuro
  setupTheme() {
    const config = Storage.getConfig();
    if (config.temaEscuro) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.getElementById('btn-theme').addEventListener('click', () => {
      this.toggleTheme();
    });
  },

  toggleTheme() {
    const config = Storage.getConfig();
    config.temaEscuro = !config.temaEscuro;
    Storage.saveConfig(config);
    document.documentElement.setAttribute(
      'data-theme',
      config.temaEscuro ? 'dark' : ''
    );
  },

  // Backup (Export/Import)
  setupBackupButtons() {
    document.getElementById('btn-backup').addEventListener('click', () => {
      this.openBackupModal();
    });
  },

  openBackupModal() {
    Modal.open('modal-backup');
  },

  async exportData() {
    const data = Storage.exportAll();
    // Incluir imagens do IndexedDB
    try {
      data._imagens = await ImageDB.exportAll();
    } catch { data._imagens = []; }
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reforma-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Backup exportado!');
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Storage.importAll(data);
          if (data._imagens) await ImageDB.importAll(data._imagens);
          Toast.show('Backup restaurado!');
          Modal.closeAll();
          this.navigate(this.currentPage);
          Dashboard.refresh();
        } catch (err) {
          Toast.show('Erro: arquivo invalido');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  // Orçamento
  openOrcamentoModal() {
    const orc = Storage.getOrcamento();
    document.getElementById('orc-churrasqueira').value = orc.churrasqueira || '';
    document.getElementById('orc-banheiro').value = orc.banheiro || '';
    document.getElementById('orc-quarto').value = orc.quarto || '';
    document.getElementById('orc-geral').value = orc.geral || '';
    Modal.open('modal-orcamento');
  },

  saveOrcamento() {
    const orc = {
      churrasqueira: parseFloat(document.getElementById('orc-churrasqueira').value) || 0,
      banheiro: parseFloat(document.getElementById('orc-banheiro').value) || 0,
      quarto: parseFloat(document.getElementById('orc-quarto').value) || 0,
      geral: parseFloat(document.getElementById('orc-geral').value) || 0,
    };
    Storage.saveOrcamento(orc);
    Toast.show('Orcamento salvo!');
    Modal.closeAll();
    Dashboard.refresh();
  },
};

// Utilitários de Modal
const Modal = {
  open(id) {
    document.getElementById(id).classList.add('active');
  },

  close(id) {
    document.getElementById(id).classList.remove('active');
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  },
};

// Toast (notificações)
const Toast = {
  show(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  },
};

// Confirm dialog
const Confirm = {
  _resolve: null,

  show(msg) {
    return new Promise(resolve => {
      this._resolve = resolve;
      document.getElementById('confirm-msg').textContent = msg;
      document.getElementById('confirm-overlay').classList.add('active');
    });
  },

  respond(value) {
    document.getElementById('confirm-overlay').classList.remove('active');
    if (this._resolve) this._resolve(value);
  },
};

// Helpers de formatação
const Fmt = {
  moeda(valor) {
    return parseFloat(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  },

  data(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  },

  dataInput(iso) {
    if (!iso) return '';
    return iso.slice(0, 10);
  },

  hoje() {
    return new Date().toISOString().slice(0, 10);
  },
};

// Inicializar quando DOM pronto
document.addEventListener('DOMContentLoaded', () => App.init());
