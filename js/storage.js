// storage.js — Camada de persistência (localStorage)
const Storage = {
  KEYS: {
    gastos: 'reforma_gastos',
    materiais: 'reforma_materiais',
    profissionais: 'reforma_profissionais',
    pagamentos: 'reforma_pagamentos',
    tarefas: 'reforma_tarefas',
    orcamento: 'reforma_orcamento',
    config: 'reforma_config',
    fornecedores: 'reforma_fornecedores',
    cotacoes: 'reforma_cotacoes',
  },

  // CRUD genérico
  getAll(key) {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS[key])) || [];
    } catch {
      return [];
    }
  },

  save(key, data) {
    localStorage.setItem(this.KEYS[key], JSON.stringify(data));
  },

  add(key, item) {
    const items = this.getAll(key);
    item.id = this._generateId();
    item.criadoEm = new Date().toISOString();
    items.push(item);
    this.save(key, items);
    return item;
  },

  update(key, id, updates) {
    const items = this.getAll(key);
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, atualizadoEm: new Date().toISOString() };
    this.save(key, items);
    return items[index];
  },

  remove(key, id) {
    const items = this.getAll(key).filter(i => i.id !== id);
    this.save(key, items);
  },

  getById(key, id) {
    return this.getAll(key).find(i => i.id === id) || null;
  },

  // Orçamento por cômodo
  getOrcamento() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.orcamento)) || {
        churrasqueira: 0,
        banheiro: 0,
        quarto: 0,
        geral: 0,
      };
    } catch {
      return { churrasqueira: 0, banheiro: 0, quarto: 0, geral: 0 };
    }
  },

  saveOrcamento(orc) {
    localStorage.setItem(this.KEYS.orcamento, JSON.stringify(orc));
  },

  // Configurações
  getConfig() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.config)) || { temaEscuro: false };
    } catch {
      return { temaEscuro: false };
    }
  },

  saveConfig(cfg) {
    localStorage.setItem(this.KEYS.config, JSON.stringify(cfg));
  },

  // Export/Import
  exportAll() {
    const data = {};
    for (const [name, key] of Object.entries(this.KEYS)) {
      try {
        const raw = localStorage.getItem(key);
        data[name] = raw ? JSON.parse(raw) : null;
      } catch {
        data[name] = null;
      }
    }
    data._exportadoEm = new Date().toISOString();
    data._versao = '1.0';
    return data;
  },

  importAll(data) {
    if (!data || !data._versao) throw new Error('Arquivo de backup inválido');
    for (const [name, key] of Object.entries(this.KEYS)) {
      if (data[name] !== undefined && data[name] !== null) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    }
  },

  // Helpers
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  // Totais calculados
  getTotalGastos(filtro = {}) {
    let gastos = this.getAll('gastos');
    if (filtro.comodo) gastos = gastos.filter(g => g.comodo === filtro.comodo);
    if (filtro.categoria) gastos = gastos.filter(g => g.categoria === filtro.categoria);
    return gastos.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
  },

  getTotalMateriais(filtro = {}) {
    let materiais = this.getAll('materiais');
    if (filtro.comodo) materiais = materiais.filter(m => m.comodo === filtro.comodo);
    if (filtro.status) materiais = materiais.filter(m => m.status === filtro.status);
    return materiais.reduce((sum, m) => sum + ((parseFloat(m.quantidade) || 0) * (parseFloat(m.precoUnitario) || 0)), 0);
  },

  getTotalPagamentos(filtro = {}) {
    let pagamentos = this.getAll('pagamentos');
    if (filtro.profissionalId) pagamentos = pagamentos.filter(p => p.profissionalId === filtro.profissionalId);
    return pagamentos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
  },
};

// ===== ImageDB — IndexedDB para imagens (planta, fotos, recibos) =====
const ImageDB = {
  DB_NAME: 'reforma_images',
  DB_VERSION: 1,
  STORE: 'images',
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          const store = db.createObjectStore(this.STORE, { keyPath: 'id' });
          store.createIndex('tipo', 'tipo', { unique: false });
          store.createIndex('comodo', 'comodo', { unique: false });
          store.createIndex('ref', 'ref', { unique: false });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async add(item) {
    const db = await this.open();
    item.id = Storage._generateId();
    item.criadoEm = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).add(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(filtro = {}) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => {
        let results = req.result || [];
        if (filtro.tipo) results = results.filter(r => r.tipo === filtro.tipo);
        if (filtro.comodo) results = results.filter(r => r.comodo === filtro.comodo);
        if (filtro.ref) results = results.filter(r => r.ref === filtro.ref);
        resolve(results);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getById(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async remove(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async clear() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  // Comprimir imagem antes de salvar (max 1200px, qualidade 0.7)
  compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Exportar todas as imagens (para backup)
  async exportAll() {
    return this.getAll();
  },

  // Importar imagens de backup
  async importAll(images) {
    if (!Array.isArray(images)) return;
    const db = await this.open();
    const tx = db.transaction(this.STORE, 'readwrite');
    const store = tx.objectStore(this.STORE);
    for (const img of images) {
      store.put(img);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },
};
