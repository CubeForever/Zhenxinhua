// 真心话 - 前端主逻辑

// API 基础路径
const API_BASE = '/api';

// 全局状态
const state = {
  isLoggedIn: false,
  currentQuestion: null,
  isOldUser: false
};

// DOM 元素
const elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  bindEvents();
  checkLoginStatus();
});

// 初始化 DOM 元素引用
function initElements() {
  elements.authPage = document.getElementById('auth-page');
  elements.mainPage = document.getElementById('main-page');
  elements.enterBtn = document.getElementById('enter-btn');
  elements.logoutBtn = document.getElementById('logout-btn');
  elements.questionText = document.getElementById('question-text');
  elements.questionBadge = document.getElementById('question-badge');
  elements.nextQuestionBtn = document.getElementById('next-question-btn');
  elements.answerInput = document.getElementById('answer-input');
  elements.submitAnswerBtn = document.getElementById('submit-answer-btn');
  elements.newQuestionInput = document.getElementById('new-question-input');
  elements.submitQuestionBtn = document.getElementById('submit-question-btn');
  elements.myAnswersList = document.getElementById('my-answers-list');
  elements.toast = document.getElementById('toast');
}

// 绑定事件
function bindEvents() {
  elements.enterBtn.addEventListener('click', handleEnter);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.nextQuestionBtn.addEventListener('click', loadRandomQuestion);
  elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
  elements.submitQuestionBtn.addEventListener('click', handleSubmitQuestion);
}

// 检查登录状态
async function checkLoginStatus() {
  try {
    const res = await fetch(`${API_BASE}/auth/status`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.success && data.data.isLoggedIn) {
      state.isLoggedIn = true;
      showMainPage();
      loadRandomQuestion();
      loadMyAnswers();
    } else {
      showAuthPage();
    }
  } catch (error) {
    console.error('Check login status error:', error);
    showAuthPage();
  }
}

// 处理进入按钮
async function handleEnter() {
  // 生成访客 ID
  let visitorId = localStorage.getItem('visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('visitor_id', visitorId);
  }
  
  try {
    const res = await fetch(`${API_BASE}/auth/visitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.isLoggedIn = true;
      showToast('欢迎回来！', 'success');
      showMainPage();
      loadRandomQuestion();
      loadMyAnswers();
    } else {
      showToast(data.message || '进入失败', 'error');
    }
  } catch (error) {
    console.error('Enter error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 处理退出
function handleLogout() {
  state.isLoggedIn = false;
  state.currentQuestion = null;
  localStorage.removeItem('visitor_id');
  showAuthPage();
  showToast('已退出', 'success');
}

// 显示登录页
function showAuthPage() {
  elements.authPage.classList.remove('hidden');
  elements.mainPage.classList.add('hidden');
}

// 显示主页面
function showMainPage() {
  elements.authPage.classList.add('hidden');
  elements.mainPage.classList.remove('hidden');
}

// 加载随机问题
async function loadRandomQuestion() {
  try {
    elements.questionText.textContent = '加载中...';
    
    const res = await fetch(`${API_BASE}/questions/random`, {
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.currentQuestion = data.data.question;
      state.isOldUser = data.data.isOldUser;
      
      elements.questionText.textContent = state.currentQuestion.content;
      elements.questionBadge.textContent = state.currentQuestion.type === 'system' ? '系统问题' : '用户问题';
      elements.questionBadge.className = 'question-badge ' + state.currentQuestion.type;
    } else {
      elements.questionText.textContent = data.message || '获取问题失败';
    }
  } catch (error) {
    console.error('Load question error:', error);
    elements.questionText.textContent = '网络错误，请重试';
  }
}

// 提交回答
async function handleSubmitAnswer() {
  const answer = elements.answerInput.value.trim();
  
  if (!answer) {
    showToast('请输入回答内容', 'error');
    return;
  }
  
  if (!state.currentQuestion) {
    showToast('请先获取问题', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/answers/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: state.currentQuestion._id,
        answer
      }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('回答提交成功！', 'success');
      elements.answerInput.value = '';
      loadMyAnswers();
    } else {
      showToast(data.message || '提交失败', 'error');
    }
  } catch (error) {
    console.error('Submit answer error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 提交新问题
async function handleSubmitQuestion() {
  const content = elements.newQuestionInput.value.trim();
  
  if (!content || content.length < 5) {
    showToast('问题内容至少5个字符', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/questions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('问题提交成功，等待审核', 'success');
      elements.newQuestionInput.value = '';
    } else {
      showToast(data.message || '提交失败', 'error');
    }
  } catch (error) {
    console.error('Submit question error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 加载我的回答
async function loadMyAnswers() {
  try {
    const res = await fetch(`${API_BASE}/answers/my`, {
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      renderMyAnswers(data.data.answers);
    }
  } catch (error) {
    console.error('Load my answers error:', error);
  }
}

// 渲染我的回答
function renderMyAnswers(answers) {
  if (!answers || answers.length === 0) {
    elements.myAnswersList.innerHTML = '<p class="empty">暂无回答</p>';
    return;
  }
  
  elements.myAnswersList.innerHTML = answers.map(answer => `
    <div class="answer-item">
      <div class="question">${escapeHtml(answer.questionContent)}</div>
      <div class="answer">${escapeHtml(answer.answer)}</div>
      <div class="time">${formatTime(answer.createdAt)}</div>
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
