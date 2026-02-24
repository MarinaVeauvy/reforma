// cronograma.js — Módulo de cronograma/tarefas da reforma
const Cronograma = {
  editingId: null,
  filtroComodo: 'todos',
  filtroStatus: 'todos',

  init() {
    this.setupFilters();
    this.render();
  },

  setupFilters() {
    document.querySelectorAll('#crono-filtro-comodo .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#crono-filtro-comodo .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroComodo = chip.dataset.value;
        this.render();
      });
    });

    document.querySelectorAll('#crono-filtro-status .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#crono-filtro-status .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroStatus = chip.dataset.value;
        this.render();
      });
    });
  },

  render() {
    let tarefas = Storage.getAll('tarefas');

    if (this.filtroComodo !== 'todos') {
      tarefas = tarefas.filter(t => t.comodo === this.filtroComodo);
    }
    if (this.filtroStatus !== 'todos') {
      tarefas = tarefas.filter(t => t.status === this.filtroStatus);
    }

    // Auto-marcar como atrasado
    const hoje = Fmt.hoje();
    tarefas.forEach(t => {
      if (t.dataFim && t.dataFim < hoje && t.status !== 'concluido') {
        if (t.status !== 'atrasado') {
          Storage.update('tarefas', t.id, { status: 'atrasado' });
          t.status = 'atrasado';
        }
      }
    });

    // Ordenar: em andamento/atrasado primeiro, depois por data
    const statusOrder = { 'atrasado': 0, 'em andamento': 1, 'pendente': 2, 'concluido': 3 };
    tarefas.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      return (a.dataInicio || '').localeCompare(b.dataInicio || '');
    });

    // Progresso
    const todas = Storage.getAll('tarefas');
    const concluidas = todas.filter(t => t.status === 'concluido').length;
    const totalTarefas = todas.length;
    const pct = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

    document.getElementById('crono-progresso').textContent = `${pct}%`;
    document.getElementById('crono-count').textContent =
      `${concluidas}/${totalTarefas} concluída(s)`;

    // Progress bar por cômodo
    this.renderProgressComodos();

    const container = document.getElementById('crono-lista');

    if (tarefas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128197;</div>
          <p>Nenhuma tarefa cadastrada</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tarefas.map(t => `
      <div class="item-row">
        <div class="item-info">
          <div class="item-title">${this._escapeHtml(t.descricao)}</div>
          <div class="item-subtitle">
            <span class="comodo-tag ${t.comodo}">${t.comodo}</span>
            ${t.responsavel ? ' - ' + this._escapeHtml(t.responsavel) : ''}
            ${t.dataInicio ? ' - ' + Fmt.data(t.dataInicio) : ''}
            ${t.dataFim ? ' a ' + Fmt.data(t.dataFim) : ''}
          </div>
        </div>
        <span class="status-badge ${t.status.replace(/\s/g, '-')}">${t.status}</span>
        <div class="item-actions">
          <button class="btn-icon" onclick="Cronograma.cycleStatus('${t.id}')" title="Mudar status">&#8635;</button>
          <button class="btn-icon" onclick="Cronograma.edit('${t.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon danger" onclick="Cronograma.confirmDelete('${t.id}')" title="Excluir">&#10005;</button>
        </div>
      </div>
    `).join('');
  },

  renderProgressComodos() {
    const comodos = ['churrasqueira', 'banheiro', 'quarto'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };
    const todas = Storage.getAll('tarefas');

    const container = document.getElementById('crono-progress-comodos');
    container.innerHTML = comodos.map(c => {
      const doComodo = todas.filter(t => t.comodo === c);
      const total = doComodo.length;
      const concl = doComodo.filter(t => t.status === 'concluido').length;
      const pct = total > 0 ? Math.round((concl / total) * 100) : 0;
      const cls = pct >= 100 ? 'ok' : pct > 0 ? 'warn' : '';

      return `
        <div class="mb-8">
          <div class="flex-between">
            <span class="text-sm fw-bold">${nomes[c]}</span>
            <span class="text-sm text-muted">${concl}/${total}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  openModal(data = null) {
    this.editingId = data ? data.id : null;
    const form = document.getElementById('form-tarefa');
    form.reset();

    if (data) {
      document.getElementById('tarefa-descricao').value = data.descricao || '';
      document.getElementById('tarefa-comodo').value = data.comodo || 'churrasqueira';
      document.getElementById('tarefa-inicio').value = Fmt.dataInput(data.dataInicio) || '';
      document.getElementById('tarefa-fim').value = Fmt.dataInput(data.dataFim) || '';
      document.getElementById('tarefa-responsavel').value = data.responsavel || '';
      document.getElementById('tarefa-status').value = data.status || 'pendente';
    }

    document.getElementById('modal-tarefa-title').textContent =
      data ? 'Editar Tarefa' : 'Nova Tarefa';
    Modal.open('modal-tarefa');
  },

  save() {
    const descricao = document.getElementById('tarefa-descricao').value.trim();
    const comodo = document.getElementById('tarefa-comodo').value;
    const dataInicio = document.getElementById('tarefa-inicio').value;
    const dataFim = document.getElementById('tarefa-fim').value;
    const responsavel = document.getElementById('tarefa-responsavel').value.trim();
    const status = document.getElementById('tarefa-status').value;

    if (!descricao) {
      Toast.show('Preencha a descrição da tarefa');
      return;
    }

    const item = { descricao, comodo, dataInicio, dataFim, responsavel, status };

    if (this.editingId) {
      Storage.update('tarefas', this.editingId, item);
      Toast.show('Tarefa atualizada!');
    } else {
      Storage.add('tarefas', item);
      Toast.show('Tarefa adicionada!');
    }

    Modal.closeAll();
    this.render();
  },

  edit(id) {
    const data = Storage.getById('tarefas', id);
    if (data) this.openModal(data);
  },

  cycleStatus(id) {
    const statusOrder = ['pendente', 'em andamento', 'concluido'];
    const item = Storage.getById('tarefas', id);
    if (!item) return;
    const idx = statusOrder.indexOf(item.status);
    const next = statusOrder[(idx + 1) % statusOrder.length];
    Storage.update('tarefas', id, { status: next });
    Toast.show(`Status: ${next}`);
    this.render();
  },

  async confirmDelete(id) {
    const ok = await Confirm.show('Excluir esta tarefa?');
    if (ok) {
      Storage.remove('tarefas', id);
      Toast.show('Tarefa excluída');
      this.render();
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
