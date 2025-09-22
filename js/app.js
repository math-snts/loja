// App principal
let currentUser = null;
let isAuthenticated = false;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  // Verificar autenticação salva
  const savedUser = localStorage.getItem('controle-loja-user');
  if (savedUser) {
    try {
      const userData = JSON.parse(savedUser);
      if (db.login(userData.username, userData.password)) {
        isAuthenticated = true;
        currentUser = userData;
        showApp();
        loadAllData();
        showSuccess('Bem-vindo de volta!');
      }
    } catch (e) {
      localStorage.removeItem('controle-loja-user');
    }
  }
  
  // Listeners
  setupEventListeners();
  
  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }
});

function setupEventListeners() {
  // Filtro de período
  document.getElementById('filtro-periodo').addEventListener('change', function() {
    const value = this.value;
    const dataInput = document.getElementById('filtro-data');
    const label = document.getElementById('data-label');
    
    if (value && value !== '') {
      document.getElementById('filtro-data').style.display = 'block';
      if (value === 'dia') {
        label.textContent = 'Data';
        dataInput.type = 'date';
      } else if (value === 'semana') {
        label.textContent = 'Semana de';
        dataInput.type = 'date';
      } else if (value === 'mes') {
        label.textContent = 'Mês';
        dataInput.type = 'month';
      }
    } else {
      document.getElementById('filtro-data').style.display = 'none';
    }
  });
  
  // Enter no login
  document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !isAuthenticated) {
      login();
    }
  });
}

// Login
function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');
  
  if (!username || !password) {
    showError('Preencha usuário e senha');
    return;
  }
  
  if (db.login(username, password)) {
    isAuthenticated = true;
    currentUser = { username, password };
    
    // Salvar sessão
    localStorage.setItem('controle-loja-user', JSON.stringify(currentUser));
    
    showApp();
    loadAllData();
    showSuccess(`Bem-vindo, ${username}!`);
  } else {
    showError('Credenciais inválidas');
    document.getElementById('password').value = '';
  }
}

// Logout
function logout() {
  if (confirm('Deseja realmente sair?')) {
    isAuthenticated = false;
    currentUser = null;
    localStorage.removeItem('controle-loja-user');
    showLogin();
  }
}

// Mostrar app
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-info').textContent = currentUser.username;
}

// Mostrar login
function showLogin() {
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// Carregar todos os dados
async function loadAllData() {
  loadProdutos();
  loadDashboard();
  updateStats();
}

// Produtos
function loadProdutos() {
  const produtos = db.getProdutos();
  const tbody = document.getElementById('produtos-table');
  
  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum produto cadastrado. Adicione o primeiro!</td></tr>';
    return;
  }
  
  tbody.innerHTML = produtos.map(produto => `
    <tr>
      <td>${escapeHtml(produto.nome)}</td>
      <td>${formatCurrency(produto.preco_custo)}</td>
      <td>${formatCurrency(produto.preco_venda)}</td>
      <td>
        <span class="badge ${produto.estoque <= 5 ? 'bg-warning' : 'bg-success'}">
          ${produto.estoque}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="editProduto('${produto.id}')">Editar</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduto('${produto.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
  
  // Atualizar select de movimentações
  updateMovimentoSelect();
}

function addProduto() {
  const nome = document.getElementById('produto-nome').value.trim();
  const custo = parseFloat(document.getElementById('produto-custo').value);
  const venda = parseFloat(document.getElementById('produto-venda').value);
  const estoque = parseInt(document.getElementById('produto-estoque').value) || 0;
  
  if (!nome || isNaN(custo) || isNaN(venda) || custo < 0 || venda < 0) {
    showError('Preencha todos os campos corretamente');
    return;
  }
  
  if (custo >= venda) {
    showError('Preço de venda deve ser maior que o custo');
    return;
  }
  
  const produto = db.addProduto({ nome, preco_custo: custo, preco_venda: venda, estoque });
  
  if (produto) {
    showSuccess('Produto adicionado com sucesso!');
    clearProdutoForm();
    loadProdutos();
    loadDashboard();
  } else {
    showError('Erro ao salvar produto');
  }
}

function clearProdutoForm() {
  document.getElementById('produto-nome').value = '';
  document.getElementById('produto-custo').value = '';
  document.getElementById('produto-venda').value = '';
  document.getElementById('produto-estoque').value = '';
}

function editProduto(id) {
  const produto = db.getProdutos().find(p => p.id === id);
  if (!produto) return;
  
  document.getElementById('produto-nome').value = produto.nome;
  document.getElementById('produto-custo').value = produto.preco_custo;
  document.getElementById('produto-venda').value = produto.preco_venda;
  document.getElementById('produto-estoque').value = produto.estoque;
  
  // Scroll para o form
  document.querySelector('#produtos input').scrollIntoView({ behavior: 'smooth' });
}

function deleteProduto(id) {
  if (confirm('Tem certeza que deseja excluir este produto? Todas as movimentações relacionadas também serão removidas.')) {
    db.deleteProduto(id);
    loadProdutos();
    loadDashboard();
    showSuccess('Produto excluído');
  }
}

function updateMovimentoSelect() {
  const select = document.getElementById('mov-produto');
  const produtos = db.getProdutos();
  
  select.innerHTML = '<option value="">Selecione um produto...</option>';
  
  produtos.forEach(produto => {
    const option = document.createElement('option');
    option.value = produto.id;
    option.textContent = `${produto.nome} (Estoque: ${produto.estoque})`;
    select.appendChild(option);
  });
}

// Movimentações
function addMovimentacao() {
  const produtoId = document.getElementById('mov-produto').value;
  const tipo = document.getElementById('mov-tipo').value;
  const quantidade = parseInt(document.getElementById('mov-quantidade').value);
  const canal = document.getElementById('mov-canal').value;
  const dataInput = document.getElementById('mov-data').value;
  
  if (!produtoId || !quantidade || quantidade <= 0) {
    showError('Selecione um produto e quantidade válida');
    return;
  }
  
  const data = dataInput ? `${dataInput}T12:00:00` : new Date().toISOString();
  
  const movimentacao = db.addMovimentacao({
    produtoId,
    tipo,
    quantidade,
    canal,
    data
  });
  
  if (movimentacao && movimentacao.success !== false) {
    showSuccess(`Movimentação registrada: ${quantidade}x ${tipo === 'saida' ? 'vendido' : 'adicionado'}`);
    document.getElementById('mov-quantidade').value = '1';
    document.getElementById('mov-data').value = '';
    loadDashboard();
    updateMovimentoSelect();
  } else {
    showError(movimentacao?.error || 'Erro ao registrar movimentação');
  }
}

// Dashboard
function loadDashboard() {
  const canal = document.getElementById('filtro-canal').value;
  const periodo = document.getElementById('filtro-periodo').value;
  const dataInput = document.getElementById('filtro-data').value;
  
  let options = { canal };
  
  if (periodo && dataInput) {
    if (periodo === 'dia') {
      options.dataInicio = dataInput;
      options.dataFim = dataInput;
    } else if (periodo === 'semana') {
      // Implementar lógica de semana
      options.dataInicio = dataInput;
    }
  }
  
  const movimentacoes = db.getMovimentacoes(options);
  const produtos = db.getProdutos();
  const tbody = document.getElementById('dashboard-table');
  
  if (movimentacoes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhuma movimentação encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = movimentacoes.slice(0, 50).map(mov => {
    const produto = produtos.find(p => p.id === mov.produtoId);
    if (!produto) return '';
    
    const valor = mov.tipo === 'saida' ? formatCurrency(produto.preco_venda * mov.quantidade) : '-';
    const lucro = mov.tipo === 'saida' ? formatCurrency((produto.preco_venda - produto.preco_custo) * mov.quantidade) : '-';
    const tipoIcon = mov.tipo === 'saida' ? '📤' : '📥';
    const canalIcon = mov.canal === 'online' ? '🛒' : '🏪';
    
    return `
      <tr>
        <td>${formatDate(mov.data)}</td>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${tipoIcon} ${mov.tipo === 'saida' ? 'Saída' : 'Entrada'}</td>
        <td>${mov.quantidade}</td>
        <td>${canalIcon} ${mov.canal === 'online' ? 'Online' : 'Física'}</td>
        <td class="fw-bold">${valor}</td>
        <td class="text-success fw-bold">${lucro}</td>
      </tr>
    `;
  }).join('');
}

function updateStats() {
  const stats = db.getStats();
  
  document.getElementById('total-vendas').textContent = stats.totalVendas;
  document.getElementById('total-lucro').textContent = formatCurrency(stats.totalLucro);
  document.getElementById('total-produtos').textContent = stats.totalProdutos;
  document.getElementById('total-estoque').textContent = stats.totalEstoque;
}

// Configurações
function resetUser() {
  if (confirm('Redefinir usuário para admin/senha123?')) {
    db.data.config.user = 'admin';
    db.data.config.passwordHash = db.hashPassword('senha123');
    db.save();
    showSuccess('Usuário redefinido');
  }
}

function exportData() {
  try {
    const csv = db.exportData('csv');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-loja-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Backup CSV baixado');
  } catch (e) {
    showError('Erro ao exportar: ' + e.message);
  }
}

function exportDataJSON() {
  try {
    const json = db.exportData('json');
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-loja-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Backup JSON baixado');
  } catch (e) {
    showError('Erro ao exportar: ' + e.message);
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const format = file.name.endsWith('.csv') ? 'csv' : 'json';
    
    const result = db.importData(content, format);
    
    if (result.success) {
      showSuccess(result.message);
      loadAllData();
      event.target.value = '';
    } else {
      showError(result.error);
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm('ATENÇÃO: Isso apagará TODOS os dados (produtos, movimentações, configurações). Deseja continuar?')) {
    if (confirm('TEM CERTEZA? Não há como desfazer esta ação.')) {
      db.clearAll();
      loadAllData();
      showLogin();
      showSuccess('Todos os dados foram limpos');
    }
  }
}

// Utilitários
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function getPeriodStart(date, period) {
  const d = new Date(date);
  switch (period) {
    case 'dia':
      d.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      break;
    case 'mes':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d;
}