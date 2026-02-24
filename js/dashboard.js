// dashboard.js — Painel geral com resumos e gráficos
const Dashboard = {
  init() {
    this.refresh();
  },

  refresh() {
    this.renderAlertas();
    this.renderSummary();
    this.renderComodoChart();
    this.renderCategoriaChart();
    this.renderTimelineChart();
    this.renderProximasTarefas();
    this.renderOrcamentoProgress();
  },

  // Alertas de atraso e orçamento estourado
  renderAlertas() {
    const container = document.getElementById('dash-alertas');
    if (!container) return;
    const alertas = [];

    // Tarefas atrasadas
    const hoje = Fmt.hoje();
    const atrasadas = Storage.getAll('tarefas').filter(t =>
      t.dataFim && t.dataFim < hoje && t.status !== 'concluido'
    );
    if (atrasadas.length > 0) {
      alertas.push(`<div class="alerta alerta-danger">⚠️ <strong>${atrasadas.length} tarefa(s) atrasada(s)!</strong> ${atrasadas.map(t => t.descricao).slice(0, 3).join(', ')}</div>`);
    }

    // Orçamento estourado
    const orc = Storage.getOrcamento();
    const comodos = ['churrasqueira', 'banheiro', 'quarto'];
    comodos.forEach(c => {
      if (orc[c] > 0) {
        const gasto = Storage.getTotalGastos({ comodo: c });
        if (gasto > orc[c]) {
          alertas.push(`<div class="alerta alerta-danger">💰 <strong>${c.charAt(0).toUpperCase() + c.slice(1)}</strong> estourou o orçamento! ${Fmt.moeda(gasto)} / ${Fmt.moeda(orc[c])}</div>`);
        } else if (gasto >= orc[c] * 0.9) {
          alertas.push(`<div class="alerta alerta-warning">💡 <strong>${c.charAt(0).toUpperCase() + c.slice(1)}</strong> perto do limite: ${Fmt.moeda(gasto)} / ${Fmt.moeda(orc[c])}</div>`);
        }
      }
    });

    // Materiais pendentes urgentes
    const pendentes = Storage.getAll('materiais').filter(m => m.status === 'pendente');
    if (pendentes.length > 10) {
      alertas.push(`<div class="alerta alerta-info">📦 ${pendentes.length} materiais pendentes de compra</div>`);
    }

    container.innerHTML = alertas.join('');
  },

  // Gráfico de evolução temporal de gastos
  renderTimelineChart() {
    const container = document.getElementById('dash-timeline');
    if (!container) return;

    const gastos = Storage.getAll('gastos').filter(g => g.data).sort((a, b) => a.data.localeCompare(b.data));
    if (gastos.length < 2) {
      container.innerHTML = '<p class="text-muted text-sm text-center">Mínimo 2 gastos com data para gerar gráfico</p>';
      return;
    }

    // Agrupar por dia (acumulado)
    const porDia = {};
    gastos.forEach(g => {
      const dia = g.data.slice(0, 10);
      porDia[dia] = (porDia[dia] || 0) + (parseFloat(g.valor) || 0);
    });

    const dias = Object.keys(porDia).sort();
    let acumulado = 0;
    const pontos = dias.map(dia => {
      acumulado += porDia[dia];
      return { dia, valor: acumulado, gasto: porDia[dia] };
    });

    const maxVal = Math.max(...pontos.map(p => p.valor));
    const chartH = 120;

    // SVG line chart
    const w = 100;
    const pts = pontos.map((p, i) => {
      const x = pontos.length === 1 ? 50 : (i / (pontos.length - 1)) * w;
      const y = chartH - (p.valor / maxVal) * (chartH - 10);
      return `${x},${y}`;
    });

    const polyline = pts.join(' ');
    const area = `0,${chartH} ${polyline} ${w},${chartH}`;

    container.innerHTML = `
      <svg viewBox="0 0 ${w} ${chartH + 5}" style="width:100%;height:${chartH + 30}px" preserveAspectRatio="none">
        <polygon points="${area}" fill="rgba(37,99,235,0.1)" />
        <polyline points="${polyline}" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        ${pontos.map((p, i) => {
          const x = pontos.length === 1 ? 50 : (i / (pontos.length - 1)) * w;
          const y = chartH - (p.valor / maxVal) * (chartH - 10);
          return `<circle cx="${x}" cy="${y}" r="1.5" fill="var(--primary)" />`;
        }).join('')}
      </svg>
      <div class="flex-between text-sm text-muted" style="margin-top:4px">
        <span>${Fmt.data(dias[0])}</span>
        <span class="fw-bold">${Fmt.moeda(acumulado)}</span>
        <span>${Fmt.data(dias[dias.length - 1])}</span>
      </div>
    `;
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
      'mao-de-obra': 'Mão de Obra',
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
          <p class="text-muted text-sm mb-8">Nenhum orçamento definido</p>
          <button class="btn btn-secondary" onclick="App.openOrcamentoModal()" style="width:auto">
            Definir Orçamento
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
