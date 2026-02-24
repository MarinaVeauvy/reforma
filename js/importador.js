// importador.js — Importar dados de PDF, planilha CSV ou entrada manual em lote
const Importador = {
  dadosExtraidos: [],
  tipoImportacao: 'gastos',

  openModal() {
    this.dadosExtraidos = [];
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-file-area').classList.remove('hidden');
    document.getElementById('import-manual-area').classList.add('hidden');
    Modal.open('modal-importador');
  },

  // === IMPORTAR ARQUIVO (PDF ou CSV) ===
  async importarArquivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.csv,.txt';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Toast.show('Processando arquivo...');
      const ext = file.name.split('.').pop().toLowerCase();

      try {
        let texto = '';
        if (ext === 'pdf') {
          texto = await this._extractPDF(file);
        } else {
          texto = await this._readText(file);
        }

        if (!texto.trim()) {
          Toast.show('Não foi possível extrair texto do arquivo');
          return;
        }

        // Detectar tipo de dados e parsear
        this.tipoImportacao = document.getElementById('import-tipo').value;
        this.dadosExtraidos = this._parsearTexto(texto, this.tipoImportacao);

        if (this.dadosExtraidos.length === 0) {
          Toast.show('Nenhum dado encontrado no arquivo');
          return;
        }

        this._renderPreview();
        Toast.show(`${this.dadosExtraidos.length} item(s) encontrado(s)`);
      } catch (err) {
        console.error('Import error:', err);
        Toast.show('Erro ao processar arquivo');
      }
    };
    input.click();
  },

  // === ENTRADA MANUAL EM LOTE ===
  mostrarManual() {
    document.getElementById('import-file-area').classList.add('hidden');
    document.getElementById('import-manual-area').classList.remove('hidden');

    const tipo = document.getElementById('import-tipo').value;
    const exemplos = {
      gastos: 'Cimento 50kg; 35.90; 2026-02-20; material; churrasqueira\nArgamassa AC-III; 28.50; 2026-02-20; material; banheiro\nEletricista; 350; 2026-02-18; mao-de-obra; quarto',
      materiais: 'Cimento CP-II 50kg; 10; saco; 35.90; churrasqueira; pendente\nPorcelanato 60x60; 25; m2; 89.90; banheiro; pendente\nTinta Coral 3.6L; 3; lata; 189; quarto; pendente',
      tarefas: 'Demolir piso antigo; churrasqueira; 2026-03-01; 2026-03-03; Pedreiro; pendente\nInstalar eletrica; quarto; 2026-03-05; 2026-03-07; Eletricista; pendente',
      profissionais: 'João Silva; Pedreiro; 11999887766; diaria; 250\nCarlos Souza; Eletricista; 11998776655; empreitada; 2500',
    };

    document.getElementById('import-manual-text').value = '';
    document.getElementById('import-manual-text').placeholder = `Cole os dados (um por linha):\n\n${exemplos[tipo] || exemplos.gastos}`;
  },

  voltarArquivo() {
    document.getElementById('import-file-area').classList.remove('hidden');
    document.getElementById('import-manual-area').classList.add('hidden');
  },

  processarManual() {
    const texto = document.getElementById('import-manual-text').value.trim();
    if (!texto) { Toast.show('Cole ou digite os dados'); return; }

    this.tipoImportacao = document.getElementById('import-tipo').value;
    this.dadosExtraidos = this._parsearCSV(texto, this.tipoImportacao);

    if (this.dadosExtraidos.length === 0) {
      Toast.show('Nenhum dado reconhecido');
      return;
    }

    this._renderPreview();
    Toast.show(`${this.dadosExtraidos.length} item(s) encontrado(s)`);
  },

  // === PREVIEW E CONFIRMAÇÃO ===
  _renderPreview() {
    document.getElementById('import-file-area').classList.add('hidden');
    document.getElementById('import-manual-area').classList.add('hidden');
    document.getElementById('import-preview').classList.remove('hidden');

    const container = document.getElementById('import-preview-lista');
    const tipo = this.tipoImportacao;

    container.innerHTML = this.dadosExtraidos.map((item, i) => {
      let html = '';
      if (tipo === 'gastos') {
        html = `<strong>${this._esc(item.descricao)}</strong> - ${Fmt.moeda(item.valor)} - ${item.comodo}`;
      } else if (tipo === 'materiais') {
        html = `<strong>${this._esc(item.nome)}</strong> - ${item.quantidade} ${item.unidade} x ${Fmt.moeda(item.precoUnitario)} - ${item.comodo}`;
      } else if (tipo === 'tarefas') {
        html = `<strong>${this._esc(item.descricao)}</strong> - ${item.comodo} - ${item.status}`;
      } else if (tipo === 'profissionais') {
        html = `<strong>${this._esc(item.nome)}</strong> - ${item.especialidade} - ${Fmt.moeda(item.valor)}`;
      }

      return `
        <div class="item-row">
          <div class="item-info"><div class="item-subtitle">${html}</div></div>
          <button class="btn-icon danger" onclick="Importador.removerItem(${i})" title="Remover">✕</button>
        </div>
      `;
    }).join('');

    document.getElementById('import-total-count').textContent =
      `${this.dadosExtraidos.length} item(s) para importar`;
  },

  removerItem(index) {
    this.dadosExtraidos.splice(index, 1);
    if (this.dadosExtraidos.length === 0) {
      document.getElementById('import-preview').classList.add('hidden');
      document.getElementById('import-file-area').classList.remove('hidden');
      return;
    }
    this._renderPreview();
  },

  confirmarImportacao() {
    const tipo = this.tipoImportacao;
    let count = 0;

    this.dadosExtraidos.forEach(item => {
      Storage.add(tipo, item);
      count++;
    });

    Toast.show(`${count} item(s) importado(s)!`);
    this.dadosExtraidos = [];
    Modal.closeAll();

    // Refresh das telas
    if (tipo === 'gastos') Gastos.render();
    if (tipo === 'materiais') Materiais.render();
    if (tipo === 'tarefas') Cronograma.render();
    if (tipo === 'profissionais') MaoDeObra.render();
    Dashboard.refresh();
  },

  // === PARSERS ===

  // Parser de texto livre (PDF extraido)
  _parsearTexto(texto, tipo) {
    // Tentar primeiro como CSV/tabular
    const csvResult = this._parsearCSV(texto, tipo);
    if (csvResult.length > 0) return csvResult;

    // Fallback: extrair dados com heurísticas
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const items = [];

    if (tipo === 'gastos') {
      for (const linha of linhas) {
        const valorMatch = linha.match(/R?\$?\s*([\d.,]+)/);
        if (valorMatch) {
          let val = valorMatch[1].replace(/\./g, '').replace(',', '.');
          const num = parseFloat(val);
          if (!isNaN(num) && num > 0 && num < 1000000) {
            const desc = linha.replace(valorMatch[0], '').replace(/[;\t|]+/g, ' ').trim();
            if (desc.length > 1) {
              items.push({
                descricao: desc.substring(0, 80),
                valor: num,
                data: Fmt.hoje(),
                categoria: this._detectarCategoria(desc),
                comodo: this._detectarComodo(desc),
                formaPagamento: 'dinheiro',
              });
            }
          }
        }
      }
    } else if (tipo === 'materiais') {
      for (const linha of linhas) {
        const valorMatch = linha.match(/R?\$?\s*([\d.,]+)/);
        const qtdMatch = linha.match(/(\d+[\.,]?\d*)\s*(un|kg|m2|m3|m|saco|lata|cx|pct|rolo)/i);
        if (valorMatch || qtdMatch) {
          let val = 0, qtd = 1, unidade = 'un';
          if (valorMatch) {
            val = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
          }
          if (qtdMatch) {
            qtd = parseFloat(qtdMatch[1].replace(',', '.'));
            unidade = qtdMatch[2].toLowerCase();
          }
          const nome = linha.replace(valorMatch?.[0] || '', '').replace(qtdMatch?.[0] || '', '').replace(/[;\t|]+/g, ' ').trim();
          if (nome.length > 1) {
            items.push({
              nome: nome.substring(0, 80),
              quantidade: qtd,
              unidade,
              precoUnitario: val,
              comodo: this._detectarComodo(nome),
              status: 'pendente',
            });
          }
        }
      }
    }

    return items;
  },

  // Parser CSV/delimitado (manual ou arquivo)
  _parsearCSV(texto, tipo) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const items = [];

    // Detectar delimitador
    const delim = texto.includes('\t') ? '\t' : texto.includes(';') ? ';' : ',';

    for (const linha of linhas) {
      // Pular headers
      if (/^(descri|nome|item|material|tarefa|data|#)/i.test(linha)) continue;

      const cols = linha.split(delim).map(c => c.trim());
      if (cols.length < 2) continue;

      try {
        if (tipo === 'gastos' && cols.length >= 2) {
          const valor = parseFloat((cols[1] || '0').replace(/[R$\s]/g, '').replace(',', '.'));
          if (isNaN(valor) || valor <= 0) continue;
          items.push({
            descricao: cols[0],
            valor,
            data: cols[2] || Fmt.hoje(),
            categoria: cols[3] || this._detectarCategoria(cols[0]),
            comodo: cols[4] || this._detectarComodo(cols[0]),
            formaPagamento: cols[5] || 'dinheiro',
          });
        } else if (tipo === 'materiais' && cols.length >= 2) {
          items.push({
            nome: cols[0],
            quantidade: parseFloat((cols[1] || '1').replace(',', '.')) || 1,
            unidade: cols[2] || 'un',
            precoUnitario: parseFloat((cols[3] || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0,
            comodo: cols[4] || this._detectarComodo(cols[0]),
            status: cols[5] || 'pendente',
          });
        } else if (tipo === 'tarefas' && cols.length >= 2) {
          items.push({
            descricao: cols[0],
            comodo: cols[1] || 'churrasqueira',
            dataInicio: cols[2] || '',
            dataFim: cols[3] || '',
            responsavel: cols[4] || '',
            status: cols[5] || 'pendente',
          });
        } else if (tipo === 'profissionais' && cols.length >= 2) {
          items.push({
            nome: cols[0],
            especialidade: cols[1] || '',
            contato: cols[2] || '',
            tipoCobranca: cols[3] || 'diaria',
            valor: parseFloat((cols[4] || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0,
          });
        }
      } catch { continue; }
    }

    return items;
  },

  // === EXTRAÇÃO DE PDF ===
  async _extractPDF(file) {
    // Carregar pdf.js sob demanda
    if (typeof pdfjsLib === 'undefined') {
      Toast.show('Carregando leitor de PDF...');
      await this._loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs', 'module');
      // Fallback para versão UMD se module não funcionar
      if (typeof pdfjsLib === 'undefined') {
        await this._loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3/build/pdf.min.js');
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  },

  _readText(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file, 'UTF-8');
    });
  },

  _loadScript(src, type) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      if (type) s.type = type;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  // === DETECÇÃO AUTOMÁTICA ===
  _detectarCategoria(texto) {
    const t = texto.toLowerCase();
    if (/pedreiro|eletri|encanad|pintor|mestre|servente|mao.?de.?obra|diaria/i.test(t)) return 'mao-de-obra';
    if (/frete|entrega|transporte/i.test(t)) return 'frete';
    if (/ferramenta|furadeira|serra|martelo|trena|nivel/i.test(t)) return 'ferramentas';
    return 'material';
  },

  _detectarComodo(texto) {
    const t = texto.toLowerCase();
    if (/churras|area.?gourmet|bbq|externo/i.test(t)) return 'churrasqueira';
    if (/banheir|wc|lavabo|box|vaso|chuveiro/i.test(t)) return 'banheiro';
    if (/quarto|dormit|suite/i.test(t)) return 'quarto';
    return 'geral';
  },

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
