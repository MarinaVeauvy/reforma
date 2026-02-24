// fornecedores.js — Cadastro de fornecedores + comparativo de preços + lista de compras
const Fornecedores = {
  editingId: null,

  init() {
    this.render();
  },

  render() {
    const fornecedores = Storage.getAll('fornecedores');
    const container = document.getElementById('fornecedores-lista');

    document.getElementById('fornecedores-count').textContent = `${fornecedores.length} fornecedor(es)`;

    if (fornecedores.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#127978;</div>
          <p>Nenhum fornecedor cadastrado</p>
        </div>
      `;
      return;
    }

    container.innerHTML = fornecedores.map(f => {
      const cotacoes = Storage.getAll('cotacoes').filter(c => c.fornecedorId === f.id);
      return `
        <div class="item-row">
          <div class="item-info">
            <div class="item-title">${this._esc(f.nome)}</div>
            <div class="item-subtitle">
              ${f.tipo || ''} ${f.contato ? ' - ' + f.contato : ''}
              ${f.endereco ? ' - ' + f.endereco : ''}
            </div>
          </div>
          <span class="text-sm text-muted">${cotacoes.length} cotacao(oes)</span>
          <div class="item-actions">
            <button class="btn-icon" onclick="Fornecedores.addCotacao('${f.id}')" title="Nova cotacao">$</button>
            <button class="btn-icon" onclick="Fornecedores.edit('${f.id}')" title="Editar">&#9998;</button>
            <button class="btn-icon danger" onclick="Fornecedores.confirmDelete('${f.id}')" title="Excluir">✕</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openModal(data = null) {
    this.editingId = data ? data.id : null;
    const form = document.getElementById('form-fornecedor');
    form.reset();

    if (data) {
      document.getElementById('forn-nome').value = data.nome || '';
      document.getElementById('forn-tipo').value = data.tipo || '';
      document.getElementById('forn-contato').value = data.contato || '';
      document.getElementById('forn-endereco').value = data.endereco || '';
    }

    document.getElementById('modal-fornecedor-title').textContent =
      data ? 'Editar Fornecedor' : 'Novo Fornecedor';
    Modal.open('modal-fornecedor');
  },

  save() {
    const nome = document.getElementById('forn-nome').value.trim();
    const tipo = document.getElementById('forn-tipo').value;
    const contato = document.getElementById('forn-contato').value.trim();
    const endereco = document.getElementById('forn-endereco').value.trim();

    if (!nome) { Toast.show('Preencha o nome'); return; }

    const item = { nome, tipo, contato, endereco };

    if (this.editingId) {
      Storage.update('fornecedores', this.editingId, item);
      Toast.show('Fornecedor atualizado!');
    } else {
      Storage.add('fornecedores', item);
      Toast.show('Fornecedor adicionado!');
    }

    Modal.closeAll();
    this.render();
  },

  edit(id) {
    const data = Storage.getById('fornecedores', id);
    if (data) this.openModal(data);
  },

  async confirmDelete(id) {
    const ok = await Confirm.show('Excluir fornecedor e suas cotacoes?');
    if (ok) {
      const cotacoes = Storage.getAll('cotacoes').filter(c => c.fornecedorId !== id);
      Storage.save('cotacoes', cotacoes);
      Storage.remove('fornecedores', id);
      Toast.show('Fornecedor excluido');
      this.render();
    }
  },

  // Cotações (comparativo de preços)
  addCotacao(fornecedorId) {
    document.getElementById('form-cotacao').reset();
    document.getElementById('cot-fornecedor-id').value = fornecedorId;
    const forn = Storage.getById('fornecedores', fornecedorId);
    document.getElementById('modal-cotacao-title').textContent =
      `Cotacao - ${forn ? forn.nome : ''}`;
    Modal.open('modal-cotacao');
  },

  saveCotacao() {
    const fornecedorId = document.getElementById('cot-fornecedor-id').value;
    const material = document.getElementById('cot-material').value.trim();
    const preco = document.getElementById('cot-preco').value;
    const unidade = document.getElementById('cot-unidade').value;
    const obs = document.getElementById('cot-obs').value.trim();

    if (!material || !preco) { Toast.show('Preencha material e preco'); return; }

    Storage.add('cotacoes', {
      fornecedorId,
      material,
      preco: parseFloat(preco),
      unidade,
      obs,
      data: Fmt.hoje(),
    });

    Toast.show('Cotacao salva!');
    Modal.closeAll();
    this.render();
  },

  // Comparativo de preços por material
  renderComparativo() {
    const cotacoes = Storage.getAll('cotacoes');
    const fornecedores = Storage.getAll('fornecedores');

    // Agrupar por material
    const porMaterial = {};
    cotacoes.forEach(c => {
      const key = c.material.toLowerCase().trim();
      if (!porMaterial[key]) porMaterial[key] = [];
      const forn = fornecedores.find(f => f.id === c.fornecedorId);
      porMaterial[key].push({ ...c, fornecedorNome: forn ? forn.nome : '?' });
    });

    const container = document.getElementById('comparativo-lista');

    const materiais = Object.keys(porMaterial);
    if (materiais.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center">Adicione cotacoes para comparar precos</p>';
      return;
    }

    container.innerHTML = materiais.map(mat => {
      const items = porMaterial[mat].sort((a, b) => a.preco - b.preco);
      const melhor = items[0];
      return `
        <div class="card mb-8">
          <div class="card-title" style="text-transform:capitalize">${mat}</div>
          ${items.map((item, i) => `
            <div class="item-row" style="${i === 0 ? 'background:#d1fae5' : ''}">
              <div class="item-info">
                <div class="item-title">${this._esc(item.fornecedorNome)} ${i === 0 ? '⭐' : ''}</div>
                <div class="item-subtitle">${item.obs || ''} - ${Fmt.data(item.data)}</div>
              </div>
              <div class="item-value">${Fmt.moeda(item.preco)}/${item.unidade}</div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};

// Lista de Compras automática
const ListaCompras = {
  render() {
    const materiais = Storage.getAll('materiais').filter(m => m.status === 'pendente');
    const fornecedores = Storage.getAll('fornecedores');
    const cotacoes = Storage.getAll('cotacoes');

    const container = document.getElementById('lista-compras-content');

    if (materiais.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#128722;</div>
          <p>Todos os materiais ja foram comprados!</p>
        </div>
      `;
      return;
    }

    // Vincular melhor preço de cotação se existir
    const lista = materiais.map(m => {
      const cotacoesMatch = cotacoes.filter(c =>
        c.material.toLowerCase().trim() === m.nome.toLowerCase().trim()
      ).sort((a, b) => a.preco - b.preco);

      const melhorCotacao = cotacoesMatch[0] || null;
      const forn = melhorCotacao
        ? fornecedores.find(f => f.id === melhorCotacao.fornecedorId)
        : null;

      return { ...m, melhorCotacao, fornecedor: forn };
    });

    // Agrupar por cômodo
    const porComodo = {};
    lista.forEach(item => {
      if (!porComodo[item.comodo]) porComodo[item.comodo] = [];
      porComodo[item.comodo].push(item);
    });

    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };
    let totalGeral = 0;

    container.innerHTML = Object.entries(porComodo).map(([comodo, items]) => {
      const subtotal = items.reduce((sum, i) => {
        const preco = i.melhorCotacao ? i.melhorCotacao.preco * i.quantidade : i.precoUnitario * i.quantidade;
        return sum + preco;
      }, 0);
      totalGeral += subtotal;

      return `
        <div class="card mb-8">
          <div class="card-header">
            <span class="comodo-tag ${comodo}">${nomes[comodo] || comodo}</span>
            <span class="fw-bold">${Fmt.moeda(subtotal)}</span>
          </div>
          ${items.map(i => {
            const preco = i.melhorCotacao ? i.melhorCotacao.preco : i.precoUnitario;
            const total = preco * i.quantidade;
            return `
              <div class="item-row">
                <div class="item-info">
                  <div class="item-title">${Fornecedores._esc(i.nome)}</div>
                  <div class="item-subtitle">
                    ${i.quantidade} ${i.unidade}
                    ${i.fornecedor ? ' - ' + i.fornecedor.nome : ''}
                  </div>
                </div>
                <div class="item-value">${Fmt.moeda(total)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');

    container.innerHTML += `
      <div class="flex-between mt-16" style="padding:12px;background:var(--gray-100);border-radius:var(--radius)">
        <span class="fw-bold">Total Estimado</span>
        <span class="fw-bold text-lg">${Fmt.moeda(totalGeral)}</span>
      </div>
    `;
  },

  compartilhar() {
    const materiais = Storage.getAll('materiais').filter(m => m.status === 'pendente');
    if (materiais.length === 0) { Toast.show('Lista vazia'); return; }

    let texto = '🛒 LISTA DE COMPRAS - REFORMA\n\n';
    const porComodo = {};
    materiais.forEach(m => {
      if (!porComodo[m.comodo]) porComodo[m.comodo] = [];
      porComodo[m.comodo].push(m);
    });

    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto' };
    for (const [comodo, items] of Object.entries(porComodo)) {
      texto += `📍 ${nomes[comodo] || comodo}\n`;
      items.forEach(i => {
        texto += `  ☐ ${i.nome} - ${i.quantidade} ${i.unidade}\n`;
      });
      texto += '\n';
    }

    if (navigator.share) {
      navigator.share({ title: 'Lista de Compras', text: texto });
    } else {
      navigator.clipboard.writeText(texto).then(() => Toast.show('Lista copiada!'));
    }
  },
};
