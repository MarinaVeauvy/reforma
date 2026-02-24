// recibos.js — Upload de recibos com OCR automático (Tesseract.js)
const Recibos = {
  ocrWorker: null,
  processando: false,

  init() {
    this.render();
  },

  async render() {
    const recibos = await ImageDB.getAll({ tipo: 'recibo' });
    recibos.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

    const container = document.getElementById('recibos-lista');

    if (recibos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧾</div>
          <p>Nenhum recibo escaneado</p>
          <button class="btn btn-primary mt-16" onclick="Recibos.scan()" style="width:auto">📷 Escanear Recibo</button>
        </div>
      `;
      return;
    }

    container.innerHTML = recibos.map(r => `
      <div class="item-row">
        <img src="${r.data}" class="recibo-thumb" onclick="PlantaFotos.viewFull('${r.id}')">
        <div class="item-info">
          <div class="item-title">${r.gastoDesc || 'Recibo'}</div>
          <div class="item-subtitle">
            ${r.gastoValor ? Fmt.moeda(r.gastoValor) : ''}
            ${r.gastoData ? ' - ' + Fmt.data(r.gastoData) : ''}
            ${r.vinculado ? ' ✓ Vinculado' : ''}
          </div>
        </div>
        <div class="item-actions">
          ${!r.vinculado ? `<button class="btn-icon" onclick="Recibos.criarGasto('${r.id}')" title="Criar gasto">$</button>` : ''}
          <button class="btn-icon danger" onclick="Recibos.deleteRecibo('${r.id}')" title="Excluir">✕</button>
        </div>
      </div>
    `).join('');
  },

  scan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.processRecibo(file);
    };
    input.click();
  },

  async processRecibo(file) {
    if (this.processando) {
      Toast.show('Aguarde o processamento anterior...');
      return;
    }

    this.processando = true;
    Toast.show('Processando recibo...');
    document.getElementById('ocr-loading').classList.remove('hidden');

    try {
      // Comprimir imagem
      const imgData = await ImageDB.compressImage(file, 1500, 0.8);

      // OCR com Tesseract.js
      const texto = await this._runOCR(imgData);

      // Extrair dados do texto
      const extracted = this._extractData(texto);

      // Salvar recibo no IndexedDB
      const recibo = await ImageDB.add({
        tipo: 'recibo',
        data: imgData,
        textoOCR: texto,
        gastoDesc: extracted.descricao,
        gastoValor: extracted.valor,
        gastoData: extracted.data,
        vinculado: false,
      });

      document.getElementById('ocr-loading').classList.add('hidden');
      this.processando = false;

      // Abrir modal de gasto pre-preenchido
      this._abrirGastoPreenchido(recibo);
      this.render();

    } catch (err) {
      document.getElementById('ocr-loading').classList.add('hidden');
      this.processando = false;
      console.error('OCR error:', err);
      Toast.show('Erro no OCR. Tente novamente.');
    }
  },

  async _runOCR(imgData) {
    // Carregar Tesseract.js sob demanda
    if (typeof Tesseract === 'undefined') {
      Toast.show('Carregando motor OCR...');
      await this._loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    }

    const result = await Tesseract.recognize(imgData, 'por', {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          const pct = Math.round((info.progress || 0) * 100);
          document.getElementById('ocr-progress-text').textContent = `Lendo... ${pct}%`;
        }
      },
    });

    return result.data.text || '';
  },

  _extractData(texto) {
    const result = { descricao: '', valor: null, data: null };

    // Extrair valor (R$ XX,XX ou R$XX.XX ou padrões comuns)
    const valorPatterns = [
      /(?:total|valor|vlr|subtotal|pagar)[:\s]*R?\$?\s*([\d.,]+)/i,
      /R\$\s*([\d.,]+)/i,
      /(?:total|valor)[:\s]*([\d.,]+)/i,
    ];

    for (const pattern of valorPatterns) {
      const match = texto.match(pattern);
      if (match) {
        let val = match[1].replace(/\./g, '').replace(',', '.');
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0 && num < 1000000) {
          result.valor = num;
          break;
        }
      }
    }

    // Extrair data (DD/MM/YYYY ou DD/MM/YY)
    const dataMatch = texto.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
    if (dataMatch) {
      let [, dia, mes, ano] = dataMatch;
      if (ano.length === 2) ano = '20' + ano;
      const d = parseInt(dia), m = parseInt(mes);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        result.data = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // Extrair descricao (primeira linha significativa ou nome do estabelecimento)
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (linhas.length > 0) {
      // Pegar primeira linha que parece nome de loja/produto
      result.descricao = linhas[0].substring(0, 60);
    }

    return result;
  },

  _abrirGastoPreenchido(recibo) {
    const form = document.getElementById('form-gasto');
    form.reset();
    Gastos.editingId = null;

    if (recibo.gastoDesc) document.getElementById('gasto-descricao').value = recibo.gastoDesc;
    if (recibo.gastoValor) document.getElementById('gasto-valor').value = recibo.gastoValor;
    if (recibo.gastoData) document.getElementById('gasto-data').value = recibo.gastoData;
    else document.getElementById('gasto-data').value = Fmt.hoje();

    // Guardar ref do recibo para vincular depois
    document.getElementById('form-gasto').dataset.reciboId = recibo.id;

    document.getElementById('modal-gasto-title').textContent = 'Gasto do Recibo';
    Toast.show('Dados extraídos! Confira e salve.');
    Modal.open('modal-gasto');
  },

  async criarGasto(reciboId) {
    const recibo = await ImageDB.getById(reciboId);
    if (recibo) this._abrirGastoPreenchido(recibo);
  },

  async deleteRecibo(id) {
    const ok = await Confirm.show('Excluir este recibo?');
    if (ok) {
      await ImageDB.remove(id);
      Toast.show('Recibo excluído');
      this.render();
    }
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },
};
