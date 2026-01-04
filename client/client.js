// API 기본 설정
const API_BASE = 'http://localhost:3006';

// 토큰 저장소
let currentUser = null;
let accessToken = null;
let refreshToken = null;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadStoredAuth();
    if (accessToken) {
        showMainSection();
    }
});

// ================================
// 인증 관리
// ================================

function loadStoredAuth() {
    accessToken = localStorage.getItem('accessToken');
    refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        currentUser = JSON.parse(userStr);
    }
}

function saveAuth(user, access, refresh) {
    currentUser = user;
    accessToken = access;
    refreshToken = refresh;
    
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
}

function clearAuth() {
    currentUser = null;
    accessToken = null;
    refreshToken = null;
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
}

// ================================
// HTTP 요청 헬퍼
// ================================

async function apiRequest(url, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (accessToken && !options.skipAuth) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
        let response = await fetch(`${API_BASE}${url}`, config);
        
        // 토큰 만료 시 자동 갱신
        if (response.status === 401 && refreshToken && !options.skipRefresh) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                config.headers.Authorization = `Bearer ${accessToken}`;
                response = await fetch(`${API_BASE}${url}`, config);
            }
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API 요청 실패');
        }
        
        return data;
    } catch (error) {
        showAlert(error.message, 'error');
        throw error;
    }
}

async function refreshAccessToken() {
    try {
        const response = await apiRequest('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
            skipAuth: true,
            skipRefresh: true
        });
        
        accessToken = response.accessToken;
        refreshToken = response.refreshToken;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        return true;
    } catch (error) {
        showAlert('세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        logout();
        return false;
    }
}

// ================================
// 폼 전환
// ================================

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    
    // 탭 활성화
    const tabs = document.querySelectorAll('.auth-section .tab');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    
    // 탭 활성화
    const tabs = document.querySelectorAll('.auth-section .tab');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
}

function fillAdminCredentials() {
    document.getElementById('loginEmail').value = 'admin@test.com';
    document.getElementById('loginPassword').value = 'admin123';
}

// ================================
// 인증 API
// ================================

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        setLoading(true);
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuth: true
        });
        
        saveAuth(response.user, response.accessToken, response.refreshToken);
        showAlert('로그인 성공!', 'success');
        showMainSection();
        
    } catch (error) {
        console.error('로그인 실패:', error);
    } finally {
        setLoading(false);
    }
}

async function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        setLoading(true);
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
            skipAuth: true
        });
        
        saveAuth(response.user, response.accessToken, response.refreshToken);
        showAlert('회원가입 및 로그인 완료!', 'success');
        showMainSection();
        
    } catch (error) {
        console.error('회원가입 실패:', error);
    } finally {
        setLoading(false);
    }
}

function logout() {
    clearAuth();
    showAuthSection();
    showAlert('로그아웃되었습니다.', 'success');
}

// ================================
// 섹션 전환
// ================================

function showAuthSection() {
    document.getElementById('authSection').classList.add('active');
    document.getElementById('mainSection').classList.remove('active');
    
    // 폼 초기화
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
}

async function showMainSection() {
    document.getElementById('authSection').classList.remove('active');
    document.getElementById('mainSection').classList.add('active');
    
    // 사용자 정보 표시
    displayUserInfo();
    
    // 관리자인 경우 관리자 탭 표시
    if (currentUser.role === 'ADMIN') {
        document.getElementById('adminTab').style.display = 'block';
    }
    
    // Todo 목록 로드
    await loadTodos();
}

function showTodoTab() {
    document.getElementById('todoTab').style.display = 'block';
    document.getElementById('adminTabContent').style.display = 'none';
    
    // 탭 활성화
    const tabs = document.querySelectorAll('.main-section .tab');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
}

async function showAdminTab() {
    document.getElementById('todoTab').style.display = 'none';
    document.getElementById('adminTabContent').style.display = 'block';
    
    // 탭 활성화
    const tabs = document.querySelectorAll('.main-section .tab');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
    
    await loadUsers();
}

// ================================
// 사용자 정보 표시
// ================================

function displayUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const roleClass = currentUser.role === 'ADMIN' ? 'admin-badge' : 'user-badge';
    
    userInfo.innerHTML = `
        <h3>👤 ${currentUser.name}</h3>
        <p>📧 ${currentUser.email}</p>
        <p>🎯 역할: <span class="${roleClass}">${currentUser.role}</span></p>
        <p>🆔 ID: ${currentUser.id}</p>
    `;
}

// ================================
// Todo 관리
// ================================

async function loadTodos() {
    try {
        const response = await apiRequest('/todos');
        displayTodos(response.todos);
    } catch (error) {
        console.error('Todo 로드 실패:', error);
    }
}

function displayTodos(todos) {
    const todoList = document.getElementById('todoList');
    
    if (todos.length === 0) {
        todoList.innerHTML = '<p>할 일이 없습니다.</p>';
        return;
    }
    
    todoList.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.completed ? 'todo-completed' : ''}">
            <div class="todo-content">
                <h4>${todo.task}</h4>
                <small>
                    ${todo.completed ? '✅ 완료됨' : '⏳ 진행중'} | 
                    ${new Date(todo.createdAt).toLocaleString()}
                    ${todo.owner_name ? ` | 작성자: ${todo.owner_name}` : ''}
                </small>
            </div>
            <div class="todo-actions">
                <button class="btn" onclick="toggleTodo(${todo.id}, ${!todo.completed})">
                    ${todo.completed ? '되돌리기' : '완료'}
                </button>
                <button class="btn btn-danger" onclick="deleteTodo(${todo.id})">삭제</button>
            </div>
        </div>
    `).join('');
}

async function createTodo() {
    const task = document.getElementById('newTask').value.trim();
    
    if (!task) {
        showAlert('할 일을 입력해주세요.', 'error');
        return;
    }
    
    try {
        await apiRequest('/todos', {
            method: 'POST',
            body: JSON.stringify({ task })
        });
        
        document.getElementById('newTask').value = '';
        showAlert('할 일이 추가되었습니다.', 'success');
        await loadTodos();
        
    } catch (error) {
        console.error('Todo 생성 실패:', error);
    }
}

async function toggleTodo(id, completed) {
    try {
        await apiRequest(`/todos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ completed })
        });
        
        showAlert('할 일 상태가 업데이트되었습니다.', 'success');
        await loadTodos();
        
    } catch (error) {
        console.error('Todo 업데이트 실패:', error);
    }
}

async function deleteTodo(id) {
    if (!confirm('정말 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        await apiRequest(`/todos/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('할 일이 삭제되었습니다.', 'success');
        await loadTodos();
        
    } catch (error) {
        console.error('Todo 삭제 실패:', error);
    }
}

// ================================
// 관리자 기능
// ================================

async function loadUsers() {
    try {
        const response = await apiRequest('/admin/users');
        displayUsers(response.users);
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
    }
}

function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    
    usersList.innerHTML = `
        <h3>👥 전체 사용자 목록</h3>
        <div style="margin-top: 20px;">
            ${users.map(user => {
                const roleClass = user.role === 'ADMIN' ? 'admin-badge' : 'user-badge';
                return `
                    <div class="todo-item">
                        <div class="todo-content">
                            <h4>${user.name}</h4>
                            <p>📧 ${user.email}</p>
                            <small>
                                🎯 <span class="${roleClass}">${user.role}</span> | 
                                가입일: ${new Date(user.createdAt).toLocaleDateString()}
                            </small>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ================================
// UI 헬퍼
// ================================

function showAlert(message, type = 'success') {
    const alertArea = document.getElementById('alertArea');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert ${alertClass}`;
    alertElement.textContent = message;
    
    alertArea.appendChild(alertElement);
    
    setTimeout(() => {
        alertElement.remove();
    }, 5000);
}

function setLoading(loading) {
    const container = document.querySelector('.container');
    if (loading) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}