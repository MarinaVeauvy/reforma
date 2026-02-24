// planta-fotos.js — Planta baixa e fotos de progresso por cômodo
const PlantaFotos = {
  comodoAtivo: 'churrasqueira',

  init() {
    this.setupTabs();
    this.render();
  },

  setupTabs() {
    document.querySelectorAll('#pf-tabs .filter-chip').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#pf-tabs .filter-chip').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.comodoAtivo = tab.dataset.value;
        this.render();
      });
    });
  },

  async render() {
    await this.renderPlanta();
    await this.renderFotos();
  },

  async renderPlanta() {
    const container = document.getElementById('pf-planta');
    const plantas = await ImageDB.getAll({ tipo: 'planta', comodo: this.comodoAtivo });

    if (plantas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128506;</div>
          <p>Nenhuma planta baixa</p>
          <button class="btn btn-secondary mt-8" onclick="PlantaFotos.uploadPlanta()" style="width:auto">
            Enviar Planta
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = plantas.map(p => `
      <div class="foto-item" style="position:relative">
        <img src="${p.data}" alt="Planta ${this.comodoAtivo}" class="foto-img planta-img" onclick="PlantaFotos.viewFull('${p.id}')">
        <button class="foto-delete" onclick="PlantaFotos.deletePlanta('${p.id}')" title="Remover">&times;</button>
      </div>
    `).join('') + `
      <button class="btn btn-secondary mt-8" onclick="PlantaFotos.uploadPlanta()" style="width:auto">
        Atualizar Planta
      </button>
    `;
  },

  async renderFotos() {
    const container = document.getElementById('pf-fotos');
    const fotos = await ImageDB.getAll({ tipo: 'foto', comodo: this.comodoAtivo });

    // Ordenar por data
    fotos.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

    if (fotos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128247;</div>
          <p>Nenhuma foto de progresso</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="foto-grid">
        ${fotos.map(f => `
          <div class="foto-item">
            <img src="${f.data}" alt="${f.legenda || ''}" class="foto-img" onclick="PlantaFotos.viewFull('${f.id}')">
            <div class="foto-meta">
              <span class="text-sm">${f.legenda || ''}</span>
              <span class="text-sm text-muted">${Fmt.data(f.criadoEm)}</span>
            </div>
            <button class="foto-delete" onclick="PlantaFotos.deleteFoto('${f.id}')" title="Remover">&times;</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  uploadPlanta() {
    this._pickImage(async (file) => {
      const data = await ImageDB.compressImage(file, 2000, 0.85);
      // Remover planta antiga do comodo
      const antigas = await ImageDB.getAll({ tipo: 'planta', comodo: this.comodoAtivo });
      for (const a of antigas) await ImageDB.remove(a.id);
      await ImageDB.add({ tipo: 'planta', comodo: this.comodoAtivo, data });
      Toast.show('Planta enviada!');
      this.render();
    });
  },

  uploadFoto() {
    // Pedir legenda antes
    const legenda = prompt('Legenda da foto (opcional):') || '';
    this._pickImage(async (file) => {
      const data = await ImageDB.compressImage(file, 1200, 0.7);
      await ImageDB.add({ tipo: 'foto', comodo: this.comodoAtivo, data, legenda });
      Toast.show('Foto adicionada!');
      this.render();
    });
  },

  async deletePlanta(id) {
    const ok = await Confirm.show('Remover esta planta?');
    if (ok) {
      await ImageDB.remove(id);
      Toast.show('Planta removida');
      this.render();
    }
  },

  async deleteFoto(id) {
    const ok = await Confirm.show('Remover esta foto?');
    if (ok) {
      await ImageDB.remove(id);
      Toast.show('Foto removida');
      this.render();
    }
  },

  async viewFull(id) {
    const img = await ImageDB.getById(id);
    if (!img) return;
    document.getElementById('fullscreen-img').src = img.data;
    document.getElementById('fullscreen-overlay').classList.add('active');
  },

  closeFullscreen() {
    document.getElementById('fullscreen-overlay').classList.remove('active');
  },

  _pickImage(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) callback(file);
    };
    input.click();
  },
};
