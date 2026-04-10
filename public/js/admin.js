// 真心话 - 后台管理

const API_BASE = '/api';

// DOM 元素
const elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  bindEvents();
  checkAdminStatus();
});

function initElements() {
  elements.loginPage = document.getElementById('admin-login-page');
  elements.dashboardPage = document.getElementById('admin-dashboard-page');
  elements.loginForm = document.getElementById('admin-login-form');
  elements.usernameInput = document.getElementById('admin-username');
  elements.passwordInput = document.getElementById('admin-password');
  elements.logoutBtn = document.getElementById('admin-logout-btn');
  elements.pendingQuestionsList = document.getElementById('pending-questions-list');
  elements.allAnswersList = document.getElementById('all-answers-list');
  elements.statsContainer = document.getElementById('admin-stats');
  elements.toast = document.getElementById('toast');
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutBtn.addEventListener('click', handleLogout);
}

// 检查管理员登录状态
async function checkAdminStatus() {
  try {
    const res = await fetch(`${API_BASE}/admin/status`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success && data.data.isAdmin) {
      showDashboard();
      loadDashboardData();
    } else {
      showLoginPage();
    }
  } catch (error) {
    console.error('Check admin status error:', error);
    showLoginPage();
  }
}

// 处理登录
async function handleLogin(e) {
  e.preventDefault();
  
  const username = elements.usernameInput.value.trim();
  const password = elements.passwordInput.value;
  
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('登录成功', 'success');
      showDashboard();
      loadDashboardData();
    } else {
      showToast(data.message || '登录失败', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 处理退出
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  showLoginPage();
  elements.usernameInput.value = '';
  elements.passwordInput.value = '';
  showToast('已退出', 'success');
}

// 显示登录页
function showLoginPage() {
  elements.loginPage.classList.remove('hidden');
  elements.dashboardPage.classList.add('hidden');
}

// 显示管理面板
function showDashboard() {
  elements.loginPage.classList.add('hidden');
  elements.dashboardPage.classList.remove('hidden');
}

// 加载面板数据
async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadPendingQuestions(),
    loadAllAnswers()
  ]);
}

// 加载统计数据
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      elements.statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${data.data.totalQuestions}</div>
          <div class="stat-label">总问题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.data.pendingQuestions}</div>
          <div class="stat-label">待审核</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.data.totalAnswers}</div>
          <div class="stat-label">总回答数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.data.totalVisitors}</div>
          <div class="stat-label">访客数</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

// 加载待审核问题
async function loadPendingQuestions() {
  try {
    const res = await fetch(`${API_BASE}/admin/questions/pending`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      renderPendingQuestions(data.data.questions);
    }
  } catch (error) {
    console.error('Load pending questions error:', error);
  }
}

// 渲染待审核问题
function renderPendingQuestions(questions) {
  if (!questions || questions.length === 0) {
    elements.pendingQuestionsList.innerHTML = '<p class="empty">暂无待审核问题</p>';
    return;
  }
  
  elements.pendingQuestionsList.innerHTML = questions.map(q => `
    <div class="admin-item" data-id="${q._id}">
      <div class="item-content">${escapeHtml(q.content)}</div>
      <div class="item-meta">提交时间: ${formatTime(q.createdAt)}</div>
      <div class="item-actions">
        <button class="btn btn-small btn-success" onclick="approveQuestion('${q._id}')">通过</button>
        <button class="btn btn-small btn-danger" onclick="rejectQuestion('${q._id}')">拒绝</button>
      </div>
    </div>
  `).join('');
}

// 审核通过
async function approveQuestion(id) {
  await reviewQuestion(id, 'approved');
}

// 审核拒绝
async function rejectQuestion(id) {
  await reviewQuestion(id, 'rejected');
}

// 审核问题
async function reviewQuestion(id, status) {
  try {
    const res = await fetch(`${API_BASE}/admin/questions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast(status === 'approved' ? '已通过' : '已拒绝', 'success');
      loadPendingQuestions();
      loadStats();
    } else {
      showToast(data.message || '操作失败', 'error');
    }
  } catch (error) {
    console.error('Review question error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 加载所有回答
async function loadAllAnswers() {
  try {
    const res = await fetch(`${API_BASE}/admin/answers`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success) {
      renderAllAnswers(data.data.answers);
    }
  } catch (error) {
    console.error('Load all answers error:', error);
  }
}

// 渲染所有回答
function renderAllAnswers(answers) {
  if (!answers || answers.length === 0) {
    elements.allAnswersList.innerHTML = '<p class="empty">暂无回答</p>';
    return;
  }
  
  elements.allAnswersList.innerHTML = answers.slice(0, 50).map(a => `
    <div class="admin-item">
      <div class="item-question">${escapeHtml(a.questionContent)}</div>
      <div class="item-content">${escapeHtml(a.answer)}</div>
      <div class="item-meta">回答时间: ${formatTime(a.createdAt)}</div>
    </div>
  `).join('');
}

// 显示提示
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// 转义 HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 格式化时间
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
