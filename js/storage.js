// Sistema de armazenamento local
class LocalStorageDB {
  constructor() {
    this.dbName = 'controle-loja';
    this.init();
  }
  
  init() {
    // Estrutura inicial do banco
    const defaultData = {
      version: '1.0',
      config: {
        user: 'admin',
        passwordHash: this.hashPassword('senha123'),
        createdAt: new Date().toISOString()
      },
      produtos: [],
      movimentacoes: [],
      lastSync: null
    };
    
    // Carrega ou cria dados
    const saved = localStorage.getItem(this.dbName);
    if (!saved) {
      localStorage.setItem(this.dbName, JSON.stringify(defaultData));
      this.data = defaultData;
    } else {
      try {
        this.data = JSON.parse(saved);
        // Migração se necessário
        if (!this.data.version) {
          this.data.version = '1.0';
          this.save();
        }
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
        localStorage.removeItem(this.dbName);
        this.data = defaultData;
        this.save();
      }
    }
  }
  
  // Salvar dados
  save() {
    try {
      localStorage.setItem(this.dbName, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error('Erro ao salvar:', e);
      return false;
    }
  }
  
  // Hash de senha simples (para produção, use crypto.subtle)
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  // Autenticação
  login(username, password) {
    const hash = this.hashPassword(password);
    if (this.data.config.user === username && 
        this.data.config.passwordHash === hash) {
      this.data.config.lastLogin = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }
  
  // Mudar senha
  changePassword(oldPassword, newPassword) {
    if (this.hashPassword(oldPassword) !== this.data.config.passwordHash) {
      return { success: false, error: 'Senha atual incorreta' };
    }
    
    this.data.config.passwordHash = this.hashPassword(newPassword);
    this.data.config.updatedAt = new Date().toISOString();
    const result = this.save();
    return { success: result, message: result ? 'Senha alterada' : 'Erro ao salvar' };
  }
  
  // Produtos
  getProdutos() {
    return this.data.produtos || [];
  }
  
  addProduto(produto) {
    const id = generateId();
    const newProduto = {
      id,
      ...produto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.data.produtos.unshift(newProduto);
    return this.save() ? newProduto : null;
  }
  
  updateProduto(id, updates) {
    const index = this.data.produtos.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    this.data.produtos[index] = { 
      ...this.data.produtos[index], 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    return this.save();
  }
  
  deleteProduto(id) {
    this.data.produtos = this.data.produtos.filter(p => p.id !== id);
    // Remove movimentações relacionadas
    this.data.movimentacoes = this.data.movimentacoes.filter(m => m.produtoId !== id);
    return this.save();
  }
  
  // Movimentações
  getMovimentacoes(options = {}) {
    let movimentacoes = [...(this.data.movimentacoes || [])];
    
    // Filtros
    if (options.canal && options.canal !== 'todos') {
      movimentacoes = movimentacoes.filter(m => m.canal === options.canal);
    }
    
    if (options.periodo) {
      const now = new Date();
      const startDate = getPeriodStart(now, options.periodo);
      movimentacoes = movimentacoes.filter(m => new Date(m.data) >= startDate);
    }
    
    if (options.dataInicio) {
      movimentacoes = movimentacoes.filter(m => new Date(m.data) >= new Date(options.dataInicio));
    }
    
    if (options.dataFim) {
      movimentacoes = movimentacoes.filter(m => new Date(m.data) <= new Date(options.dataFim));
    }
    
    // Ordenar por data (mais recente primeiro)
    movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    return movimentacoes;
  }
  
  addMovimentacao(movimentacao) {
    // Verificar estoque se for saída
    if (movimentacao.tipo === 'saida') {
      const produto = this.data.produtos.find(p => p.id === movimentacao.produtoId);
      if (!produto || produto.estoque < movimentacao.quantidade) {
        return { success: false, error: 'Estoque insuficiente' };
      }
    }
    
    const id = generateId();
    const newMov = {
      id,
      ...movimentacao,
      data: movimentacao.data || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    this.data.movimentacoes.unshift(newMov);
    
    // Atualizar estoque
    if (newMov.tipo === 'saida') {
      const produtoIndex = this.data.produtos.findIndex(p => p.id === newMov.produtoId);
      if (produtoIndex !== -1) {
        this.data.produtos[produtoIndex].estoque -= newMov.quantidade;
        this.data.produtos[produtoIndex].updatedAt = new Date().toISOString();
      }
    } else {
      const produtoIndex = this.data.produtos.findIndex(p => p.id === newMov.produtoId);
      if (produtoIndex !== -1) {
        this.data.produtos[produtoIndex].estoque += newMov.quantidade;
        this.data.produtos[produtoIndex].updatedAt = new Date().toISOString();
      }
    }
    
    return this.save() ? newMov : null;
  }
  
  // Estatísticas
  getStats() {
    const movimentacoes = this.getMovimentacoes();
    const produtos = this.getProdutos();
    
    const vendas = movimentacoes.filter(m => m.tipo === 'saida');
    const totalVendas = vendas.reduce((sum, m) => {
      const produto = produtos.find(p => p.id === m.produtoId);
      return sum + (produto ? produto.preco_venda * m.quantidade : 0);
    }, 0);
    
    const totalLucro = vendas.reduce((sum, m) => {
      const produto = produtos.find(p => p.id === m.produtoId);
      return sum + (produto ? (produto.preco_venda - produto.preco_custo) * m.quantidade : 0);
    }, 0);
    
    const totalEstoque = produtos.reduce((sum, p) => sum + p.estoque, 0);
    
    return {
      totalVendas: vendas.length,
      totalLucro,
      totalProdutos: produtos.length,
      totalEstoque,
      movimentacoesCount: movimentacoes.length
    };
  }
  
  // Backup
  exportData(format = 'csv') {
    const data = {
      config: this.data.config,
      produtos: this.data.produtos,
      movimentacoes: this.data.movimentacoes,
      exportedAt: new Date().toISOString()
    };
    
    if (format === 'csv') {
      return this.exportToCSV(data);
    } else {
      return this.exportToJSON(data);
    }
  }
  
  exportToCSV(data) {
    let csv = 'Tipo,Dados\n';
    
    // Produtos
    csv += 'PRODUTO,' + data.produtos.map(p => 
      `${p.nome}|${p.preco_custo}|${p.preco_venda}|${p.estoque}|${p.createdAt}`
    ).join(';') + '\n';
    
    // Movimentações
    csv += 'MOVIMENTACAO,' + data.movimentacoes.map(m => 
      `${m.produtoId}|${m.tipo}|${m.quantidade}|${m.data}|${m.canal}|${m.createdAt}`
    ).join(';') + '\n';
    
    return csv;
  }
  
  exportToJSON(data) {
    return JSON.stringify(data, null, 2);
  }
  
  // Importar
  importData(fileContent, format = 'json') {
    try {
      let importedData;
      
      if (format === 'csv') {
        importedData = this.parseCSV(fileContent);
      } else {
        importedData = JSON.parse(fileContent);
      }
      
      // Validação básica
      if (!importedData.produtos || !importedData.movimentacoes) {
        return { success: false, error: 'Formato inválido' };
      }
      
      // Merge com dados existentes
      this.data.produtos = [...this.data.produtos, ...importedData.produtos];
      this.data.movimentacoes = [...this.data.movimentacoes, ...importedData.movimentacoes];
      
      // Remover duplicatas
      this.data.produtos = this.data.produtos.filter((p, index, self) => 
        index === self.findIndex(p2 => p2.id === p.id)
      );
      this.data.movimentacoes = this.data.movimentacoes.filter((m, index, self) => 
        index === self.findIndex(m2 => m2.id === m.id)
      );
      
      this.data.lastImport = new Date().toISOString();
      return { success: this.save(), message: 'Dados importados com sucesso' };
    } catch (e) {
      return { success: false, error: 'Erro ao importar: ' + e.message };
    }
  }
  
  parseCSV(csvContent) {
    // Parser simples para CSV customizado
    const lines = csvContent.split('\n');
    const data = { produtos: [], movimentacoes: [] };
    
    lines.forEach(line => {
      if (line.startsWith('PRODUTO,')) {
        const produtosStr = line.split(',')[1];
        if (produtosStr) {
          produtosStr.split(';').forEach(prodStr => {
            const [nome, custo, venda, estoque, createdAt] = prodStr.split('|');
            if (nome) {
              data.produtos.push({
                id: generateId(),
                nome,
                preco_custo: parseFloat(custo),
                preco_venda: parseFloat(venda),
                estoque: parseInt(estoque),
                createdAt: createdAt || new Date().toISOString()
              });
            }
          });
        }
      } else if (line.startsWith('MOVIMENTACAO,')) {
        const movsStr = line.split(',')[1];
        if (movsStr) {
          movsStr.split(';').forEach(movStr => {
            const [produtoId, tipo, quantidade, data, canal, createdAt] = movStr.split('|');
            if (produtoId) {
              data.movimentacoes.push({
                id: generateId(),
                produtoId,
                tipo,
                quantidade: parseInt(quantidade),
                data: data || new Date().toISOString(),
                canal,
                createdAt: createdAt || new Date().toISOString()
              });
            }
          });
        }
      }
    });
    
    return data;
  }
  
  // Limpeza
  clearAll() {
    localStorage.removeItem(this.dbName);
    this.init();
    return true;
  }
  
  // Função auxiliar para períodos
  getPeriodStart(date, period) {
    const d = new Date(date);
    switch (period) {
      case 'dia':
        d.setHours(0, 0, 0, 0);
        return d;
      case 'semana':
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
      case 'mes':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      default:
        return new Date(0);
    }
  }
}

// Inicializar banco
const db = new LocalStorageDB();