// 환경변수 설정
const getEnvVar = (name, fallback = '') => {
    // 1. Vercel 배포 환경변수 확인 (프로덕션 환경)
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }
    
    // 2. 윈도우 환경변수 확인 (개발 환경)
    if (typeof window !== 'undefined') {
        // 2.1 window.env (env.js에서 로드된 환경변수)
        if (window.env && window.env[name]) {
            return window.env[name];
        }
        
        // 2.2 Vercel이 주입한 환경변수 (_env 또는 __NEXT_DATA__)
        if (window._env && window._env[name]) {
            return window._env[name];
        }
    }
    
    // 3. 기본값 반환
    return fallback;
};

// Supabase 설정 (환경변수 또는 전역 설정에서 로드)
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

// 환경변수 또는 전역 설정에서 Supabase 설정 로드 (우선순위 처리)
// 1. window.SUPABASE_CONFIG 확인 (임시 방식)
if (window.SUPABASE_CONFIG) {
    SUPABASE_URL = window.SUPABASE_CONFIG.url;
    SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
} 
// 2. Vercel 환경변수 확인
else {
    // Vercel에 설정된 값 (Vercel에서 배포된 경우 사용)
    SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://masylwzkikmbwlvfeucz.supabase.co');
    SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hc3lsd3praWttYndsdmZldWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDA3NjAsImV4cCI6MjA2NzAxNjc2MH0.sCFCHGUdwWoXUpZn5TSO1xKYU2D4sXw-davY6AJdEg4');
}

// Supabase 클라이언트 초기화
let supabase = null;
try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase 클라이언트 초기화 완료:', SUPABASE_URL);
    } else {
        console.warn('Supabase 환경변수가 설정되지 않았습니다. 데모 모드로 실행됩니다.');
    }
} catch (error) {
    console.error('Supabase 초기화 실패:', error);
    supabase = null;
}

// 전역 변수
let currentUser = null;
let currentWorkspace = null;
let currentProjects = [];
let currentTasks = [];
let currentComments = [];
let currentView = 'dashboard';
let currentFilter = 'all';
let currentProjectFilter = 'all'; // 프로젝트 필터 추가
let currentStatusFilter = 'all'; // 상태 필터 추가
let currentTaskId = null;
let currentEditingProject = null;
let currentDate = new Date();
let isDemoMode = false;
let isModalFullSize = false;
let calendarView = 'month'; // 'month', 'week', 'list'

// DOM 요소
const elements = {
    loading: document.getElementById('loadingOverlay'),
    loginScreen: document.getElementById('loginScreen'),
    mainApp: document.getElementById('app'),
    googleLogin: document.getElementById('googleLogin'),
    demoLogin: document.getElementById('demoLogin'),
    logoutBtn: document.getElementById('logoutBtn'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    
    // Navigation
    dashboardBtn: document.getElementById('dashboardBtn'),
    calendarBtn: document.getElementById('calendarBtn'),
    
    // Views
    dashboardView: document.getElementById('dashboardView'),
    calendarView: document.getElementById('calendarView'),
    
    // Quick Actions
    addTodoBtn: document.getElementById('addTodoBtn'),
    addProjectBtn: document.getElementById('addProjectBtn'),
    addFirstTodo: document.getElementById('addFirstTodo'),
    
    // Todo Modal
    todoModal: document.getElementById('todoModal'),
    closeModal: document.getElementById('closeModal'),
    
    // Todo Form Modal
    todoFormModal: document.getElementById('todoFormModal'),
    closeTodoFormModal: document.getElementById('closeTodoFormModal'),
    todoForm: document.getElementById('todoForm'),
    
    // Project Form Modal
    projectFormModal: document.getElementById('projectFormModal'),
    closeProjectFormModal: document.getElementById('closeProjectFormModal'),
    projectForm: document.getElementById('projectForm'),
    
    // Statistics
    totalTodos: document.getElementById('totalTodos'),
    inProgressTodos: document.getElementById('inProgressTodos'),
    completedTodos: document.getElementById('completedTodos'),
    pendingTodos: document.getElementById('pendingTodos'),
    
    // Lists
    todosList: document.getElementById('todosList'),
    projectsList: document.getElementById('projectsList'),
    
    // Calendar
    currentMonth: document.getElementById('currentMonth'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    calendar: document.getElementById('calendar'),
    
    // Demo indicator
    demoIndicator: document.getElementById('demoIndicator')
};

// 유틸리티 함수들
function showLoading() {
    if (elements.loading) {
        elements.loading.style.display = 'flex';
    }
}

function hideLoading() {
    if (elements.loading) {
        elements.loading.style.display = 'none';
    }
}

function showLoginScreen() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.remove('hidden');
    }
    if (elements.mainApp) {
        elements.mainApp.classList.add('hidden');
    }
}

function showMainApp() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.add('hidden');
    }
    if (elements.mainApp) {
        elements.mainApp.classList.remove('hidden');
    }
}

// 상태 변경 드롭다운 설정
function setupStatusChangeDropdown() {
    const statusElement = document.getElementById('taskDetailStatus');
    const dropdown = document.getElementById('statusDropdown');
    
    if (!statusElement || !dropdown) return;
    
    // 상태 요소 클릭 이벤트
    statusElement.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    });
    
    // 드롭다운 아이템 클릭 이벤트
    const dropdownItems = dropdown.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const newStatus = this.dataset.status;
            if (currentTaskId && newStatus) {
                changeTaskStatus(currentTaskId, newStatus);
            }
            
            dropdown.style.display = 'none';
        });
    });
    
    // 다른 곳 클릭 시 드롭다운 닫기
    document.addEventListener('click', function(e) {
        if (!statusElement.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// 할 일 상태 변경 함수
async function changeTaskStatus(taskId, newStatus) {
    try {
        if (isDemoMode) {
            // 데모 모드: 로컬 스토리지 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id == taskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = newStatus;
                currentTasks[taskIndex].updated_at = new Date().toISOString();
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
            }
        } else if (supabase) {
            // 실제 모드: Supabase 업데이트
            const { data, error } = await supabase
                .from('todos')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId)
                .select()
                .single();
                
            if (error) throw error;
            
            // 로컬 배열 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id == taskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex] = data;
            }
        }
        
        // UI 업데이트
        updateStatusElementStyle(newStatus);
        updateDashboard();
        updateTodosList();
        
        const statusNames = {
            'pending': '대기중',
            'in_progress': '진행중', 
            'completed': '완료'
        };
        
        showNotification(`할 일 상태가 "${statusNames[newStatus]}"로 변경되었습니다.`, 'success');
        
    } catch (error) {
        console.error('상태 변경 실패:', error);
        showNotification('상태 변경에 실패했습니다.', 'error');
    }
}

// 상태 요소 스타일 업데이트
function updateStatusElementStyle(status) {
    const statusElement = document.getElementById('taskDetailStatus');
    if (!statusElement) return;
    
    // 기존 클래스 제거
    statusElement.className = 'btn btn-sm status-clickable';
    
    // 새 상태에 따른 클래스와 텍스트 설정
    const statusConfig = {
        'pending': { class: 'btn-warning', text: '대기중' },
        'in_progress': { class: 'btn-info', text: '진행중' },
        'completed': { class: 'btn-success', text: '완료' }
    };
    
    const config = statusConfig[status] || statusConfig['pending'];
    statusElement.classList.add(config.class);
    statusElement.textContent = config.text;
}

// 대시보드 업데이트 함수
function updateDashboard() {
    updateDashboardStats();
    updateTodosList();
}

// 대시보드 통계 업데이트
function updateDashboardStats() {
    const totalTasks = currentTasks.length;
    const pendingTasks = currentTasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = currentTasks.filter(t => t.status === 'in_progress').length;
    const completedTasks = currentTasks.filter(t => t.status === 'completed').length;
    
    if (elements.totalTodos) elements.totalTodos.textContent = totalTasks;
    if (elements.pendingTodos) elements.pendingTodos.textContent = pendingTasks;
    if (elements.inProgressTodos) elements.inProgressTodos.textContent = inProgressTasks;
    if (elements.completedTodos) elements.completedTodos.textContent = completedTasks;
}

// 할 일 목록 업데이트
function updateTodosList() {
    if (!elements.todosList) return;
    
    if (currentTasks.length === 0) {
        elements.todosList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-500 mb-2">아직 할 일이 없어요</h3>
                <p class="text-gray-400 mb-4">새로운 할 일을 추가해보세요!</p>
                <button id="addFirstTodo" class="btn btn-primary" onclick="openTodoForm()">
                    <i class="fas fa-plus mr-2"></i>첫 번째 할 일 추가
                </button>
            </div>
        `;
        return;
    }
    
    // 필터링된 할 일 목록 생성
    let filteredTasks = [...currentTasks];
    
    // 상태 필터 체크박스 확인
    const statusFilters = {
        pending: document.getElementById('filterPending')?.checked,
        in_progress: document.getElementById('filterInProgress')?.checked,
        completed: document.getElementById('filterCompleted')?.checked
    };
    
    // 우선순위 필터 체크박스 확인
    const priorityFilters = {
        high: document.getElementById('filterHigh')?.checked,
        medium: document.getElementById('filterMedium')?.checked,
        low: document.getElementById('filterLow')?.checked
    };
    
    // 프로젝트 필터 확인
    const projectFilter = document.getElementById('projectFilter')?.value;
    
    // 검색 필터 확인
    const searchFilter = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    
    // 필터 적용
    filteredTasks = filteredTasks.filter(task => {
        // 상태 필터
        if (!statusFilters[task.status]) return false;
        
        // 우선순위 필터
        if (!priorityFilters[task.priority]) return false;
        
        // 프로젝트 필터
        if (projectFilter && projectFilter !== '' && String(task.project_id) !== String(projectFilter)) {
            return false;
        }
        
        // 검색 필터
        if (searchFilter && !task.title.toLowerCase().includes(searchFilter)) {
            return false;
        }
        
        return true;
    });
    
    if (filteredTasks.length === 0) {
        elements.todosList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-500 mb-2">조건에 맞는 할 일이 없어요</h3>
                <p class="text-gray-400 mb-4">필터를 조정하거나 새로운 할 일을 추가해보세요!</p>
            </div>
        `;
        return;
    }
    
    // 할 일 목록 HTML 생성
    let todosHTML = '';
    
    filteredTasks.forEach(task => {
        const project = currentProjects.find(p => p.id == task.project_id);
        const projectName = project ? project.name : '프로젝트 없음';
        const projectColor = project ? project.color : '#6B7280';
        
        const statusClass = `status-${task.status}`;
        const priorityClass = `priority-${task.priority}`;
        
        const statusIcon = task.status === 'completed' ? 'fa-check-circle' : 
                          task.status === 'in_progress' ? 'fa-clock' : 'fa-circle';
        
        const statusText = task.status === 'completed' ? '완료' :
                          task.status === 'in_progress' ? '진행중' : '대기중';
        
        const priorityText = task.priority === 'high' ? '높음' :
                            task.priority === 'medium' ? '보통' : '낮음';
        
        const dueDateText = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('ko-KR') : '마감일 없음';
        
        todosHTML += `
            <div class="todo-card" data-task-id="${task.id}" onclick="openTaskDetail(${task.id})">
                <div class="todo-header">
                    <div class="todo-title-section">
                        <h3 class="todo-title">${task.title}</h3>
                        <div class="todo-meta">
                            <span class="project-badge" style="background-color: ${projectColor}20; color: ${projectColor};">
                                ${projectName}
                            </span>
                            <span class="status-badge ${statusClass}">
                                <i class="fas ${statusIcon}"></i>
                                ${statusText}
                            </span>
                            <span class="priority-badge ${priorityClass}">
                                ${priorityText}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="todo-content">
                    <p class="todo-description">${task.description || '설명 없음'}</p>
                    <div class="todo-footer">
                        <span class="due-date">
                            <i class="fas fa-calendar"></i>
                            ${dueDateText}
                        </span>
                        <div class="todo-actions">
                            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); openTaskDetail(${task.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    elements.todosList.innerHTML = todosHTML;
}

// 프로젝트 목록 업데이트
function updateProjectsList() {
    if (!elements.projectsList) return;
    
    if (currentProjects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="empty-project-state">
                <p class="text-gray-500 text-center">프로젝트가 없습니다.</p>
                <button class="btn btn-sm btn-primary mt-2" onclick="openProjectForm()">
                    <i class="fas fa-plus mr-1"></i>프로젝트 추가
                </button>
            </div>
        `;
        return;
    }
    
    let projectsHTML = '';
    
    currentProjects.forEach(project => {
        const tasksInProject = currentTasks.filter(t => t.project_id == project.id);
        const completedTasks = tasksInProject.filter(t => t.status === 'completed').length;
        const totalTasks = tasksInProject.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        projectsHTML += `
            <div class="project-item" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-color" style="background-color: ${project.color};"></div>
                    <h4 class="project-name">${project.name}</h4>
                    <div class="project-actions">
                        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); filterByProject(${project.id})">
                            <i class="fas fa-filter"></i>
                        </button>
                    </div>
                </div>
                <div class="project-stats">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%; background-color: ${project.color};"></div>
                    </div>
                    <div class="project-meta">
                        <span class="task-count">${completedTasks}/${totalTasks} 완료</span>
                        <span class="progress-percent">${progress}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    elements.projectsList.innerHTML = projectsHTML;
}

// 모달 관련 함수들
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // 프로젝트 옵션 업데이트
        if (modalId === 'todoFormModal') {
            updateProjectOptions();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// 할 일 폼 열기
function openTodoForm() {
    updateProjectOptions();
    openModal('todoFormModal');
}

// 프로젝트 폼 열기
function openProjectForm() {
    openModal('projectFormModal');
}

// 프로젝트 옵션 업데이트
function updateProjectOptions() {
    const projectSelect = document.getElementById('todoProject');
    if (!projectSelect) return;
    
    // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
    while (projectSelect.children.length > 1) {
        projectSelect.removeChild(projectSelect.lastChild);
    }
    
    // 현재 프로젝트들을 옵션으로 추가
    currentProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
    });
    
    // 프로젝트 필터 드롭다운도 업데이트
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        // 기존 옵션 제거 (첫 번째 기본 옵션 제외)
        while (projectFilter.children.length > 1) {
            projectFilter.removeChild(projectFilter.lastChild);
        }
        
        // 현재 프로젝트들을 옵션으로 추가
        currentProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectFilter.appendChild(option);
        });
    }
}

// 할 일 상세 모달 열기
function openTaskDetail(taskId) {
    console.log('할 일 상세 모달 열기:', taskId);
    
    const task = currentTasks.find(t => t.id == taskId);
    if (!task) {
        console.error('할 일을 찾을 수 없습니다:', taskId);
        showNotification('할 일을 찾을 수 없습니다.', 'error');
        return;
    }
    
    currentTaskId = taskId;
    
    // 모달 내용 업데이트
    const titleElement = document.getElementById('taskDetailTitle');
    const descElement = document.getElementById('taskDetailDescription');
    const statusElement = document.getElementById('taskDetailStatus');
    const priorityElement = document.getElementById('taskDetailPriority');
    const projectElement = document.getElementById('taskDetailProject');
    const dueDateElement = document.getElementById('taskDetailDueDate');
    const createdAtElement = document.getElementById('taskDetailCreatedAt');
    
    if (titleElement) titleElement.textContent = task.title;
    if (descElement) descElement.textContent = task.description || '설명 없음';
    if (dueDateElement) dueDateElement.textContent = task.due_date ? 
        new Date(task.due_date).toLocaleDateString('ko-KR') : '마감일 없음';
    if (createdAtElement) createdAtElement.textContent = task.created_at ? 
        new Date(task.created_at).toLocaleDateString('ko-KR') : '';
    
    // 상태 업데이트
    if (statusElement) {
        updateStatusElementStyle(task.status);
    }
    
    // 우선순위 업데이트
    if (priorityElement) {
        const priorityClass = `priority-${task.priority}`;
        const priorityText = task.priority === 'high' ? '높음' :
                            task.priority === 'medium' ? '보통' : '낮음';
        priorityElement.className = `priority-badge ${priorityClass}`;
        priorityElement.textContent = priorityText;
    }
    
    // 프로젝트 업데이트
    if (projectElement) {
        const project = currentProjects.find(p => p.id == task.project_id);
        if (project) {
            projectElement.style.backgroundColor = project.color + '20';
            projectElement.style.color = project.color;
            projectElement.textContent = project.name;
        } else {
            projectElement.style.backgroundColor = '#6B728020';
            projectElement.style.color = '#6B7280';
            projectElement.textContent = '프로젝트 없음';
        }
    }
    
    // 댓글 로드
    loadTaskComments(taskId);
    
    // 상태 변경 드롭다운 설정
    setupStatusChangeDropdown();
    
    // 모달 열기
    openModal('todoModal');
}

// 댓글 로드
function loadTaskComments(taskId) {
    const commentsContainer = document.getElementById('commentsList');
    const commentsCount = document.getElementById('commentsCount');
    
    if (!commentsContainer) return;
    
    const taskComments = currentComments.filter(c => c.task_id == taskId);
    
    if (commentsCount) {
        commentsCount.textContent = `${taskComments.length}개`;
    }
    
    if (taskComments.length === 0) {
        commentsContainer.innerHTML = `
            <div class="no-comments">
                <p class="text-gray-500 text-center">아직 댓글이 없습니다.</p>
            </div>
        `;
        return;
    }
    
    let commentsHTML = '';
    taskComments.forEach(comment => {
        const commentDate = new Date(comment.created_at).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        commentsHTML += `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${comment.user_name}</span>
                    <span class="comment-date">${commentDate}</span>
                </div>
                <div class="comment-content">${comment.content}</div>
            </div>
        `;
    });
    
    commentsContainer.innerHTML = commentsHTML;
}

// 댓글 추가
async function addComment() {
    const commentInput = document.getElementById('commentInput');
    if (!commentInput || !currentTaskId) return;
    
    const content = commentInput.value.trim();
    if (!content) {
        showNotification('댓글 내용을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        const newComment = {
            id: Math.max(...currentComments.map(c => c.id), 0) + 1,
            task_id: currentTaskId,
            user_id: currentUser?.id || 'demo-user',
            user_name: currentUser?.user_metadata?.full_name || '데모 사용자',
            content: content,
            created_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 스토리지에 저장
            currentComments.push(newComment);
            localStorage.setItem('demo_comments', JSON.stringify(currentComments));
        } else if (supabase && currentWorkspace) {
            // Supabase에 저장
            const { data, error } = await supabase
                .from('comments')
                .insert([{
                    todo_id: currentTaskId,
                    content: content,
                    user_id: currentUser.id
                }])
                .select()
                .single();
                
            if (error) throw error;
            
            // 로컬 배열에 실제 데이터 추가
            currentComments.push({
                ...data,
                task_id: data.todo_id,
                user_name: currentUser.user_metadata?.full_name || currentUser.email
            });
        }
        
        // 댓글 목록 새로고침
        loadTaskComments(currentTaskId);
        
        // 입력창 초기화
        commentInput.value = '';
        
        showNotification('댓글이 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('댓글 추가 실패:', error);
        showNotification('댓글 추가에 실패했습니다.', 'error');
    }
}

// 프로젝트별 필터링
function filterByProject(projectId) {
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        projectFilter.value = projectId;
        updateTodosList();
        showNotification('프로젝트별로 필터링되었습니다.', 'info');
    }
}

// 필터 초기화
function clearFilters() {
    // 상태 필터 체크박스 모두 체크
    const statusCheckboxes = ['filterPending', 'filterInProgress', 'filterCompleted'];
    statusCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });
    
    // 우선순위 필터 체크박스 모두 체크
    const priorityCheckboxes = ['filterHigh', 'filterMedium', 'filterLow'];
    priorityCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = true;
    });
    
    // 프로젝트 필터 초기화
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) projectFilter.value = '';
    
    // 검색 입력 초기화
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // 목록 업데이트
    updateTodosList();
    
    showNotification('모든 필터가 초기화되었습니다.', 'info');
}

// 캘린더 렌더링
function renderCalendar() {
    if (!elements.calendar) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 월/연도 표시 업데이트
    if (elements.currentMonth) {
        elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
    }
    
    // 현재 월의 첫째 날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 캘린더 시작일 (이전 월의 마지막 주 포함)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    let calendarHTML = '';
    
    // 6주 표시
    for (let week = 0; week < 6; week++) {
        for (let day = 0; day < 7; day++) {
            const currentCalendarDate = new Date(startDate);
            currentCalendarDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const isCurrentMonth = currentCalendarDate.getMonth() === month;
            const isToday = currentCalendarDate.toDateString() === new Date().toDateString();
            const dayNum = currentCalendarDate.getDate();
            
            // 해당 날짜의 할 일 찾기
            const dayTasks = currentTasks.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate.toDateString() === currentCalendarDate.toDateString();
            });
            
            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' other-month';
            if (isToday) dayClass += ' today';
            if (day === 0) dayClass += ' sunday';
            if (day === 6) dayClass += ' saturday';
            
            calendarHTML += `
                <div class="${dayClass}" data-date="${currentCalendarDate.toISOString().split('T')[0]}">
                    <div class="day-number">${dayNum}</div>
                    <div class="day-tasks">
            `;
            
            // 할일을 작은 점으로 표시 (최대 3개)
            dayTasks.slice(0, 3).forEach(task => {
                const project = currentProjects.find(p => p.id == task.project_id);
                const color = project ? project.color : '#6B7280';
                
                calendarHTML += `
                    <div class="task-dot" style="background-color: ${color};" 
                         title="${task.title}" onclick="openTaskDetail(${task.id})"></div>
                `;
            });
            
            // 더 많은 할일이 있으면 표시
            if (dayTasks.length > 3) {
                calendarHTML += `<div class="more-tasks">+${dayTasks.length - 3}</div>`;
            }
            
            calendarHTML += `
                    </div>
                </div>
            `;
        }
    }
    
    elements.calendar.innerHTML = calendarHTML;
}

// 캘린더 날짜 이동
function moveCalendarDate(direction) {
    if (direction === 'prev') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (direction === 'next') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    renderCalendar();
}

// 로그인 처리
async function handleLogin() {
    try {
        if (elements.googleLogin) {
            elements.googleLogin.disabled = true;
            elements.googleLogin.innerHTML = '<div class="spinner"></div> 로그인 중...';
        }
        
        if (!supabase) {
            showNotification('Supabase가 초기화되지 않았습니다. 데모 모드를 이용해주세요.', 'error');
            if (elements.googleLogin) {
                elements.googleLogin.disabled = false;
                elements.googleLogin.innerHTML = '<i class="fab fa-google mr-2"></i>Google로 시작하기';
            }
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('로그인 실패:', error);
        showNotification('로그인에 실패했습니다.', 'error');
        if (elements.googleLogin) {
            elements.googleLogin.disabled = false;
            elements.googleLogin.innerHTML = '<i class="fab fa-google mr-2"></i>Google로 시작하기';
        }
    }
}

// 데모 모드 처리
async function handleDemoMode() {
    try {
        if (elements.demoLogin) {
            elements.demoLogin.disabled = true;
            elements.demoLogin.innerHTML = '<div class="spinner"></div> 데모 모드 시작...';
        }
        
        showLoading();
        
        isDemoMode = true;
        
        currentUser = {
            id: 'demo-user',
            email: 'demo@example.com',
            user_metadata: {
                full_name: '데모 사용자'
            }
        };
        
        await loadDemoData();
        updateUserInfo();
        
        hideLoading();
        showMainApp();
        switchView('dashboard');
        
        // 데모 모드 인디케이터 표시
        if (elements.demoIndicator) {
            elements.demoIndicator.classList.remove('hidden');
        }
        
        console.log('데모 모드로 시작합니다!');
        
    } catch (error) {
        console.error('데모 모드 초기화 실패:', error);
        hideLoading();
        showNotification('데모 모드 시작에 실패했습니다.', 'error');
        
        if (elements.demoLogin) {
            elements.demoLogin.disabled = false;
            elements.demoLogin.innerHTML = '<i class="fas fa-play mr-2"></i>데모 체험하기';
        }
    }
}

// 인증 상태 확인
async function checkAuthState() {
    try {
        if (!supabase) {
            console.log('Supabase가 초기화되지 않음 - 로그인 화면 표시');
            hideLoading();
            showLoginScreen();
            return;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('인증 상태 확인 실패:', error);
            hideLoading();
            showLoginScreen();
            return;
        }

        if (user) {
            console.log('로그인된 사용자 발견:', user.email);
            currentUser = user;
            await initializeUserData();
            hideLoading();
            showMainApp();
            switchView('dashboard');
        } else {
            console.log('로그인되지 않은 상태');
            hideLoading();
            showLoginScreen();
        }
    } catch (error) {
        console.error('인증 상태 확인 중 오류:', error);
        hideLoading();
        showLoginScreen();
    }
}

// 사용자 데이터 초기화
async function initializeUserData() {
    try {
        await ensureUserProfile();
        await ensureUserWorkspace();
        await loadUserData();
        updateUserInfo();
        
        console.log('사용자 데이터 초기화 완료');
    } catch (error) {
        console.error('사용자 데이터 초기화 실패:', error);
        showNotification('데이터 로드에 실패했습니다.', 'error');
    }
}

// 사용자 프로필 확인/생성
async function ensureUserProfile() {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    if (!profile) {
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                full_name: currentUser.user_metadata?.full_name || currentUser.email,
                avatar_url: currentUser.user_metadata?.avatar_url
            });

        if (insertError) {
            throw insertError;
        }
    }
}

// 사용자 워크스페이스 확인/생성
async function ensureUserWorkspace() {
    const { data: memberships, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('user_id', currentUser.id);

    if (memberError) {
        throw memberError;
    }

    if (memberships && memberships.length > 0) {
        currentWorkspace = memberships[0].workspaces;
    } else {
        const { data: existingWorkspaces, error: existingError } = await supabase
            .from('workspaces')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1);

        if (existingError) {
            throw existingError;
        }

        let targetWorkspace;
        
        if (existingWorkspaces && existingWorkspaces.length > 0) {
            targetWorkspace = existingWorkspaces[0];
        } else {
            const { data: workspace, error: wsError } = await supabase
                .from('workspaces')
                .insert({
                    name: 'Smart Teamwork 워크스페이스',
                    description: '팀 협업 작업 공간',
                    created_by: currentUser.id
                })
                .select()
                .single();

            if (wsError) {
                throw wsError;
            }
            
            targetWorkspace = workspace;
        }

        const { error: memberInsertError } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: targetWorkspace.id,
                user_id: currentUser.id,
                role: targetWorkspace.created_by === currentUser.id ? 'owner' : 'member'
            });

        if (memberInsertError) {
            throw memberInsertError;
        }

        currentWorkspace = targetWorkspace;
    }
}

// 사용자 데이터 로드
async function loadUserData() {
    if (!currentWorkspace) return;

    const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

    if (projectError) {
        throw projectError;
    }

    currentProjects = projects || [];

    const { data: todos, error: todoError } = await supabase
        .from('todos')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

    if (todoError) {
        throw todoError;
    }

    currentTasks = todos || [];

    const { data: comments, error: commentError } = await supabase
        .from('comments')
        .select('*')
        .in('todo_id', currentTasks.map(t => t.id))
        .order('created_at', { ascending: true });

    if (commentError) {
        throw commentError;
    }

    currentComments = comments || [];
    
    console.log('사용자 데이터 로드 완료:', {
        projects: currentProjects.length,
        tasks: currentTasks.length,
        comments: currentComments.length
    });
    
    updateDashboard();
    updateProjectsList();
    renderCalendar();
    setupEventListeners();
}

// 로그아웃 처리
async function handleLogout() {
    try {
        if (!isDemoMode && supabase) {
            await supabase.auth.signOut();
        }
        
        currentUser = null;
        currentWorkspace = null;
        currentProjects = [];
        currentTasks = [];
        currentComments = [];
        isDemoMode = false;
        
        localStorage.removeItem('demo_projects');
        localStorage.removeItem('demo_tasks');
        localStorage.removeItem('demo_comments');
        
        showLoginScreen();
        showNotification('로그아웃되었습니다.', 'info');
        
    } catch (error) {
        console.error('로그아웃 실패:', error);
        showNotification('로그아웃에 실패했습니다.', 'error');
    }
}

// 뷰 전환
function switchView(view) {
    currentView = view;
    
    // 모든 뷰 숨기기
    if (elements.dashboardView) elements.dashboardView.classList.add('hidden');
    if (elements.calendarView) elements.calendarView.classList.add('hidden');
    
    // 네비게이션 버튼 상태 업데이트
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택된 뷰 표시 및 버튼 활성화
    if (view === 'dashboard') {
        if (elements.dashboardView) elements.dashboardView.classList.remove('hidden');
        if (elements.dashboardBtn) elements.dashboardBtn.classList.add('active');
        updateDashboard();
    } else if (view === 'calendar') {
        if (elements.calendarView) elements.calendarView.classList.remove('hidden');
        if (elements.calendarBtn) elements.calendarBtn.classList.add('active');
        renderCalendar();
    }
}

// 사용자 정보 업데이트
function updateUserInfo() {
    if (!currentUser) return;
    
    const displayName = currentUser.user_metadata?.full_name || currentUser.email;
    
    if (elements.userName) {
        elements.userName.textContent = displayName;
    }
    
    if (elements.userAvatar && currentUser.user_metadata?.avatar_url) {
        elements.userAvatar.src = currentUser.user_metadata.avatar_url;
    }
}

// 알림 표시
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        max-width: 350px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
    `;
    
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            notification.style.color = 'white';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
            notification.style.color = 'white';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    notification.addEventListener('click', () => {
        notification.remove();
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// CSS 애니메이션 추가
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 할 일 추가 처리
async function handleNewTodo(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const title = formData.get('todoTitle')?.trim();
    const description = formData.get('todoDescription')?.trim();
    const status = formData.get('todoStatus') || 'pending';
    const priority = formData.get('todoPriority') || 'medium';
    const projectId = formData.get('todoProject');
    const dueDate = formData.get('todoDueDate');
    
    if (!title) {
        showNotification('할 일 제목을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        const newTodo = {
            id: Math.max(...currentTasks.map(t => t.id), 0) + 1,
            title: title,
            description: description || '',
            status: status,
            priority: priority,
            project_id: projectId ? parseInt(projectId) : null,
            due_date: dueDate || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            currentTasks.push(newTodo);
            localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
        } else if (supabase && currentWorkspace) {
            const { data, error } = await supabase
                .from('todos')
                .insert([{
                    title: title,
                    description: description || '',
                    status: status,
                    priority: priority,
                    project_id: projectId || null,
                    due_date: dueDate || null,
                    workspace_id: currentWorkspace.id,
                    created_by: currentUser.id,
                    assigned_to: currentUser.id
                }])
                .select()
                .single();
                
            if (error) throw error;
            currentTasks.push(data);
        }
        
        updateDashboard();
        updateProjectsList();
        renderCalendar();
        
        closeModal('todoFormModal');
        e.target.reset();
        
        showNotification('할 일이 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('할 일 추가 실패:', error);
        showNotification('할 일 추가에 실패했습니다.', 'error');
    }
}

// 프로젝트 추가 처리
async function handleNewProject(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('projectName')?.trim();
    const description = formData.get('projectDescription')?.trim();
    const color = formData.get('projectColor') || '#3B82F6';
    
    if (!name) {
        showNotification('프로젝트 이름을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        const newProject = {
            id: Math.max(...currentProjects.map(p => p.id), 0) + 1,
            name: name,
            description: description || '',
            color: color,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            currentProjects.push(newProject);
            localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
        } else if (supabase && currentWorkspace) {
            const { data, error } = await supabase
                .from('projects')
                .insert([{
                    name: name,
                    description: description || '',
                    color: color,
                    workspace_id: currentWorkspace.id,
                    created_by: currentUser.id
                }])
                .select()
                .single();
                
            if (error) throw error;
            currentProjects.push(data);
        }
        
        updateDashboard();
        updateProjectsList();
        updateProjectOptions();
        
        closeModal('projectFormModal');
        e.target.reset();
        
        showNotification('프로젝트가 생성되었습니다.', 'success');
        
    } catch (error) {
        console.error('프로젝트 생성 실패:', error);
        showNotification('프로젝트 생성에 실패했습니다.', 'error');
    }
}

// 데모 데이터 로드
async function loadDemoData() {
    let storedProjects = localStorage.getItem('demo_projects');
    let storedTasks = localStorage.getItem('demo_tasks');
    let storedComments = localStorage.getItem('demo_comments');
    
    if (storedProjects && storedTasks) {
        try {
            currentProjects = JSON.parse(storedProjects);
            currentTasks = JSON.parse(storedTasks);
            if (storedComments) {
                currentComments = JSON.parse(storedComments);
            }
            console.log('로컬스토리지에서 데이터 복원 완료');
        } catch (e) {
            console.error('로컬스토리지 데이터 파싱 오류, 기본 데이터 사용:', e);
            loadDefaultDemoData();
        }
    } else {
        console.log('저장된 데이터 없음, 기본 데이터 사용');
        loadDefaultDemoData();
    }
    
    updateDashboard();
    updateProjectsList();
    renderCalendar();
    updateProjectOptions();
    setupEventListeners();
    
    localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
    localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
    localStorage.setItem('demo_comments', JSON.stringify(currentComments));
    
    console.log('데모 데이터 로드 완료:', {
        projects: currentProjects.length,
        tasks: currentTasks.length,
        comments: currentComments.length
    });
}

// 기본 데모 데이터 로드
function loadDefaultDemoData() {
    currentProjects = [
        { 
            id: 1, 
            name: '웹사이트 리뉴얼', 
            color: '#3B82F6', 
            description: '회사 웹사이트 전면 리뉴얼 프로젝트',
            created_at: '2025-07-01T00:00:00'
        },
        { 
            id: 2, 
            name: '모바일 앱 개발', 
            color: '#10B981', 
            description: '신규 모바일 애플리케이션 개발',
            created_at: '2025-07-01T00:00:00'
        }
    ];
    
    currentTasks = [
        { 
            id: 1, 
            title: 'UI/UX 디자인 시안 작성', 
            project_id: 1, 
            status: 'in_progress',
            priority: 'high',
            description: '메인 페이지와 서브 페이지 디자인 시안을 작성합니다.',
            due_date: '2025-07-05',
            created_at: '2025-07-04T12:38:36'
        },
        { 
            id: 2, 
            title: '프론트엔드 개발', 
            project_id: 1, 
            status: 'pending',
            priority: 'medium',
            description: '디자인 시안을 바탕으로 HTML, CSS, JavaScript 개발',
            due_date: '2025-07-10',
            created_at: '2025-07-04T12:40:22'
        },
        { 
            id: 3, 
            title: '요구사항 분석', 
            project_id: 2, 
            status: 'pending',
            priority: 'high',
            description: '사용자 요구사항 분석 및 정의',
            due_date: '2025-07-15',
            created_at: '2025-07-04T12:45:18'
        }
    ];
    
    currentComments = [
        {
            id: 1,
            task_id: 1,
            user_id: 'demo-user',
            user_name: '데모 사용자',
            content: '로고 디자인은 회사 CI 가이드를 참고해주세요.',
            created_at: '2025-07-04T13:05:42'
        }
    ];
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 버튼
    if (elements.googleLogin) {
        elements.googleLogin.addEventListener('click', handleLogin);
    }
    
    if (elements.demoLogin) {
        elements.demoLogin.addEventListener('click', handleDemoMode);
    }
    
    // 로그아웃 버튼
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 네비게이션 버튼
    if (elements.dashboardBtn) {
        elements.dashboardBtn.addEventListener('click', () => switchView('dashboard'));
    }
    
    if (elements.calendarBtn) {
        elements.calendarBtn.addEventListener('click', () => switchView('calendar'));
    }
    
    // 퀵 액션 버튼
    if (elements.addTodoBtn) {
        elements.addTodoBtn.addEventListener('click', openTodoForm);
    }
    
    if (elements.addProjectBtn) {
        elements.addProjectBtn.addEventListener('click', openProjectForm);
    }
    
    if (elements.addFirstTodo) {
        elements.addFirstTodo.addEventListener('click', openTodoForm);
    }
    
    // 모달 닫기 버튼
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => closeModal('todoModal'));
    }
    
    if (elements.closeTodoFormModal) {
        elements.closeTodoFormModal.addEventListener('click', () => closeModal('todoFormModal'));
    }
    
    if (elements.closeProjectFormModal) {
        elements.closeProjectFormModal.addEventListener('click', () => closeModal('projectFormModal'));
    }
    
    // 폼 제출
    if (elements.todoForm) {
        elements.todoForm.addEventListener('submit', handleNewTodo);
    }
    
    if (elements.projectForm) {
        elements.projectForm.addEventListener('submit', handleNewProject);
    }
    
    // 캘린더 네비게이션
    if (elements.prevMonth) {
        elements.prevMonth.addEventListener('click', () => moveCalendarDate('prev'));
    }
    
    if (elements.nextMonth) {
        elements.nextMonth.addEventListener('click', () => moveCalendarDate('next'));
    }
    
    // 댓글 추가 버튼
    const addCommentBtn = document.getElementById('addCommentBtn');
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', addComment);
    }
    
    // 필터 이벤트 리스너
    const filterCheckboxes = [
        'filterPending', 'filterInProgress', 'filterCompleted',
        'filterHigh', 'filterMedium', 'filterLow'
    ];
    
    filterCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', updateTodosList);
        }
    });
    
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        projectFilter.addEventListener('change', updateTodosList);
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', updateTodosList);
    }
    
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    // 색상 선택 이벤트
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('color-option')) {
            const colorPicker = e.target.closest('.color-picker');
            if (colorPicker) {
                colorPicker.querySelectorAll('.color-option').forEach(option => {
                    option.classList.remove('selected');
                });
                
                e.target.classList.add('selected');
                
                const colorInput = document.getElementById('projectColor');
                if (colorInput) {
                    colorInput.value = e.target.dataset.color;
                }
            }
        }
    });
    
    // 모달 외부 클릭 시 닫기
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// 앱 초기화
async function initApp() {
    console.log('Smart Teamwork 앱 초기화 시작...');
    
    // Supabase 인증 상태 변경 감지
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('인증 상태 변경:', event, session);
            
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                initializeUserData().then(() => {
                    hideLoading();
                    showMainApp();
                    switchView('dashboard');
                });
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                currentWorkspace = null;
                currentProjects = [];
                currentTasks = [];
                currentComments = [];
                hideLoading();
                showLoginScreen();
            }
        });
    }
    
    // 초기 인증 상태 확인
    await checkAuthState();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    console.log('Smart Teamwork 앱 초기화 완료');
}

// DOM 로드 완료 후 앱 초기화
document.addEventListener('DOMContentLoaded', initApp);