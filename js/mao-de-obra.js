// mao-de-obra.js — Módulo de controle de mão de obra e pagamentos
const MaoDeObra = {
  editingId: null,
  editingPagId: null,
  view: 'profissionais', // 'profissionais' | 'pagamentos'

  init() {
    this.setupTabs();
    this.render();
  },

  setupTabs() {
    document.querySelectorAll('#mdo-tabs .filter-chip').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#mdo-tabs .filter-chip').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.view = tab.dataset.value;
        this.render();
      });
    });
  },

  render() {
    if (this.view === 'profissionais') {
      this.renderProfissionais();
    } else {
      this.renderPagamentos();
    }
  },

  renderProfissionais() {
    const profissionais = Storage.getAll('profissionais');
    const container = document.getElementById('mdo-lista');

    const totalPago = Storage.getTotalPagamentos();
    document.getElementById('mdo-total').textContent = Fmt.moeda(totalPago);
    document.getElementById('mdo-count').textContent = `${profissionais.length} profissional(is)`;

    if (profissionais.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128119;</div>
          <p>Nenhum profissional cadastrado</p>
        </div>
      `;
      return;
    }

    container.innerHTML = profissionais.map(p => {
      const totalPago = Storage.getTotalPagamentos({ profissionalId: p.id });
      const valorCombinado = parseFloat(p.valor) || 0;
      return `
        <div class="item-row">
          <div class="item-info">
            <div class="item-title">${this._escapeHtml(p.nome)}</div>
            <div class="item-subtitle">
              ${p.especialidade || ''}
              ${p.contato ? ' - ' + p.contato : ''}
              - ${p.tipoCobranca === 'diaria' ? 'Diária' : 'Empreitada'}: ${Fmt.moeda(p.valor)}
            </div>
          </div>
          <div style="text-align:right">
            <div class="item-value">${Fmt.moeda(totalPago)}</div>
            <span class="text-sm text-muted">de ${Fmt.moeda(valorCombinado)}</span>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="MaoDeObra.addPagamento('${p.id}')" title="Registrar pgto">$</button>
            <button class="btn-icon" onclick="MaoDeObra.edit('${p.id}')" title="Editar">&#9998;</button>
            <button class="btn-icon danger" onclick="MaoDeObra.confirmDelete('${p.id}')" title="Excluir">&#10005;</button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderPagamentos() {
    const pagamentos = Storage.getAll('pagamentos')
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const profissionais = Storage.getAll('profissionais');
    const container = document.getElementById('mdo-lista');

    const total = pagamentos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
    document.getElementById('mdo-total').textContent = Fmt.moeda(total);
    document.getElementById('mdo-count').textContent = `${pagamentos.length} pagamento(s)`;

    if (pagamentos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128176;</div>
          <p>Nenhum pagamento registrado</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pagamentos.map(p => {
      const prof = profissionais.find(pr => pr.id === p.profissionalId);
      return `
        <div class="item-row">
          <div class="item-info">
            <div class="item-title">${this._escapeHtml(prof ? prof.nome : 'Profissional removido')}</div>
            <div class="item-subtitle">
              ${this._escapeHtml(p.descricao || '')}
              ${p.data ? ' - ' + Fmt.data(p.data) : ''}
            </div>
          </div>
          <div class="item-value">${Fmt.moeda(p.valor)}</div>
          <div class="item-actions">
            <button class="btn-icon danger" onclick="MaoDeObra.confirmDeletePagamento('${p.id}')" title="Excluir">&#10005;</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openModal(data = null) {
    this.editingId = data ? data.id : null;
    const form = document.getElementById('form-profissional');
    form.reset();

    if (data) {
      document.getElementById('prof-nome').value = data.nome || '';
      document.getElementById('prof-especialidade').value = data.especialidade || '';
      document.getElementById('prof-contato').value = data.contato || '';
      document.getElementById('prof-tipo').value = data.tipoCobranca || 'diaria';
      document.getElementById('prof-valor').value = data.valor || '';
    }

    document.getElementById('modal-profissional-title').textContent =
      data ? 'Editar Profissional' : 'Novo Profissional';
    Modal.open('modal-profissional');
  },

  save() {
    const nome = document.getElementById('prof-nome').value.trim();
    const especialidade = document.getElementById('prof-especialidade').value.trim();
    const contato = document.getElementById('prof-contato').value.trim();
    const tipoCobranca = document.getElementById('prof-tipo').value;
    const valor = document.getElementById('prof-valor').value;

    if (!nome) {
      Toast.show('Preencha o nome');
      return;
    }

    const item = { nome, especialidade, contato, tipoCobranca, valor: parseFloat(valor) || 0 };

    if (this.editingId) {
      Storage.update('profissionais', this.editingId, item);
      Toast.show('Profissional atualizado!');
    } else {
      Storage.add('profissionais', item);
      Toast.show('Profissional adicionado!');
    }

    Modal.closeAll();
    this.render();
  },

  edit(id) {
    const data = Storage.getById('profissionais', id);
    if (data) this.openModal(data);
  },

  addPagamento(profissionalId) {
    this.editingPagId = null;
    const form = document.getElementById('form-pagamento');
    form.reset();
    document.getElementById('pag-profissional-id').value = profissionalId;
    document.getElementById('pag-data').value = Fmt.hoje();

    const prof = Storage.getById('profissionais', profissionalId);
    document.getElementById('modal-pagamento-title').textContent =
      `Pagamento - ${prof ? prof.nome : ''}`;

    Modal.open('modal-pagamento');
  },

  savePagamento() {
    const profissionalId = document.getElementById('pag-profissional-id').value;
    const valor = document.getElementById('pag-valor').value;
    const data = document.getElementById('pag-data').value;
    const descricao = document.getElementById('pag-descricao').value.trim();

    if (!valor) {
      Toast.show('Preencha o valor');
      return;
    }

    Storage.add('pagamentos', {
      profissionalId,
      valor: parseFloat(valor),
      data,
      descricao,
    });

    Toast.show('Pagamento registrado!');
    Modal.closeAll();
    this.render();
  },

  async confirmDelete(id) {
    const ok = await Confirm.show('Excluir este profissional e seus pagamentos?');
    if (ok) {
      // Remover pagamentos associados
      const pagamentos = Storage.getAll('pagamentos').filter(p => p.profissionalId !== id);
      Storage.save('pagamentos', pagamentos);
      Storage.remove('profissionais', id);
      Toast.show('Profissional excluído');
      this.render();
    }
  },

  async confirmDeletePagamento(id) {
    const ok = await Confirm.show('Excluir este pagamento?');
    if (ok) {
      Storage.remove('pagamentos', id);
      Toast.show('Pagamento excluído');
      this.render();
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
