// gastos.js — Módulo de controle de gastos/despesas
const Gastos = {
  editingId: null,
  filtroComodo: 'todos',
  filtroCategoria: 'todos',

  init() {
    this.setupFilters();
    this.render();
  },

  setupFilters() {
    document.querySelectorAll('#gastos-filtro-comodo .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#gastos-filtro-comodo .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroComodo = chip.dataset.value;
        this.render();
      });
    });

    document.querySelectorAll('#gastos-filtro-categoria .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#gastos-filtro-categoria .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filtroCategoria = chip.dataset.value;
        this.render();
      });
    });
  },

  render() {
    let gastos = Storage.getAll('gastos');

    if (this.filtroComodo !== 'todos') {
      gastos = gastos.filter(g => g.comodo === this.filtroComodo);
    }
    if (this.filtroCategoria !== 'todos') {
      gastos = gastos.filter(g => g.categoria === this.filtroCategoria);
    }

    // Ordenar por data (mais recente primeiro)
    gastos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const total = gastos.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);

    // Total
    document.getElementById('gastos-total').textContent = Fmt.moeda(total);
    document.getElementById('gastos-count').textContent = `${gastos.length} registro(s)`;

    // Lista
    const container = document.getElementById('gastos-lista');

    if (gastos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <p>Nenhum gasto registrado</p>
          <button class="btn btn-primary mt-16" onclick="Gastos.openModal()" style="width:auto">+ Adicionar Gasto</button>
        </div>
      `;
      return;
    }

    container.innerHTML = gastos.map(g => `
      <div class="item-row">
        <div class="item-info">
          <div class="item-title">${this._escapeHtml(g.descricao)}</div>
          <div class="item-subtitle">
            <span class="comodo-tag ${g.comodo}">${g.comodo}</span>
            ${g.categoria ? ' - ' + g.categoria : ''}
            ${g.data ? ' - ' + Fmt.data(g.data) : ''}
          </div>
        </div>
        <div class="item-value">${Fmt.moeda(g.valor)}</div>
        <div class="item-actions">
          <button class="btn-icon" onclick="Duplicar.gasto('${g.id}')" title="Duplicar">&#9112;</button>
          <button class="btn-icon" onclick="Gastos.edit('${g.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon danger" onclick="Gastos.confirmDelete('${g.id}')" title="Excluir">&#10005;</button>
        </div>
      </div>
    `).join('');
  },

  openModal(data = null) {
    this.editingId = data ? data.id : null;
    const form = document.getElementById('form-gasto');
    form.reset();

    if (data) {
      document.getElementById('gasto-descricao').value = data.descricao || '';
      document.getElementById('gasto-valor').value = data.valor || '';
      document.getElementById('gasto-data').value = Fmt.dataInput(data.data) || Fmt.hoje();
      document.getElementById('gasto-categoria').value = data.categoria || 'material';
      document.getElementById('gasto-comodo').value = data.comodo || 'churrasqueira';
      document.getElementById('gasto-pagamento').value = data.formaPagamento || 'dinheiro';
    } else {
      document.getElementById('gasto-data').value = Fmt.hoje();
    }

    document.getElementById('modal-gasto-title').textContent = data ? 'Editar Gasto' : 'Novo Gasto';
    Modal.open('modal-gasto');
  },

  save() {
    const descricao = document.getElementById('gasto-descricao').value.trim();
    const valor = document.getElementById('gasto-valor').value;
    const data = document.getElementById('gasto-data').value;
    const categoria = document.getElementById('gasto-categoria').value;
    const comodo = document.getElementById('gasto-comodo').value;
    const formaPagamento = document.getElementById('gasto-pagamento').value;

    if (!descricao || !valor) {
      Toast.show('Preencha descrição e valor');
      return;
    }

    const item = { descricao, valor: parseFloat(valor), data, categoria, comodo, formaPagamento };

    // Vincular recibo se veio de OCR
    const form = document.getElementById('form-gasto');
    const reciboId = form.dataset.reciboId;
    if (reciboId) item.reciboId = reciboId;

    // Parcelamento
    const parcelado = document.getElementById('gasto-parcelado')?.checked;
    const numParcelas = parseInt(document.getElementById('gasto-num-parcelas')?.value) || 1;

    if (this.editingId) {
      Storage.update('gastos', this.editingId, item);
      Historico.registrar('editar', 'gasto', descricao);
      Toast.show('Gasto atualizado!');
    } else if (parcelado && numParcelas > 1) {
      // Gerar parcelas
      const parcelas = Parcelamento.gerarParcelas(item, numParcelas);
      parcelas.forEach(p => Storage.add('gastos', p));
      Historico.registrar('criar', 'gasto', `${descricao} (${numParcelas}x)`);
      Toast.show(`${numParcelas} parcelas criadas!`);
    } else {
      const saved = Storage.add('gastos', item);
      if (reciboId) {
        ImageDB.getById(reciboId).then(recibo => {
          if (recibo) {
            recibo.vinculado = true;
            recibo.gastoId = saved.id;
            ImageDB.add({ ...recibo }).catch(() => {});
          }
        });
      }
      Historico.registrar('criar', 'gasto', descricao);
      Toast.show('Gasto adicionado!');
    }

    // Limpar ref do recibo
    delete form.dataset.reciboId;

    Modal.closeAll();
    this.render();
  },

  edit(id) {
    const data = Storage.getById('gastos', id);
    if (data) this.openModal(data);
  },

  async confirmDelete(id) {
    const ok = await Confirm.show('Excluir este gasto?');
    if (ok) {
      Storage.remove('gastos', id);
      Toast.show('Gasto excluído');
      this.render();
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
