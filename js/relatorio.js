// relatorio.js — Geração de relatório PDF
const Relatorio = {
  async gerar() {
    Toast.show('Gerando relatório...');

    // Carregar jsPDF sob demanda
    if (typeof jspdf === 'undefined') {
      await this._loadScript('https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js');
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    let y = 20;
    const marginLeft = 20;
    const pageWidth = 170;

    // Helpers
    const addTitle = (text) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(text, marginLeft, y);
      y += 10;
    };

    const addSubtitle = (text) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(text, marginLeft, y);
      y += 7;
    };

    const addLine = (text, indent = 0) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(text, marginLeft + indent, y);
      y += 5;
    };

    const addSep = () => {
      doc.setDrawColor(200);
      doc.line(marginLeft, y, marginLeft + pageWidth, y);
      y += 5;
    };

    // ===== CAPA =====
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Relatório da Reforma', marginLeft, 40);
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, marginLeft, 50);

    const orc = Storage.getOrcamento();
    const totalOrc = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const totalGasto = Storage.getTotalGastos();
    doc.text(`Orçamento Total: ${Fmt.moeda(totalOrc)}`, marginLeft, 60);
    doc.text(`Total Gasto: ${Fmt.moeda(totalGasto)}`, marginLeft, 68);
    doc.text(`Saldo: ${Fmt.moeda(totalOrc - totalGasto)}`, marginLeft, 76);

    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const pct = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;
    doc.text(`Progresso: ${pct}% (${concluidas}/${tarefas.length} tarefas)`, marginLeft, 84);

    // ===== GASTOS POR CÔMODO =====
    doc.addPage();
    y = 20;
    addTitle('Gastos por Cômodo');
    addSep();

    const comodos = ['churrasqueira', 'banheiro', 'quarto', 'geral'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto', geral: 'Geral' };

    comodos.forEach(c => {
      const total = Storage.getTotalGastos({ comodo: c });
      const budget = orc[c] || 0;
      addSubtitle(`${nomes[c]}: ${Fmt.moeda(total)} / ${Fmt.moeda(budget)}`);

      const gastos = Storage.getAll('gastos').filter(g => g.comodo === c);
      gastos.forEach(g => {
        addLine(`${g.descricao} - ${Fmt.moeda(g.valor)} - ${Fmt.data(g.data)} (${g.categoria})`, 5);
      });
      y += 3;
    });

    // ===== MATERIAIS =====
    doc.addPage();
    y = 20;
    addTitle('Materiais');
    addSep();

    const materiais = Storage.getAll('materiais');
    const statusOrder = ['pendente', 'comprado', 'entregue', 'aplicado'];

    statusOrder.forEach(status => {
      const mats = materiais.filter(m => m.status === status);
      if (mats.length === 0) return;
      addSubtitle(`${status.toUpperCase()} (${mats.length})`);
      mats.forEach(m => {
        const total = (m.quantidade || 0) * (m.precoUnitario || 0);
        addLine(`${m.nome} - ${m.quantidade} ${m.unidade} x ${Fmt.moeda(m.precoUnitario)} = ${Fmt.moeda(total)} [${nomes[m.comodo] || m.comodo}]`, 5);
      });
      y += 3;
    });

    // ===== MÃO DE OBRA =====
    doc.addPage();
    y = 20;
    addTitle('Mão de Obra');
    addSep();

    const profissionais = Storage.getAll('profissionais');
    profissionais.forEach(p => {
      const totalPago = Storage.getTotalPagamentos({ profissionalId: p.id });
      addSubtitle(`${p.nome} (${p.especialidade || ''})`);
      addLine(`Tipo: ${p.tipoCobranca} | Combinado: ${Fmt.moeda(p.valor)} | Pago: ${Fmt.moeda(totalPago)}`, 5);

      const pagamentos = Storage.getAll('pagamentos').filter(pg => pg.profissionalId === p.id);
      pagamentos.forEach(pg => {
        addLine(`${Fmt.data(pg.data)} - ${Fmt.moeda(pg.valor)} - ${pg.descricao || ''}`, 10);
      });
      y += 3;
    });

    // ===== CRONOGRAMA =====
    doc.addPage();
    y = 20;
    addTitle('Cronograma');
    addSep();

    comodos.forEach(c => {
      const tarefasComodo = tarefas.filter(t => t.comodo === c);
      if (tarefasComodo.length === 0) return;
      addSubtitle(nomes[c] || c);
      tarefasComodo.forEach(t => {
        const icon = t.status === 'concluido' ? '[X]' : t.status === 'atrasado' ? '[!]' : '[ ]';
        addLine(`${icon} ${t.descricao} - ${t.status} ${t.dataInicio ? '(' + Fmt.data(t.dataInicio) + ' a ' + Fmt.data(t.dataFim) + ')' : ''}`, 5);
      });
      y += 3;
    });

    // ===== SALVAR =====
    doc.save(`relatorio-reforma-${Fmt.hoje()}.pdf`);
    Toast.show('Relatório PDF gerado!');
  },

  async compartilharPDF() {
    Toast.show('Gerando PDF para compartilhar...');

    if (typeof jspdf === 'undefined') {
      await this._loadScript('https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js');
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    let y = 20;
    const marginLeft = 20;
    const pageWidth = 170;

    const addTitle = (text) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(16); doc.setFont(undefined, 'bold');
      doc.text(text, marginLeft, y); y += 10;
    };
    const addSubtitle = (text) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text(text, marginLeft, y); y += 7;
    };
    const addLine = (text, indent = 0) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      doc.text(text, marginLeft + indent, y); y += 5;
    };
    const addSep = () => {
      doc.setDrawColor(200);
      doc.line(marginLeft, y, marginLeft + pageWidth, y); y += 5;
    };

    // Capa
    doc.setFontSize(24); doc.setFont(undefined, 'bold');
    doc.text('Relatório da Reforma', marginLeft, 40);
    doc.setFontSize(12); doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, marginLeft, 50);

    const orc = Storage.getOrcamento();
    const totalOrc = orc.churrasqueira + orc.banheiro + orc.quarto + orc.geral;
    const totalGasto = Storage.getTotalGastos();
    doc.text(`Orçamento Total: ${Fmt.moeda(totalOrc)}`, marginLeft, 60);
    doc.text(`Total Gasto: ${Fmt.moeda(totalGasto)}`, marginLeft, 68);
    doc.text(`Saldo: ${Fmt.moeda(totalOrc - totalGasto)}`, marginLeft, 76);

    const tarefas = Storage.getAll('tarefas');
    const concluidas = tarefas.filter(t => t.status === 'concluido').length;
    const pct = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;
    doc.text(`Progresso: ${pct}% (${concluidas}/${tarefas.length} tarefas)`, marginLeft, 84);

    // Gastos
    doc.addPage(); y = 20;
    addTitle('Gastos por Cômodo'); addSep();
    const comodos = ['churrasqueira', 'banheiro', 'quarto', 'geral'];
    const nomes = { churrasqueira: 'Churrasqueira', banheiro: 'Banheiro', quarto: 'Quarto', geral: 'Geral' };
    comodos.forEach(c => {
      const total = Storage.getTotalGastos({ comodo: c });
      const budget = orc[c] || 0;
      addSubtitle(`${nomes[c]}: ${Fmt.moeda(total)} / ${Fmt.moeda(budget)}`);
      Storage.getAll('gastos').filter(g => g.comodo === c).forEach(g => {
        addLine(`${g.descricao} - ${Fmt.moeda(g.valor)} - ${Fmt.data(g.data)} (${g.categoria})`, 5);
      });
      y += 3;
    });

    // Materiais
    doc.addPage(); y = 20;
    addTitle('Materiais'); addSep();
    const materiais = Storage.getAll('materiais');
    ['pendente', 'comprado', 'entregue', 'aplicado'].forEach(status => {
      const mats = materiais.filter(m => m.status === status);
      if (mats.length === 0) return;
      addSubtitle(`${status.toUpperCase()} (${mats.length})`);
      mats.forEach(m => {
        const total = (m.quantidade || 0) * (m.precoUnitario || 0);
        addLine(`${m.nome} - ${m.quantidade} ${m.unidade} x ${Fmt.moeda(m.precoUnitario)} = ${Fmt.moeda(total)} [${nomes[m.comodo] || m.comodo}]`, 5);
      });
      y += 3;
    });

    // Mão de Obra
    doc.addPage(); y = 20;
    addTitle('Mão de Obra'); addSep();
    Storage.getAll('profissionais').forEach(p => {
      const totalPago = Storage.getTotalPagamentos({ profissionalId: p.id });
      addSubtitle(`${p.nome} (${p.especialidade || ''})`);
      addLine(`Tipo: ${p.tipoCobranca} | Combinado: ${Fmt.moeda(p.valor)} | Pago: ${Fmt.moeda(totalPago)}`, 5);
      Storage.getAll('pagamentos').filter(pg => pg.profissionalId === p.id).forEach(pg => {
        addLine(`${Fmt.data(pg.data)} - ${Fmt.moeda(pg.valor)} - ${pg.descricao || ''}`, 10);
      });
      y += 3;
    });

    // Cronograma
    doc.addPage(); y = 20;
    addTitle('Cronograma'); addSep();
    comodos.forEach(c => {
      const tarefasComodo = tarefas.filter(t => t.comodo === c);
      if (tarefasComodo.length === 0) return;
      addSubtitle(nomes[c] || c);
      tarefasComodo.forEach(t => {
        const icon = t.status === 'concluido' ? '[X]' : t.status === 'atrasado' ? '[!]' : '[ ]';
        addLine(`${icon} ${t.descricao} - ${t.status} ${t.dataInicio ? '(' + Fmt.data(t.dataInicio) + ' a ' + Fmt.data(t.dataFim) + ')' : ''}`, 5);
      });
      y += 3;
    });

    // Compartilhar via Web Share API ou fallback para download
    const blob = doc.output('blob');
    const fileName = `relatorio-reforma-${Fmt.hoje()}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: 'Relatório da Reforma', files: [file] });
        Toast.show('Relatório compartilhado!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          doc.save(fileName);
          Toast.show('PDF baixado. Envie pelo WhatsApp manualmente.');
        }
      }
    } else {
      doc.save(fileName);
      Toast.show('PDF baixado. Envie pelo WhatsApp manualmente.');
    }

    WhatsApp.fecharOpcoes();
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
