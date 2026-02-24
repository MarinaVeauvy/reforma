// calculadora.js — Calculadora de materiais por área
const Calculadora = {
  // Tabela de referência de consumo
  MATERIAIS: {
    piso: {
      nome: 'Piso/Revestimento',
      unidade: 'm2',
      campos: ['largura', 'comprimento'],
      calcular: (l, c) => ({ quantidade: Math.ceil(l * c * 1.1), label: 'm2 (+ 10% perda)' }),
    },
    argamassa_piso: {
      nome: 'Argamassa para piso',
      unidade: 'saco 20kg',
      campos: ['largura', 'comprimento'],
      calcular: (l, c) => ({ quantidade: Math.ceil((l * c) * 5 / 20), label: 'sacos 20kg (5kg/m2)' }),
    },
    rejunte: {
      nome: 'Rejunte',
      unidade: 'kg',
      campos: ['largura', 'comprimento'],
      calcular: (l, c) => ({ quantidade: Math.ceil(l * c * 0.5), label: 'kg (0.5kg/m2)' }),
    },
    tinta: {
      nome: 'Tinta (2 demãos)',
      unidade: 'lata 3.6L',
      campos: ['largura', 'altura'],
      calcular: (l, a) => ({ quantidade: Math.ceil((l * a * 2) / 40), label: 'latas 3.6L (40m2/lata, 2 demãos)' }),
    },
    massa_corrida: {
      nome: 'Massa corrida',
      unidade: 'lata 25kg',
      campos: ['largura', 'altura'],
      calcular: (l, a) => ({ quantidade: Math.ceil((l * a) / 25), label: 'latas 25kg (1kg/m2)' }),
    },
    cimento: {
      nome: 'Cimento',
      unidade: 'saco 50kg',
      campos: ['largura', 'comprimento', 'espessura'],
      calcular: (l, c, e) => ({ quantidade: Math.ceil((l * c * (e / 100)) * 14), label: 'sacos 50kg (contrapiso)' }),
    },
    areia: {
      nome: 'Areia',
      unidade: 'm3',
      campos: ['largura', 'comprimento', 'espessura'],
      calcular: (l, c, e) => ({ quantidade: Math.ceil((l * c * (e / 100)) * 1.3 * 10) / 10, label: 'm3 (contrapiso)' }),
    },
    tijolo: {
      nome: 'Tijolo (parede)',
      unidade: 'un',
      campos: ['largura', 'altura'],
      calcular: (l, a) => ({ quantidade: Math.ceil(l * a * 25 * 1.05), label: 'tijolos (25/m2 + 5%)' }),
    },
    azulejo: {
      nome: 'Azulejo/Revestimento parede',
      unidade: 'm2',
      campos: ['largura', 'altura'],
      calcular: (l, a) => ({ quantidade: Math.ceil(l * a * 1.1), label: 'm2 (+ 10% perda)' }),
    },
    tubo_pvc: {
      nome: 'Tubo PVC 100mm',
      unidade: 'barra 6m',
      campos: ['comprimento_total'],
      calcular: (c) => ({ quantidade: Math.ceil(c / 6), label: 'barras de 6m' }),
    },
  },

  materialSelecionado: null,

  init() {},

  openModal() {
    this.materialSelecionado = null;
    document.getElementById('calc-resultado').classList.add('hidden');
    document.getElementById('calc-campos').innerHTML = '';
    Modal.open('modal-calculadora');
  },

  selecionarMaterial(key) {
    this.materialSelecionado = key;
    const mat = this.MATERIAIS[key];

    // Destacar selecionado
    document.querySelectorAll('.calc-mat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.calc-mat-btn[data-key="${key}"]`)?.classList.add('active');

    // Montar campos
    const labels = {
      largura: 'Largura (m)',
      comprimento: 'Comprimento (m)',
      altura: 'Altura (m)',
      espessura: 'Espessura (cm)',
      comprimento_total: 'Comprimento total (m)',
    };

    document.getElementById('calc-campos').innerHTML = `
      <div class="form-row mt-8">
        ${mat.campos.map(c => `
          <div class="form-group">
            <label>${labels[c]}</label>
            <input type="number" id="calc-${c}" class="form-control" step="0.01" min="0" placeholder="0">
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary mt-8" onclick="Calculadora.calcular()">Calcular</button>
    `;

    document.getElementById('calc-resultado').classList.add('hidden');
  },

  calcular() {
    if (!this.materialSelecionado) return;
    const mat = this.MATERIAIS[this.materialSelecionado];
    const valores = mat.campos.map(c => parseFloat(document.getElementById(`calc-${c}`).value) || 0);

    if (valores.some(v => v <= 0)) {
      Toast.show('Preencha todos os campos');
      return;
    }

    const result = mat.calcular(...valores);

    document.getElementById('calc-resultado').classList.remove('hidden');
    document.getElementById('calc-resultado').innerHTML = `
      <div class="summary-card" style="border-left:4px solid var(--primary)">
        <div class="label">${mat.nome}</div>
        <div class="value">${result.quantidade} ${result.label}</div>
        <button class="btn btn-secondary mt-8" onclick="Calculadora.adicionarMaterial()" style="width:auto;padding:8px 16px;font-size:0.8rem">
          + Adicionar aos Materiais
        </button>
      </div>
    `;
  },

  adicionarMaterial() {
    if (!this.materialSelecionado) return;
    const mat = this.MATERIAIS[this.materialSelecionado];
    const valores = mat.campos.map(c => parseFloat(document.getElementById(`calc-${c}`).value) || 0);
    const result = mat.calcular(...valores);

    // Abrir modal de material pre-preenchido
    Materiais.openModal({
      nome: mat.nome,
      quantidade: result.quantidade,
      unidade: mat.unidade,
      precoUnitario: 0,
      comodo: 'churrasqueira',
      status: 'pendente',
    });

    Modal.close('modal-calculadora');
    Toast.show('Preencha o preço e cômodo');
  },
};
