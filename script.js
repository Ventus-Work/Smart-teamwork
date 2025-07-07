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
    
    // 3. fallback 값 반환
    return fallback;
};// 환경변수 설정
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
}// Supabase 클라이언트 초기화
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

// DOM 요소 (존재하는 요소만)
const elements = {
    loading: document.getElementById('loading'),
    loginScreen: document.getElementById('loginScreen'),
    mainApp: document.getElementById('app'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),
    demoBtn: document.getElementById('demoBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userAvatar: document.getElementById('userAvatar'),
    userDropdown: document.getElementById('userDropdown'),
    userEmail: document.getElementById('userEmail'),
    userMenuBtn: document.getElementById('userMenuBtn'),
    
    // Navigation
    dashboardBtn: document.getElementById('dashboardBtn'),
    projectsBtn: document.getElementById('projectsBtn'),
    calendarBtn: document.getElementById('calendarBtn'),
    
    // Views
    dashboardView: document.getElementById('dashboardView'),
    projectsView: document.getElementById('projectsView'),
    calendarView: document.getElementById('calendarView'),
    
    // Tasks
    newTaskBtn: document.getElementById('newTaskBtn'),
    newTaskModal: document.getElementById('newTaskModal'),
    newTaskForm: document.getElementById('newTaskForm'),
    
    // Projects
    newProjectBtn: document.getElementById('newProjectBtn'),
    newProjectModal: document.getElementById('newProjectModal'),
    newProjectForm: document.getElementById('newProjectForm'),
    
    // Task Detail Modal
    taskDetailModal: document.getElementById('taskDetailModal'),
    closeTaskDetailBtn: document.getElementById('closeTaskDetailBtn'),
};

// 유틸리티 함수들
function showLoading() {
    if (elements.loading) {
        elements.loading.classList.add('show');
        elements.loading.classList.remove('d-none');
    }
}

function hideLoading() {
    if (elements.loading) {
        elements.loading.classList.remove('show');
        setTimeout(() => {
            elements.loading.classList.add('d-none');
        }, 300);
    }
}

function showLoginScreen() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.remove('d-none');
    }
    if (elements.mainApp) {
        elements.mainApp.classList.add('d-none');
    }
}

function showMainApp() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.add('d-none');
    }
    if (elements.mainApp) {
        elements.mainApp.classList.remove('d-none');
    }
}

// 대시보드 업데이트 함수 추가
function updateDashboard() {
    console.log("대시보드 업데이트 중...");
    
    // 통계 업데이트
    updateDashboardStats();
    
    // 최근 할일 목록 업데이트
    updateRecentTasksList();
}

// 대시보드 통계 업데이트
function updateDashboardStats() {
    try {
        const totalTasks = currentTasks.length;
        // 데이터베이스 status 값에 맞춰 조정
        const pendingTasks = currentTasks.filter(t => t.status === 'todo' || t.status === 'pending').length;
        const inProgressTasks = currentTasks.filter(t => t.status === 'doing' || t.status === 'in_progress').length;
        const completedTasks = currentTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
        const totalProjects = currentProjects.length;
        
        // 통계 카드 업데이트
        const statsCards = document.querySelectorAll('.stats-card p');
        if (statsCards.length >= 4) {
            statsCards[0].textContent = totalTasks;
            statsCards[1].textContent = pendingTasks;
            statsCards[2].textContent = inProgressTasks;
            statsCards[3].textContent = totalProjects;
        }
        
        console.log('대시보드 통계 업데이트 완료:', { totalTasks, pendingTasks, inProgressTasks, completedTasks, totalProjects });
    } catch (error) {
        console.error('대시보드 통계 업데이트 실패:', error);
    }
}

// 최근 할일 목록 업데이트
function updateRecentTasksList() {
    try {
        const recentTasksContainer = document.querySelector('.recent-tasks-container');
        if (!recentTasksContainer) {
            console.warn('최근 할일 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 필터링된 할일 목록 가져오기
        let filteredTasks = [...currentTasks];
        
        // 상태 필터 적용
        if (currentStatusFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                if (currentStatusFilter === 'pending') {
                    return task.status === 'pending' || task.status === 'todo';
                } else if (currentStatusFilter === 'in_progress') {
                    return task.status === 'in_progress' || task.status === 'doing';
                } else if (currentStatusFilter === 'completed') {
                    return task.status === 'completed' || task.status === 'done';
                }
                return true;
            });
        }
        
        // 프로젝트 필터 적용
        if (currentProjectFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.project_id === currentProjectFilter);
        }
        
        // 일반 필터 적용
        if (currentFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                if (currentFilter === 'pending') {
                    return task.status === 'pending' || task.status === 'todo';
                } else if (currentFilter === 'in_progress') {
                    return task.status === 'in_progress' || task.status === 'doing';
                } else if (currentFilter === 'completed') {
                    return task.status === 'completed' || task.status === 'done';
                }
                return true;
            });
        }
        
        const recentTasksList = document.getElementById('recentTasksList');
        if (!recentTasksList) {
            console.warn('최근 할일 목록 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 정렬: 생성일 기준 내림차순
        filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        if (filteredTasks.length === 0) {
            recentTasksList.innerHTML = `
                <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
                    <svg style="width: 3rem; height: 3rem; margin-bottom: var(--space-4); color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">할 일이 없습니다</h3>
                    <p style="color: var(--text-tertiary);">새로운 할 일을 추가해보세요!</p>
                    <button class="btn btn-primary btn-md" style="margin-top: var(--space-4);" onclick="openModal('newTaskModal')">
                        할 일 추가하기
                    </button>
                </div>
            `;
            return;
        }
        
        // 할일 목록 HTML 생성
        const tasksHTML = filteredTasks.map(task => {
            const project = currentProjects.find(p => p.id === task.project_id);
            const projectName = project ? project.name : '프로젝트 없음';
            const projectColor = project ? project.color : '#6B7280';
            
            // 상태에 따른 스타일
            const statusConfig = getStatusConfig(task.status);
            
            // 우선순위에 따른 스타일
            const priorityConfig = getPriorityConfig(task.priority);
            
            // 날짜 포맷팅
            const dueDate = task.due_date ? formatDateShort(task.due_date) : '';
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && (task.status !== 'completed' && task.status !== 'done');
            
            return `
                <div class="task-item" data-task-id="${task.id}" onclick="openTaskDetail('${task.id}')" style="cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2);">
                        <div style="width: 0.5rem; height: 2rem; background-color: ${projectColor}; border-radius: var(--radius-sm); flex-shrink: 0;"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-1);">
                                <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${task.title}</h3>
                                <div style="display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0;">
                                    <span class="priority-indicator ${priorityConfig.class}" style="font-size: var(--text-sm);">${priorityConfig.label}</span>
                                    <span class="status-badge ${statusConfig.class}" style="font-size: var(--text-xs);">${statusConfig.label}</span>
                                </div>
                            </div>
                            <p style="color: var(--text-secondary); margin: 0 0 var(--space-2) 0; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${task.description || '상세 설명 없음'}</p>
                            <div style="display: flex; align-items: center; justify-content: space-between; font-size: var(--text-xs); color: var(--text-tertiary);">
                                <span style="background-color: ${projectColor}20; color: ${projectColor}; padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); border: 1px solid ${projectColor}40;">${projectName}</span>
                                ${dueDate ? `<span style="color: ${isOverdue ? 'var(--error-600)' : 'var(--text-tertiary)'}; font-weight: ${isOverdue ? 'var(--font-medium)' : 'var(--font-normal)'};">${isOverdue ? '⚠️ ' : '📅 '}${dueDate}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        recentTasksList.innerHTML = tasksHTML;
        
        console.log('최근 할일 목록 업데이트 완료:', filteredTasks.length);
    } catch (error) {
        console.error('최근 할일 목록 업데이트 실패:', error);
    }
}

// 상태 설정 가져오기
function getStatusConfig(status) {
    const statusMap = {
        'pending': { class: 'status-pending', label: '대기중' },
        'todo': { class: 'status-pending', label: '대기중' },
        'in_progress': { class: 'status-in-progress', label: '진행중' },
        'doing': { class: 'status-in-progress', label: '진행중' },
        'completed': { class: 'status-completed', label: '완료' },
        'done': { class: 'status-completed', label: '완료' }
    };
    return statusMap[status] || { class: 'status-pending', label: '대기중' };
}

// 우선순위 설정 가져오기
function getPriorityConfig(priority) {
    const priorityMap = {
        'high': { class: 'priority-high', label: '● 높음' },
        'medium': { class: 'priority-medium', label: '● 보통' },
        'low': { class: 'priority-low', label: '● 낮음' }
    };
    return priorityMap[priority] || { class: 'priority-medium', label: '● 보통' };
}