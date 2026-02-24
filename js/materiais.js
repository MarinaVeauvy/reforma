// materiais.js — Módulo de controle de materiais
const Materiais = {
  editingId: null,
  filtroComodo: 'todos',
  filtroStatus: 'todos',

  init() {
    this.setupFilters();
    this.render();
  },

  setupFilters() {
    document.querySelectorAll('#materiais-filtro-comodo .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#materiais-filtro-comodo .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroComodo = chip.dataset.value;
        this.render();
      });
    });

    document.querySelectorAll('#materiais-filtro-status .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#materiais-filtro-status .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroStatus = chip.dataset.value;
        this.render();
      });
    });
  },

  render() {
    let materiais = Storage.getAll('materiais');

    if (this.filtroComodo !== 'todos') {
      materiais = materiais.filter(m => m.comodo === this.filtroComodo);
    }
    if (this.filtroStatus !== 'todos') {
      materiais = materiais.filter(m => m.status === this.filtroStatus);
    }

    const totalPrevisto = materiais.reduce((sum, m) =>
      sum + ((parseFloat(m.quantidade) || 0) * (parseFloat(m.precoUnitario) || 0)), 0);
    const totalComprado = materiais
      .filter(m => m.status !== 'pendente')
      .reduce((sum, m) => sum + ((parseFloat(m.quantidade) || 0) * (parseFloat(m.precoUnitario) || 0)), 0);

    document.getElementById('materiais-total-previsto').textContent = Fmt.moeda(totalPrevisto);
    document.getElementById('materiais-total-comprado').textContent = Fmt.moeda(totalComprado);
    document.getElementById('materiais-count').textContent = `${materiais.length} item(s)`;

    const container = document.getElementById('materiais-lista');

    if (materiais.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>Nenhum material cadastrado</p>
          <button class="btn btn-primary mt-16" onclick="Materiais.openModal()" style="width:auto">+ Adicionar Material</button>
        </div>
      `;
      return;
    }

    container.innerHTML = materiais.map(m => {
      const total = (parseFloat(m.quantidade) || 0) * (parseFloat(m.precoUnitario) || 0);
      return `
        <div class="item-row">
          <div class="item-info">
            <div class="item-title">${this._escapeHtml(m.nome)}</div>
            <div class="item-subtitle">
              <span class="comodo-tag ${m.comodo}">${m.comodo}</span>
              - ${m.quantidade} ${m.unidade || 'un'} x ${Fmt.moeda(m.precoUnitario)}
            </div>
          </div>
          <div style="text-align:right">
            <div class="item-value">${Fmt.moeda(total)}</div>
            <span class="status-badge ${m.status}">${m.status}</span>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="Materiais.cycleStatus('${m.id}')" title="Mudar status">&#8635;</button>
            <button class="btn-icon" onclick="Duplicar.material('${m.id}')" title="Duplicar">&#9112;</button>
            <button class="btn-icon" onclick="Materiais.edit('${m.id}')" title="Editar">&#9998;</button>
            <button class="btn-icon danger" onclick="Materiais.confirmDelete('${m.id}')" title="Excluir">&#10005;</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openModal(data = null) {
    this.editingId = data ? data.id : null;
    const form = document.getElementById('form-material');
    form.reset();

    if (data) {
      document.getElementById('mat-nome').value = data.nome || '';
      document.getElementById('mat-quantidade').value = data.quantidade || '';
      document.getElementById('mat-unidade').value = data.unidade || 'un';
      document.getElementById('mat-preco').value = data.precoUnitario || '';
      document.getElementById('mat-comodo').value = data.comodo || 'churrasqueira';
      document.getElementById('mat-status').value = data.status || 'pendente';
    }

    document.getElementById('modal-material-title').textContent = data ? 'Editar Material' : 'Novo Material';
    Modal.open('modal-material');
  },

  save() {
    const nome = document.getElementById('mat-nome').value.trim();
    const quantidade = document.getElementById('mat-quantidade').value;
    const unidade = document.getElementById('mat-unidade').value;
    const precoUnitario = document.getElementById('mat-preco').value;
    const comodo = document.getElementById('mat-comodo').value;
    const status = document.getElementById('mat-status').value;

    if (!nome) {
      Toast.show('Preencha o nome do material');
      return;
    }

    const item = {
      nome,
      quantidade: parseFloat(quantidade) || 0,
      unidade,
      precoUnitario: parseFloat(precoUnitario) || 0,
      comodo,
      status,
    };

    if (this.editingId) {
      Storage.update('materiais', this.editingId, item);
      Toast.show('Material atualizado!');
    } else {
      Storage.add('materiais', item);
      Toast.show('Material adicionado!');
    }

    Modal.closeAll();
    this.render();
  },

  edit(id) {
    const data = Storage.getById('materiais', id);
    if (data) this.openModal(data);
  },

  cycleStatus(id) {
    const statusOrder = ['pendente', 'comprado', 'entregue', 'aplicado'];
    const item = Storage.getById('materiais', id);
    if (!item) return;
    const idx = statusOrder.indexOf(item.status);
    const next = statusOrder[(idx + 1) % statusOrder.length];
    Storage.update('materiais', id, { status: next });
    Toast.show(`Status: ${next}`);
    this.render();
  },

  async confirmDelete(id) {
    const ok = await Confirm.show('Excluir este material?');
    if (ok) {
      Storage.remove('materiais', id);
      Toast.show('Material excluído');
      this.render();
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
