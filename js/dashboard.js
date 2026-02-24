// dashboard.js — Painel geral com resumos e gráficos
const Dashboard = {
  init() {
    this.refresh();
  },

  refresh() {
    this.renderSummary();
    this.renderComodoChart();
    this.renderCategoriaChart();
    this.renderProximasTarefas();
    this.renderOrcamentoProgress();
  },

  renderSummary() {
    const totalGasto = Storage.getTotalGastos();
    const orc = Storage.getOrcamento();
    const totalOrcamento = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const restante = totalOrcamento - totalGasto;

    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const totalTarefas = tarefas.length;
    const progresso = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

    const materiais = Storage.getAll('materiais');
    const matPendentes = materiais.filter(m => m.status === 'pendente').length;

    document.getElementById('dash-total-gasto').textContent = Fmt.moeda(totalGasto);
    document.getElementById('dash-orcamento-restante').textContent = Fmt.moeda(restante);
    document.getElementById('dash-orcamento-restante').className =
      'value ' + (restante < 0 ? 'danger' : restante < totalOrcamento * 0.2 ? 'warning' : 'success');
    document.getElementById('dash-progresso').textContent = progresso + '%';
    document.getElementById('dash-mat-pendentes').textContent = matPendentes;
  },

  renderComodoChart() {
    const comodos = ['churrasqueira', 'banheiro', 'quarto'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };
    const cores = {
      churrasqueira: 'var(--cor-churrasqueira)',
      banheiro: 'var(--cor-banheiro)',
      quarto: 'var(--cor-quarto)',
    };

    const totais = comodos.map(c => Storage.getTotalGastos({ comodo: c }));
    const max = Math.max(...totais, 1);

    const container = document.getElementById('dash-chart-comodo');
    container.innerHTML = comodos.map((c, i) => `
      <div class="bar-row">
        <span class="bar-label">${nomes[c]}</span>
        <div class="bar-track">
          <div class="bar-value" style="width:${(totais[i] / max) * 100}%;background:${cores[c]}">
            ${Fmt.moeda(totais[i])}
          </div>
        </div>
      </div>
    `).join('');
  },

  renderCategoriaChart() {
    const categorias = ['material', 'mao-de-obra', 'frete', 'ferramentas', 'outros'];
    const nomes = {
      'material': 'Material',
      'mao-de-obra': 'Mao de Obra',
      'frete': 'Frete',
      'ferramentas': 'Ferramentas',
      'outros': 'Outros',
    };
    const cores = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#6b7280'];

    const totais = categorias.map(c => Storage.getTotalGastos({ categoria: c }));
    const max = Math.max(...totais, 1);

    const container = document.getElementById('dash-chart-categoria');
    container.innerHTML = categorias.map((c, i) => {
      if (totais[i] === 0) return '';
      return `
        <div class="bar-row">
          <span class="bar-label">${nomes[c]}</span>
          <div class="bar-track">
            <div class="bar-value" style="width:${(totais[i] / max) * 100}%;background:${cores[i]}">
              ${Fmt.moeda(totais[i])}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (totais.every(t => t === 0)) {
      container.innerHTML = '<p class="text-muted text-sm text-center">Nenhum gasto registrado</p>';
    }
  },

  renderOrcamentoProgress() {
    const orc = Storage.getOrcamento();
    const comodos = ['churrasqueira', 'banheiro', 'quarto'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };

    const container = document.getElementById('dash-orcamento-progress');
    const totalOrcamento = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;

    if (totalOrcamento === 0) {
      container.innerHTML = `
        <div class="text-center">
          <p class="text-muted text-sm mb-8">Nenhum orcamento definido</p>
          <button class="btn btn-secondary" onclick="App.openOrcamentoModal()" style="width:auto">
            Definir Orcamento
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = comodos.map(c => {
      const budget = orc[c] || 0;
      if (budget === 0) return '';
      const gasto = Storage.getTotalGastos({ comodo: c });
      const pct = Math.min((gasto / budget) * 100, 100);
      const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';

      return `
        <div class="mb-8">
          <div class="flex-between">
            <span class="text-sm fw-bold">${nomes[c]}</span>
            <span class="text-sm text-muted">${Fmt.moeda(gasto)} / ${Fmt.moeda(budget)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderProximasTarefas() {
    const tarefas = Storage.getAll('tarefas')
      .filter(t => t.status !== 'concluido')
      .sort((a, b) => (a.dataInicio || '').localeCompare(b.dataInicio || ''))
      .slice(0, 5);

    const container = document.getElementById('dash-proximas-tarefas');

    if (tarefas.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center">Nenhuma tarefa pendente</p>';
      return;
    }

    container.innerHTML = tarefas.map(t => `
      <div class="item-row">
        <div class="item-info">
          <div class="item-title">${this._escapeHtml(t.descricao)}</div>
          <div class="item-subtitle">
            <span class="comodo-tag ${t.comodo}">${t.comodo}</span>
            ${t.dataInicio ? ' - ' + Fmt.data(t.dataInicio) : ''}
          </div>
        </div>
        <span class="status-badge ${t.status.replace(/\s/g, '-')}">${t.status}</span>
      </div>
    `).join('');
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
