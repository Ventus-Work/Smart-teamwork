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
let currentTaskId = null;
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
        
        // 최근 5개 할일 가져오기 (진행중과 대기 상태 우선)
        const recentTasks = currentTasks
            .filter(task => task.status !== 'done' && task.status !== 'completed')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
        
        // 기존 task-item들 제거 (padding container 내부)
        const paddingContainer = recentTasksContainer.querySelector('div:last-child');
        if (paddingContainer) {
            // 기존 task-item들만 제거
            const existingTaskItems = paddingContainer.querySelectorAll('.task-item');
            existingTaskItems.forEach(item => item.remove());
            
            // 새로운 할일 목록 렌더링
            if (recentTasks.length === 0) {
                paddingContainer.innerHTML = `
                    <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
                        <svg style="width: 3rem; height: 3rem; margin: 0 auto var(--space-4) auto; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                        <p>진행 중인 할일이 없습니다.</p>
                        <p style="font-size: var(--text-sm); margin-top: var(--space-2);">새로운 할일을 추가해보세요!</p>
                    </div>
                `;
            } else {
                recentTasks.forEach(task => {
                    const project = currentProjects.find(p => p.id === task.project_id);
                    const projectName = project ? project.name : '프로젝트 없음';
                    const projectColor = project ? project.color : '#6B7280';
                    
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';
                    taskElement.setAttribute('data-task-id', task.id);
                    taskElement.style.cssText = 'cursor: pointer; padding: var(--space-4); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); margin-bottom: var(--space-3); transition: all 0.2s ease;';
                    
                    const statusIcon = (task.status === 'doing' || task.status === 'in_progress') ? 
                        `<div style="width: 0.5rem; height: 0.5rem; background-color: var(--warning-500); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>` : '';
                    
                    const statusColor = (task.status === 'doing' || task.status === 'in_progress') ? 'var(--warning-500)' : 'var(--neutral-300)';
                    
                    taskElement.innerHTML = `
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                            <div style="width: 1rem; height: 1rem; border: 2px solid ${statusColor}; border-radius: 50%; position: relative; flex-shrink: 0;">
                                ${statusIcon}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); flex-wrap: wrap;">
                                    <h3 style="font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-primary);">${task.title}</h3>
                                    <span style="background-color: ${projectColor}20; color: ${projectColor}; padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); white-space: nowrap;">${projectName}</span>
                                    <span class="priority-${task.priority}" style="font-size: var(--text-sm); white-space: nowrap;">● ${task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}</span>
                                </div>
                                <p style="font-size: var(--text-sm); color: var(--text-tertiary); margin-bottom: var(--space-2);">${task.description || '설명 없음'}</p>
                                <div style="display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-tertiary); flex-wrap: wrap;">
                                    ${task.start_date ? `<span>시작일: ${new Date(task.start_date).toLocaleDateString('ko-KR')}</span>` : ''}
                                    ${task.due_date ? `<span>마감일: ${new Date(task.due_date).toLocaleDateString('ko-KR')}</span>` : ''}
                                </div>
                            </div>
                            <button class="btn btn-ghost btn-sm" style="flex-shrink: 0;" onclick="event.stopPropagation(); openTaskDetail('${task.id}')">
                                <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                    
                    paddingContainer.appendChild(taskElement);
                });
            }
        }
        
        console.log('최근 할일 목록 업데이트 완료:', recentTasks.length, '개 항목');
        
        // 이벤트 리스너 재설정
        setupEventListeners();
        
    } catch (error) {
        console.error('최근 할일 목록 업데이트 실패:', error);
    }
}

// 모달 관련 함수들
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        
        // 새 할 일 모달을 열 때 프로젝트 목록 업데이트
        if (modalId === 'newTaskModal') {
            updateProjectSelectOptions();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// 프로젝트 선택 옵션 업데이트
function updateProjectSelectOptions() {
    const projectSelect = document.getElementById('taskProject');
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
}

// 색상 선택기 초기화
function initColorPicker() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('color-option')) {
            // 기존 선택 제거
            const colorPicker = e.target.closest('.color-picker');
            if (colorPicker) {
                colorPicker.querySelectorAll('.color-option').forEach(option => {
                    option.classList.remove('selected');
                });
                
                // 새 선택 추가
                e.target.classList.add('selected');
                
                // 숨겨진 input에 색상 값 설정
                const colorInput = document.getElementById('projectColor');
                if (colorInput) {
                    colorInput.value = e.target.dataset.color;
                }
            }
        }
        
        // 우선순위 선택
        if (e.target.closest('.priority-option')) {
            const priorityOption = e.target.closest('.priority-option');
            const priorityContainer = priorityOption.closest('.priority-colors');
            if (priorityContainer) {
                priorityContainer.querySelectorAll('.priority-option').forEach(option => {
                    option.classList.remove('selected');
                });
                priorityOption.classList.add('selected');
            }
        }
    });
}

// 캘린더 뷰 전환 함수들
function switchCalendarView(viewType) {
    // 모든 뷰 버튼에서 active 클래스 제거
    document.querySelectorAll('.calendar-view-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.getElementById(`${viewType}ViewBtn`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    const calendarContainer = document.getElementById('calendarContainer');
    const listView = document.querySelector('.calendar-list-view');
    
    if (viewType === 'month') {
        calendarView = 'month';
        if (calendarContainer) {
            calendarContainer.style.display = 'block';
            calendarContainer.classList.remove('week-view');
        }
        if (listView) listView.classList.remove('active');
        renderCalendar();
    } 
    else if (viewType === 'week') {
        calendarView = 'week';
        if (calendarContainer) {
            calendarContainer.style.display = 'block';
            calendarContainer.classList.add('week-view');
        }
        if (listView) listView.classList.remove('active');
        renderWeekView();
    }
    else if (viewType === 'list') {
        calendarView = 'list';
        if (calendarContainer) {
            calendarContainer.style.display = 'none';
        }
        
        // 목록 뷰 생성 및 표시
        createListView();
        const newListView = document.getElementById('calendarListView');
        if (newListView) {
            newListView.classList.add('active');
        }
        renderListView();
    }
}

// 주간 뷰 렌더링
function renderWeekView() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // 일요일로 설정
    
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    let weekHTML = `
        <!-- 요일 헤더 -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-primary);">
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium); color: var(--error-600);">일</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">월</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">화</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">수</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">목</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">금</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium); color: var(--primary-600);">토</div>
        </div>
        <!-- 주간 뷰 -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr);">`;
    
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const isToday = currentDay.toDateString() === today.toDateString();
        const dayNum = currentDay.getDate();
        
        // 해당 날짜의 할 일 찾기
        const dayTasks = currentTasks.filter(task => {
            if (!task.due_date) return false;
            const taskDate = new Date(task.due_date);
            return taskDate.toDateString() === currentDay.toDateString();
        });
        
        let dayColor = '';
        if (i === 0) dayColor = 'color: var(--error-600);'; // 일요일
        else if (i === 6) dayColor = 'color: var(--primary-600);'; // 토요일
        else dayColor = 'color: var(--text-tertiary);'; // 평일
        
        weekHTML += `
            <div class="calendar-day" data-date="${currentDay.toISOString().split('T')[0]}"
                 style="min-height: 120px; padding: var(--space-2); ${i < 6 ? 'border-right: 1px solid var(--border-primary);' : ''} ${dayColor}">
                <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                    <span style="font-weight: var(--font-semibold); font-size: var(--text-lg);">${dayNum}</span>
                    ${isToday ? '<span class="today-marker">오늘</span>' : ''}
                </div>`;
                
        // 할일을 동그라미로 표시
        dayTasks.forEach(task => {
            const project = currentProjects.find(p => p.id === task.project_id);
            const projectColor = project ? project.color : '#3B82F6';
            
            weekHTML += `
                <div style="display: flex; align-items: center; gap: var(--space-1); margin-bottom: var(--space-1);">
                    <div class="task-dot" style="width: 8px; height: 8px; background-color: ${projectColor}; border-radius: 50%; flex-shrink: 0;"></div>
                    <span style="font-size: var(--text-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${task.title}</span>
                </div>`;
        });
        
        weekHTML += `</div>`;
    }
    
    weekHTML += `</div>`;
    calendarContainer.innerHTML = weekHTML;
}

// 목록 뷰 생성
function createListView() {
    const calendarView = document.getElementById('calendarView');
    if (!calendarView) return;
    
    // 기존 목록 뷰가 있으면 제거
    const existingListView = document.getElementById('calendarListView');
    if (existingListView) {
        existingListView.remove();
    }
    
    const listViewHTML = `
        <div class="calendar-list-view" id="calendarListView">
            <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
                <svg style="width: 1.25rem; height: 1.25rem; color: var(--primary-500);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
                할 일 목록
            </h3>
            <div id="calendarListContent"></div>
        </div>`;
    
    // 캘린더 컨테이너 다음에 추가
    const calendarContainer = document.getElementById('calendarContainer');
    if (calendarContainer) {
        calendarContainer.insertAdjacentHTML('afterend', listViewHTML);
    } else {
        calendarView.insertAdjacentHTML('beforeend', listViewHTML);
    }
}

// 목록 뷰 렌더링
function renderListView() {
    let listView = document.getElementById('calendarListView');
    if (!listView) {
        createListView();
        listView = document.getElementById('calendarListView');
    }
    
    const listContent = document.getElementById('calendarListContent');
    if (!listContent) return;
    
    // 모든 할일을 표시 (마감일 있는 것과 없는 것 모두)
    if (currentTasks.length === 0) {
        listContent.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: var(--space-6);">할 일이 없습니다.</p>';
        return;
    }
    
    // 날짜별로 할일 그룹화
    const tasksByDate = {};
    const tasksWithoutDate = [];
    
    currentTasks.forEach(task => {
        if (task.due_date) {
            const dateKey = task.due_date;
            if (!tasksByDate[dateKey]) {
                tasksByDate[dateKey] = [];
            }
            tasksByDate[dateKey].push(task);
        } else {
            tasksWithoutDate.push(task);
        }
    });
    
    // 날짜순으로 정렬
    const sortedDates = Object.keys(tasksByDate).sort();
    
    let listHTML = '';
    
    // 마감일이 없는 할일들 먼저 표시
    if (tasksWithoutDate.length > 0) {
        listHTML += `
            <div class="calendar-list-item">
                <div class="calendar-list-date">일반</div>
                <div class="calendar-list-tasks">`;
        
        tasksWithoutDate.forEach(task => {
            const project = currentProjects.find(p => p.id === task.project_id);
            const projectColor = project ? project.color : '#3B82F6';
            
            listHTML += `
                <div class="calendar-list-task" onclick="openTaskDetail(${task.id})" style="cursor: pointer;">
                    <div class="calendar-list-task-dot" style="background-color: ${projectColor};"></div>
                    <span>${task.title}</span>
                    <span style="color: var(--text-tertiary); font-size: var(--text-xs);">${project ? project.name : ''}</span>
                </div>`;
        });
        
        listHTML += `
                </div>
            </div>`;
    }
    
    // 마감일이 있는 할일들 표시
    sortedDates.forEach(dateKey => {
        const date = new Date(dateKey);
        const dateStr = date.toLocaleDateString('ko-KR', { 
            month: 'short', 
            day: 'numeric',
            weekday: 'short'
        });
        
        const tasks = tasksByDate[dateKey];
        
        listHTML += `
            <div class="calendar-list-item">
                <div class="calendar-list-date">${dateStr}</div>
                <div class="calendar-list-tasks">`;
        
        tasks.forEach(task => {
            const project = currentProjects.find(p => p.id === task.project_id);
            const projectColor = project ? project.color : '#3B82F6';
            
            listHTML += `
                <div class="calendar-list-task" onclick="openTaskDetail(${task.id})" style="cursor: pointer;">
                    <div class="calendar-list-task-dot" style="background-color: ${projectColor};"></div>
                    <span>${task.title}</span>
                    <span style="color: var(--text-tertiary); font-size: var(--text-xs);">${project ? project.name : ''}</span>
                </div>`;
        });
        
        listHTML += `
                </div>
            </div>`;
    });
    
    if (listHTML === '') {
        listContent.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: var(--space-6);">예정된 할 일이 없습니다.</p>';
    } else {
        listContent.innerHTML = listHTML;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 캘린더 뷰 전환 버튼들
    const monthViewBtn = document.getElementById('monthViewBtn');
    const weekViewBtn = document.getElementById('weekViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (monthViewBtn) {
        monthViewBtn.addEventListener('click', () => switchCalendarView('month'));
    }
    
    if (weekViewBtn) {
        weekViewBtn.addEventListener('click', () => switchCalendarView('week'));
    }
    
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => switchCalendarView('list'));
    }
    
    // 인증 관련
    if (elements.googleLoginBtn) {
        elements.googleLoginBtn.addEventListener('click', handleLogin);
    }
    if (elements.demoBtn) {
        elements.demoBtn.addEventListener('click', handleDemoMode);
    }
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 사용자 메뉴
    if (elements.userMenuBtn) {
        elements.userMenuBtn.addEventListener('click', toggleUserMenu);
    }
    
    document.addEventListener('click', (e) => {
        if (elements.userMenuBtn && !elements.userMenuBtn.contains(e.target)) {
            if (elements.userDropdown) {
                elements.userDropdown.classList.add('d-none');
            }
        }
    });
    
    // 네비게이션
    if (elements.dashboardBtn) {
        elements.dashboardBtn.addEventListener('click', () => switchView('dashboard'));
    }
    if (elements.projectsBtn) {
        elements.projectsBtn.addEventListener('click', () => switchView('projects'));
    }
    if (elements.calendarBtn) {
        elements.calendarBtn.addEventListener('click', () => switchView('calendar'));
    }
    
    // 모달 버튼들
    if (elements.newTaskBtn) {
        elements.newTaskBtn.addEventListener('click', () => openModal('newTaskModal'));
    }
    if (elements.newProjectBtn) {
        elements.newProjectBtn.addEventListener('click', () => openModal('newProjectModal'));
    }
    
    // 색상 선택 이벤트 리스너
    initColorPicker();

    // 캘린더 네비게이션 버튼들
    const calendarPrevBtn = document.querySelector('#calendarView .calendar-controls button:first-child');
    const calendarNextBtn = document.querySelector('#calendarView .calendar-controls button:last-child');
    
    if (calendarPrevBtn) {
        calendarPrevBtn.addEventListener('click', () => moveCalendarDate('prev'));
    }
    if (calendarNextBtn) {
        calendarNextBtn.addEventListener('click', () => moveCalendarDate('next'));
    }

    // 캘린더 뷰 변경 버튼들
    const calendarViewButtons = document.querySelectorAll('#calendarView .calendar-view-buttons button');
    calendarViewButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // 활성 상태 변경
            calendarViewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 뷰 변경
            const views = ['month', 'week', 'list'];
            changeCalendarView(views[index]);
        });
    });
    
    // 작업 상세 모달 버튼들 (헤더) - 편집 버튼 확인
    const editTaskHeaderBtn = document.getElementById('editTaskHeader');
    if (editTaskHeaderBtn) {
        console.log('편집 버튼 발견:', editTaskHeaderBtn);
        editTaskHeaderBtn.onclick = handleTaskEdit; // 새로운 바인딩 방식으로 변경
    } else {
        console.warn('편집 버튼을 찾을 수 없습니다.');
    }
    
    const deleteTaskHeaderBtn = document.getElementById('deleteTaskHeader');
    if (deleteTaskHeaderBtn) {
        deleteTaskHeaderBtn.onclick = handleTaskDelete;
    }
    
    const completeTaskHeaderBtn = document.getElementById('completeTaskHeader');
    if (completeTaskHeaderBtn) {
        completeTaskHeaderBtn.onclick = handleTaskComplete;
    }

    // 댓글 추가 버튼
    const addCommentBtn = document.getElementById('addComment');
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', handleAddComment);
    }
    
    // 모달 하단 버튼들
    const completeTaskBtn = document.getElementById('completeTask');
    if (completeTaskBtn) {
        completeTaskBtn.addEventListener('click', handleTaskComplete);
    }
    
    // 모달 닫기 버튼들
    const closeButtons = [
        'closeNewProjectModal',
        'closeNewTaskModal', 
        'closeTaskDetail',
        'closeTaskDetailBtn',
        'cancelNewProject',
        'cancelNewTask'
    ];
    
    closeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                if (buttonId.includes('Project')) {
                    closeModal('newProjectModal');
                } else if (buttonId.includes('Task')) {
                    closeModal('newTaskModal');
                } else if (buttonId.includes('Detail')) {
                    closeModal('taskDetailModal');
                }
            });
        }
    });
    
    // 폼 제출
    if (elements.newTaskForm) {
        elements.newTaskForm.addEventListener('submit', handleNewTask);
    }
    if (elements.newProjectForm) {
        elements.newProjectForm.addEventListener('submit', handleNewProject);
    }
    
    // 태스크 아이템 클릭 - 메인 대시보드의 할 일 목록에서 클릭
    const taskItems = document.querySelectorAll('.task-item');
    console.log('할일 목록 클릭 이벤트 설정:', taskItems.length, '개의 아이템');
    taskItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.closest('.btn')) return; // 버튼 클릭은 무시
            
            const taskId = this.dataset.taskId;
            console.log('할일 아이템 클릭됨:', { 
                taskId, 
                dataset: this.dataset, 
                element: this 
            });
            
            if (!taskId) {
                console.error('taskId가 없습니다. 기본값 1 사용');
                showNotification('할 일 정보를 찾을 수 없습니다.', 'error');
                return;
            }
            
            openTaskDetail(taskId);
        });
    });
}

// 로그인 처리
async function handleLogin() {
    try {
        if (elements.googleLoginBtn) {
            elements.googleLoginBtn.disabled = true;
            elements.googleLoginBtn.innerHTML = '<div class="spinner"></div> 로그인 중...';
        }
        
        if (!supabase) {
            showNotification('Supabase가 초기화되지 않았습니다. 데모 모드를 이용해주세요.', 'error');
            if (elements.googleLoginBtn) {
                elements.googleLoginBtn.disabled = false;
                elements.googleLoginBtn.innerHTML = 'Google로 계속하기';
            }
            return;
        }
        
        // 파일 프로토콜에서는 OAuth가 작동하지 않을 수 있음을 알림
        if (window.location.protocol === 'file:') {
            const confirmMessage = '파일에서 직접 실행 중입니다. Google 로그인이 제대로 작동하지 않을 수 있습니다.\n\n로컬 서버를 시작하려면:\n1. 터미널에서 "npm run dev" 실행\n2. http://localhost:3000 접속\n\n계속 진행하시겠습니까?';
            if (!confirm(confirmMessage)) {
                if (elements.googleLoginBtn) {
                    elements.googleLoginBtn.disabled = false;
                    elements.googleLoginBtn.innerHTML = 'Google로 계속하기';
                }
                return;
            }
        }
        
        // 배포 환경 감지
        const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
        const isLocalFile = window.location.protocol === 'file:';
        const isLocalhost = window.location.hostname === 'localhost';
        
        // 적절한 리디렉션 URL 설정
        let redirectTo;
        if (isVercel) {
            // Vercel 배포 환경
            redirectTo = window.location.origin;
        } else if (isLocalhost) {
            // 로컬 개발 서버
            redirectTo = 'http://localhost:3000';
        } else if (isLocalFile) {
            // 파일 프로토콜 (로컬에서 파일로 열었을 때)
            redirectTo = 'http://localhost:3000';
        } else {
            // 기타 환경 (커스텀 도메인 등)
            redirectTo = window.location.origin;
        }
            
        console.log('OAuth 로그인 시도:', { 
            redirectTo, 
            isVercel, 
            isLocalhost, 
            isLocalFile,
            origin: window.location.origin
        });
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });
        
        if (error) {
            throw error;
        }
        
    } catch (error) {
        console.error('로그인 실패:', error);
        
        let errorMessage = '로그인에 실패했습니다.';
        if (error.message.includes('popup_closed_by_user')) {
            errorMessage = '로그인이 취소되었습니다.';
        } else if (error.message.includes('network')) {
            errorMessage = '네트워크 연결을 확인해주세요.';
        }
        
        showNotification(errorMessage, 'error');
        if (elements.googleLoginBtn) {
            elements.googleLoginBtn.disabled = false;
            elements.googleLoginBtn.innerHTML = 'Google로 계속하기';
        }
    }
}

// 데모 모드 처리
async function handleDemoMode() {
    try {
        // 버튼 상태 업데이트
        if (elements.demoBtn) {
            elements.demoBtn.disabled = true;
            elements.demoBtn.innerHTML = '<div class="spinner"></div> 데모 모드 시작...';
        }
        
        // 로딩 화면 표시
        showLoading();
        
        // 데모 모드 설정
        isDemoMode = true;
        
        // 데모 사용자 설정
        currentUser = {
            id: 'demo-user',
            email: 'demo@example.com',
            user_metadata: {
                full_name: '데모 사용자'
            }
        };
        
        console.log('데모 사용자 설정 완료');
        
        // 데모 데이터 로드
        await loadDemoData();
        console.log('데모 데이터 로드 완료');
        
        // 사용자 정보 업데이트
        updateUserInfo();
        
        // 메인 앱 표시
        hideLoading();
        showMainApp();
        
        // 대시보드 뷰로 전환
        switchView('dashboard');
        console.log('[SUCCESS] 데모 모드로 시작합니다! 모든 기능을 체험해보세요.');
        
    } catch (error) {
        console.error('데모 모드 초기화 실패:', error);
        hideLoading();
        alert('데모 모드 시작에 실패했습니다.');
        
        if (elements.demoBtn) {
            elements.demoBtn.disabled = false;
            elements.demoBtn.innerHTML = '데모 체험하기';
        }
    }
}

// 인증 상태 확인
async function checkAuthState() {
    try {
        if (!supabase) {
            console.log('Supabase가 초기화되지 않음 - 로그인 화면 표시');
            showLoginScreen();
            return;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('인증 상태 확인 실패:', error);
            showLoginScreen();
            return;
        }

        if (user) {
            console.log('로그인된 사용자 발견:', user.email);
            currentUser = user;
            await initializeUserData();
            showMainApp();
            switchView('dashboard');
        } else {
            console.log('로그인되지 않은 상태');
            showLoginScreen();
        }
    } catch (error) {
        console.error('인증 상태 확인 중 오류:', error);
        showLoginScreen();
    }
}

// 사용자 데이터 초기화
async function initializeUserData() {
    try {
        // 프로필 정보 가져오기 또는 생성
        await ensureUserProfile();
        
        // 워크스페이스 가져오기 또는 생성
        await ensureUserWorkspace();
        
        // 프로젝트 및 할일 데이터 로드
        await loadUserData();
        
        // 사용자 정보 UI 업데이트
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
        // 프로필 생성
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
    // 사용자가 속한 워크스페이스 찾기
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
        // 새 워크스페이스 생성
        const { data: workspace, error: wsError } = await supabase
            .from('workspaces')
            .insert({
                name: `${currentUser.user_metadata?.full_name || currentUser.email}의 워크스페이스`,
                description: '개인 작업 공간',
                created_by: currentUser.id
            })
            .select()
            .single();

        if (wsError) {
            throw wsError;
        }

        // 워크스페이스 멤버로 추가
        const { error: memberInsertError } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: workspace.id,
                user_id: currentUser.id,
                role: 'owner'
            });

        if (memberInsertError) {
            throw memberInsertError;
        }

        currentWorkspace = workspace;
    }
}

// 사용자 데이터 로드
async function loadUserData() {
    if (!currentWorkspace) return;

    // 프로젝트 로드
    const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

    if (projectError) {
        throw projectError;
    }

    currentProjects = projects || [];

    // 할일 로드
    const { data: todos, error: todoError } = await supabase
        .from('todos')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

    if (todoError) {
        throw todoError;
    }

    currentTasks = todos || [];

    // 댓글 로드
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
    
    // 데이터 로드 후 UI 업데이트
    updateDashboard();
    updateProjectsView();
    renderCalendar();
    
    // 이벤트 리스너 재설정 (데이터 로드 후 필요)
    setupEventListeners();
}

// 로그아웃 처리
async function handleLogout() {
    try {
        if (!isDemoMode && supabase) {
            await supabase.auth.signOut();
        }
        
        // 상태 초기화
        currentUser = null;
        currentWorkspace = null;
        currentProjects = [];
        currentTasks = [];
        currentComments = [];
        isDemoMode = false;
        
        // 로컬 스토리지 클리어
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
    if (elements.dashboardView) elements.dashboardView.classList.add('d-none');
    if (elements.projectsView) elements.projectsView.classList.add('d-none');
    if (elements.calendarView) elements.calendarView.classList.add('d-none');
    
    // 네비게이션 버튼 상태 업데이트
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
    });
    
    // 선택된 뷰 표시 및 버튼 활성화
    if (view === 'dashboard') {
        if (elements.dashboardView) elements.dashboardView.classList.remove('d-none');
        if (elements.dashboardBtn) {
            elements.dashboardBtn.classList.remove('btn-ghost');
            elements.dashboardBtn.classList.add('btn-primary');
        }
    } else if (view === 'projects') {
        if (elements.projectsView) elements.projectsView.classList.remove('d-none');
        if (elements.projectsBtn) {
            elements.projectsBtn.classList.remove('btn-ghost');
            elements.projectsBtn.classList.add('btn-primary');
        }
    } else if (view === 'calendar') {
        if (elements.calendarView) elements.calendarView.classList.remove('d-none');
        if (elements.calendarBtn) {
            elements.calendarBtn.classList.remove('btn-ghost');
            elements.calendarBtn.classList.add('btn-primary');
        }
    }
}

// 사용자 메뉴 토글
function toggleUserMenu() {
    if (elements.userDropdown) {
        elements.userDropdown.classList.toggle('d-none');
    }
}

// 사용자 정보 업데이트
function updateUserInfo() {
    if (!currentUser) return;
    
    const displayName = currentUser.user_metadata?.full_name || currentUser.email;
    if (elements.userEmail) {
        elements.userEmail.textContent = displayName;
    }
}

// 알림 표시
function showNotification(message, type = 'info') {
    // 간단한 알림 구현
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 할 일 추가 처리
async function handleNewTask(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const taskProject = formData.get('taskProject') || document.getElementById('taskProject')?.value;
    const taskTitle = formData.get('taskTitle') || document.getElementById('taskTitle')?.value;
    const taskDescription = formData.get('taskDescription') || document.getElementById('taskDescription')?.value;
    const taskStartDate = formData.get('taskStartDate') || document.getElementById('taskStartDate')?.value;
    const taskDueDate = formData.get('taskDueDate') || document.getElementById('taskDueDate')?.value;
    
    // 우선순위 값 가져오기
    const selectedPriority = document.querySelector('.priority-option.selected');
    const taskPriority = selectedPriority ? selectedPriority.dataset.priority : 'medium';
    
    if (!taskProject || !taskTitle?.trim()) {
        showNotification('프로젝트와 할 일 제목을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        // 새 할 일 ID 생성
        const newTaskId = Math.max(...currentTasks.map(t => t.id), 0) + 1;
        
        const newTask = {
            id: newTaskId,
            title: taskTitle.trim(),
            description: taskDescription?.trim() || '',
            project_id: parseInt(taskProject),
            status: 'pending',
            priority: taskPriority,
            start_date: taskStartDate || null,
            due_date: taskDueDate || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            assignee: currentUser?.user_metadata?.full_name || '데모 사용자'
        };
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 스토리지에 저장
            currentTasks.push(newTask);
            localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
        } else if (supabase && currentWorkspace) {
            // Supabase에 저장
            const { data, error } = await supabase
                .from('todos')
                .insert([{
                    title: taskTitle.trim(),
                    description: taskDescription?.trim() || '',
                    project_id: parseInt(taskProject),
                    status: 'pending',
                    priority: taskPriority,
                    start_date: taskStartDate || null,
                    due_date: taskDueDate || null,
                    workspace_id: currentWorkspace.id,
                    created_by: currentUser?.id,
                    assigned_to: currentUser?.id
                }])
                .select()
                .single();
                
            if (error) throw error;
            
            // 로컬 배열에 실제 데이터 추가
            currentTasks.push(data);
        }
        
        // UI 업데이트
        updateProjectsView();
        updateDashboard();
        renderCalendar();
        
        closeModal('newTaskModal');
        form.reset();
        
        // 우선순위 선택 초기화
        document.querySelectorAll('.priority-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector('.priority-option[data-priority="high"]')?.classList.add('selected');
        
        showNotification('할 일이 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('할 일 추가 실패:', error);
        showNotification('할 일 추가에 실패했습니다.', 'error');
    }
}

// 프로젝트 추가 처리
async function handleNewProject(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const projectName = formData.get('projectName')?.trim();
    const projectDescription = formData.get('projectDescription')?.trim();
    const projectColor = formData.get('projectColor') || '#3B82F6';
    const projectStartDate = formData.get('projectStartDate');
    const projectDueDate = formData.get('projectDueDate');
    
    if (!projectName) {
        showNotification('프로젝트 이름을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        // 새 프로젝트 ID 생성
        const newProjectId = Math.max(...currentProjects.map(p => p.id), 0) + 1;
        
        const newProject = {
            id: newProjectId,
            name: projectName,
            description: projectDescription || '',
            color: projectColor,
            status: 'planning',
            progress: 0,
            start_date: projectStartDate || null,
            due_date: projectDueDate || null,
            total_tasks: 0,
            completed_tasks: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 스토리지에 저장
            currentProjects.push(newProject);
            localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
        } else if (supabase && currentWorkspace) {
            // Supabase에 저장
            const { data, error } = await supabase
                .from('projects')
                .insert([{
                    name: projectName,
                    description: projectDescription || '',
                    color: projectColor,
                    workspace_id: currentWorkspace.id,
                    created_by: currentUser.id
                }])
                .select()
                .single();
                
            if (error) throw error;
            
            // 로컬 배열에 실제 데이터 추가
            currentProjects.push(data);
        }
        
        // UI 업데이트
        updateProjectsView();
        updateDashboard();
        renderCalendar();
        
        closeModal('newProjectModal');
        form.reset();
        
        // 색상 선택 초기화
        const colorOptions = document.querySelectorAll('#newProjectModal .color-option');
        colorOptions.forEach(option => option.classList.remove('selected'));
        const firstColorOption = document.querySelector('#newProjectModal .color-option');
        if (firstColorOption) {
            firstColorOption.classList.add('selected');
            const colorInput = document.getElementById('projectColor');
            if (colorInput) {
                colorInput.value = firstColorOption.dataset.color;
            }
        }
        
        showNotification('프로젝트가 생성되었습니다.', 'success');
        
    } catch (error) {
        console.error('프로젝트 생성 실패:', error);
        showNotification('프로젝트 생성에 실패했습니다.', 'error');
    }
}

// 데모 데이터 로드
async function loadDemoData() {
    // 로컬스토리지에서 데이터 복원 시도
    let storedProjects = localStorage.getItem('demo_projects');
    let storedTasks = localStorage.getItem('demo_tasks');
    let storedComments = localStorage.getItem('demo_comments');
    
    // 저장된 데이터가 있으면 사용, 없으면 기본 데이터 사용
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
    
    updateUserInfo();
    
    // UI 초기화
    updateProjectsView();
    updateDashboard();
    initCalendar();
    
    // 로컬스토리지에 데이터 저장
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
    // 데모용 프로젝트 데이터
    currentProjects = [
        { 
            id: 1, 
            name: '웹사이트 리뉴얼', 
            color: 'blue', 
            description: '회사 웹사이트 전면 리뉴얼 프로젝트',
            status: 'in_progress',
            progress: 50,
            start_date: '2025-07-01',
            due_date: '2025-07-15',
            total_tasks: 2,
            completed_tasks: 1
        },
        { 
            id: 2, 
            name: '모바일 앱 개발', 
            color: 'green', 
            description: '신규 모바일 애플리케이션 개발',
            status: 'planning',
            progress: 10,
            start_date: '2025-07-10',
            due_date: '2025-08-30',
            total_tasks: 5,
            completed_tasks: 0
        }
    ];
    
    // 데모용 할 일 데이터
    currentTasks = [
        { 
            id: 1, 
            title: 'UI/UX 디자인 시안 작성', 
            project_id: 1, 
            status: 'in_progress',
            priority: 'high',
            description: '메인 페이지와 서브 페이지 디자인 시안을 작성합니다.',
            start_date: '2025-07-04',
            due_date: '2025-07-05',
            created_at: '2025-07-04T12:38:36',
            assignee: '데모 사용자'
        },
        { 
            id: 2, 
            title: '프론트엔드 개발', 
            project_id: 1, 
            status: 'pending',
            priority: 'medium',
            description: '디자인 시안을 바탕으로 HTML, CSS, JavaScript 개발',
            start_date: '2025-07-06',
            due_date: '2025-07-10',
            created_at: '2025-07-04T12:40:22',
            assignee: '데모 사용자'
        },
        { 
            id: 3, 
            title: '요구사항 분석', 
            project_id: 2, 
            status: 'pending',
            priority: 'high',
            description: '사용자 요구사항 분석 및 정의',
            start_date: '2025-07-10',
            due_date: '2025-07-15',
            created_at: '2025-07-04T12:45:18',
            assignee: '데모 사용자'
        }
    ];
    
    // 데모용 댓글 데이터
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

// 캘린더 초기화
function initCalendar() {
    renderCalendar();
    console.log('캘린더 초기화 완료');
}

// 캘린더 렌더링
function renderCalendar() {
    const calendarContainer = document.querySelector('#calendarView .calendar-container');
    if (!calendarContainer) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 월/연도 표시 업데이트
    const monthYearDisplay = document.querySelector('#calendarView .calendar-controls h3');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = `${year}년 ${month + 1}월`;
    }

    // 현재 월의 첫째 날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 캘린더 시작일 (이전 월의 마지막 주 포함)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // 캘린더 종료일 (다음 월의 첫째 주 포함)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41); // 6주 표시

    let calendarHTML = `
        <!-- 요일 헤더 -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-primary);">
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium); color: var(--error-600);">일</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">월</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">화</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">수</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">목</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium);">금</div>
            <div style="padding: var(--space-2); text-align: center; font-weight: var(--font-medium); color: var(--primary-600);">토</div>
        </div>`;

    // 6주 표시
    for (let week = 0; week < 6; week++) {
        calendarHTML += `<div style="display: grid; grid-template-columns: repeat(7, 1fr); ${week < 5 ? 'border-bottom: 1px solid var(--border-primary);' : ''}">`;
        
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
            
            // 날짜 범위에 포함된 태스크 찾기 (시작일-마감일 사이)
            const rangeInTasks = currentTasks.filter(task => {
                if (!task.start_date || !task.due_date) return false;
                const startDate = new Date(task.start_date);
                const dueDate = new Date(task.due_date);
                const currentDate = new Date(currentCalendarDate);
                
                // 날짜가 시작일과 마감일 사이에 있는지 확인 (시작일, 마감일 포함)
                return currentDate >= startDate && currentDate <= dueDate;
            });

            let dayColor = '';
            if (day === 0) dayColor = 'color: var(--error-600);'; // 일요일
            else if (day === 6) dayColor = 'color: var(--primary-600);'; // 토요일
            else if (!isCurrentMonth) dayColor = 'color: var(--text-quaternary);'; // 다른 월
            else dayColor = 'color: var(--text-tertiary);'; // 평일
            
            // 날짜 범위에 포함되는지 확인
            const isInRange = rangeInTasks.length > 0;
            // 범위의 시작일인지 확인
            const isRangeStart = rangeInTasks.some(task => {
                const startDate = new Date(task.start_date);
                return startDate.toDateString() === currentCalendarDate.toDateString();
            });
            // 범위의 마감일인지 확인
            const isRangeEnd = rangeInTasks.some(task => {
                const dueDate = new Date(task.due_date);
                return dueDate.toDateString() === currentCalendarDate.toDateString();
            });
            
            // 범위 스타일 설정
            let rangeStyle = '';
            if (isInRange) {
                rangeStyle = 'position: relative; ';
                if (isRangeStart && isRangeEnd) {
                    rangeStyle += 'border: 2px solid var(--primary-500); border-radius: var(--radius-lg); ';
                } else if (isRangeStart) {
                    rangeStyle += 'border: 2px solid var(--primary-500); border-radius: var(--radius-lg) 0 0 var(--radius-lg); border-right: none; ';
                } else if (isRangeEnd) {
                    rangeStyle += 'border: 2px solid var(--primary-500); border-radius: 0 var(--radius-lg) var(--radius-lg) 0; border-left: none; ';
                } else {
                    rangeStyle += 'border-top: 2px solid var(--primary-500); border-bottom: 2px solid var(--primary-500); ';
                }
            }

            calendarHTML += `
                <div class="calendar-day ${isCurrentMonth ? 'current-month' : 'other-month'} ${isInRange ? 'date-in-range' : ''}" 
                     data-date="${currentCalendarDate.toISOString().split('T')[0]}"
                     style="${rangeStyle}min-height: 100px; padding: var(--space-1); ${day < 6 ? 'border-right: 1px solid var(--border-primary);' : ''} ${dayColor} cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                        <span style="font-weight: ${isCurrentMonth ? 'var(--font-medium)' : 'var(--font-normal)'};">${dayNum}</span>
                        ${isToday ? '<span class="today-marker" style="background-color: var(--primary-500); color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px;">오늘</span>' : ''}
                    </div>`;

            // 할 일을 작은 점으로 표시
            if (dayTasks.length > 0) {
                calendarHTML += `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: var(--space-1);">`;
                
                // 최대 6개까지 점으로 표시
                const maxDots = Math.min(dayTasks.length, 6);
                for (let i = 0; i < maxDots; i++) {
                    const task = dayTasks[i];
                    const project = currentProjects.find(p => p.id === task.project_id);
                    const projectColor = project ? project.color : '#3B82F6';
                    
                    calendarHTML += `
                        <div class="task-dot" 
                             data-task-id="${task.id}"
                             style="width: 8px; height: 8px; border-radius: 50%; background-color: ${projectColor}; cursor: pointer;"
                             title="${task.title}"></div>`;
                }
                
                // 더 많은 할일이 있으면 +표시
                if (dayTasks.length > 6) {
                    calendarHTML += `<div style="font-size: 10px; color: var(--text-tertiary); margin-left: 2px;">+${dayTasks.length - 6}</div>`;
                }
                
                calendarHTML += `</div>`;
            }

            calendarHTML += `</div>`;
        }
        
        calendarHTML += `</div>`;
    }

    calendarContainer.innerHTML = calendarHTML;

    // 이벤트 리스너 추가
    addCalendarEventListeners();
}

// 캘린더 이벤트 리스너 추가
function addCalendarEventListeners() {
    // 날짜 클릭 이벤트
    document.querySelectorAll('.calendar-day').forEach(dayElement => {
        dayElement.addEventListener('click', function(e) {
            // 이벤트 버블링 방지
            if (e.target.classList.contains('calendar-event')) return;
            
            const date = this.dataset.date;
            showDayTasks(date);
        });
    });

    // 할 일 클릭 이벤트
    document.querySelectorAll('.calendar-event').forEach(eventElement => {
        eventElement.addEventListener('click', function(e) {
            e.stopPropagation();
            const taskId = this.dataset.taskId;
            openTaskDetail(taskId);
        });
    });
}

// 특정 날짜의 할 일 목록 표시 (범위 내 할일 포함)
function showDayTasks(date) {
    const selectedDate = new Date(date);
    
    // 선택된 날짜에 마감일이 있는 할일 + 범위 내에 포함된 할일
    const dayTasks = currentTasks.filter(task => {
        // 마감일이 선택된 날짜와 같은 할일
        if (task.due_date) {
            const taskDate = new Date(task.due_date);
            if (taskDate.toDateString() === selectedDate.toDateString()) {
                return true;
            }
        }
        
        // 시작일과 마감일 사이 범위에 선택된 날짜가 포함된 할일
        if (task.start_date && task.due_date) {
            const startDate = new Date(task.start_date);
            const dueDate = new Date(task.due_date);
            return selectedDate >= startDate && selectedDate <= dueDate;
        }
        
        return false;
    });

    if (dayTasks.length === 0) {
        showNotification('선택한 날짜에 할 일이 없습니다.', 'info');
        return;
    }

    // 날짜별 할 일 목록 모달 표시
    showDayTasksModal(selectedDate, dayTasks);
}

// 날짜별 할 일 목록 모달 표시
function showDayTasksModal(date, tasks) {
    const dateStr = date.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    });

    const modalHTML = `
        <div id="dayTasksModal" class="modal show">
            <div class="modal-container modal-lg">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <svg style="width: 1.5rem; height: 1.5rem; color: var(--primary-500); margin-right: var(--space-2);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        ${dateStr}
                    </h3>
                    <button type="button" class="modal-close" onclick="closeModal('dayTasksModal')">
                        <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: var(--space-4);">
                        <p style="color: var(--text-secondary);">총 ${tasks.length}개의 할 일이 있습니다.</p>
                    </div>
                    <div class="task-list" style="max-height: 450px; overflow-y: auto;">
                        ${tasks.map(task => {
                            const project = currentProjects.find(p => p.id === task.project_id);
                            const projectName = project ? project.name : '프로젝트 없음';
                            const projectColor = project ? project.color : '#6B7280';
                            
                            return `
                                <div class="task-item" data-task-id="${task.id}" style="border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-3); cursor: pointer; transition: all 0.2s ease; background-color: var(--bg-primary);">
                                    <div style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: var(--space-2);">
                                        <div style="flex: 1;">
                                            <h4 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-1);">${task.title}</h4>
                                            <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">${task.description || '설명 없음'}</p>
                                            <div style="display: flex; align-items: center; gap: var(--space-3);">
                                                <span style="display: inline-flex; align-items: center; gap: var(--space-1); padding: 2px 8px; background-color: ${projectColor}20; color: ${projectColor}; border-radius: var(--radius-full); font-size: var(--text-xs);">
                                                    <div style="width: 6px; height: 6px; background-color: ${projectColor}; border-radius: 50%;"></div>
                                                    ${projectName}
                                                </span>
                                                <span class="priority-badge priority-${task.priority}" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: var(--text-xs);">
                                                    ${task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                                                </span>
                                                <span class="status-badge status-${task.status}" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: var(--text-xs);">
                                                    ${task.status === 'todo' ? '대기' : task.status === 'doing' ? '진행' : '완료'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('dayTasksModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 모달을 body에 추가
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 할 일 아이템 클릭 이벤트 추가
    document.querySelectorAll('#dayTasksModal .task-item').forEach(item => {
        item.addEventListener('click', function() {
            const taskId = this.dataset.taskId;
            closeModal('dayTasksModal');
            openTaskDetail(taskId);
        });
        
        // 호버 효과 추가
        item.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--primary-300)';
            this.style.backgroundColor = 'var(--bg-secondary)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border-primary)';
            this.style.backgroundColor = 'var(--bg-primary)';
        });
    });
}

// 할 일 상세 보기 열기
function openTaskDetail(taskId) {
    console.log('할 일 상세 보기 호출됨:', taskId, typeof taskId);
    
    if (!taskId) {
        console.error('taskId가 제공되지 않았습니다.');
        showNotification('할 일을 찾을 수 없습니다.', 'error');
        return;
    }
    
    // ID 정규화 - 문자열과 숫자 모두 지원
    let normalizedTaskId = taskId;
    if (typeof taskId === 'string') {
        // 문자열이 숫자로 변환 가능한지 확인
        const parsed = parseInt(taskId);
        if (!isNaN(parsed)) {
            normalizedTaskId = parsed;
        }
    }
    
    console.log('할 일 검색 전 currentTasks:', currentTasks.map(t => ({ id: t.id, type: typeof t.id, title: t.title })));
    
    // 두 가지 방법으로 task 검색 (원본 ID와 정규화된 ID 모두 시도)
    let task = currentTasks.find(t => t.id === taskId) || 
               currentTasks.find(t => t.id === normalizedTaskId) ||
               currentTasks.find(t => String(t.id) === String(taskId));
    
    if (!task) {
        console.error('해당 ID의 작업을 찾을 수 없습니다:', { 
            원본ID: taskId, 
            정규화ID: normalizedTaskId,
            현재작업수: currentTasks.length,
            작업ID목록: currentTasks.map(t => ({ id: t.id, type: typeof t.id, title: t.title }))
        });
        
        // 첫 번째 할 일을 기본으로 사용 (테스트용)
        if (currentTasks.length > 0) {
            task = currentTasks[0];
            console.log('첫 번째 할 일을 대체로 사용합니다:', task);
        } else {
            showNotification('선택한 할 일을 찾을 수 없습니다.', 'error');
            return;
        }
    }

    console.log('작업 찾음:', task);
    currentTaskId = task.id; // 실제 task의 ID 사용
    populateTaskDetailModal(task);
    openModal('taskDetailModal');
}

// 작업 편집 핸들러
function handleTaskEdit() {
    if (!currentTaskId) {
        showNotification('편집할 작업이 선택되지 않았습니다.', 'warning');
        return;
    }
    
    const task = currentTasks.find(t => t.id === currentTaskId);
    if (!task) {
        showNotification('작업을 찾을 수 없습니다.', 'error');
        return;
    }
    
    console.log('작업 편집 시작:', currentTaskId);
    
    // 편집 모드로 전환
    enableTaskEditMode(task);
    
    // 디버깅용 알림
    showNotification('편집 모드가 활성화되었습니다.', 'info');
}

// 작업 편집 모드 활성화
function enableTaskEditMode(task) {
    console.log('편집 모드 활성화:', task);
    
    if (!task) {
        console.error('편집할 작업 데이터가 없습니다.');
        showNotification('편집할 작업 데이터가 없습니다.', 'error');
        return;
    }
    
    // 디버깅: 요소 확인
    console.log('제목 요소:', document.getElementById('taskDetailMainTitle'));
    console.log('설명 요소:', document.getElementById('taskDetailDescription'));
    console.log('시작일 요소:', document.getElementById('taskDetailStartDate'));
    console.log('마감일 요소:', document.getElementById('taskDetailDueDate'));
    console.log('프로젝트 요소:', document.getElementById('taskDetailProject'));
    
    // 먼저 기존의 취소 버튼이 있으면 제거
    const existingCancelBtn = document.getElementById('cancelEditBtn');
    if (existingCancelBtn) {
        existingCancelBtn.remove();
    }
    
    // 제목 편집 가능하게 만들기
    const titleElement = document.getElementById('taskDetailMainTitle');
    if (titleElement) {
        const currentTitle = titleElement.textContent.trim();
        titleElement.innerHTML = `<input type="text" id="editTaskTitle" class="form-control" value="${currentTitle}" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">`;
        
        // Enter 키로 저장, Esc 키로 취소
        const titleInput = document.getElementById('editTaskTitle');
        if (titleInput) {
            titleInput.focus();
            titleInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveTaskEdit(task);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTaskEdit(task);
                }
            });
        }
    } else {
        console.error('제목 요소를 찾을 수 없습니다.');
    }
    
    // 프로젝트 선택 가능하게 만들기
    const projectElement = document.getElementById('taskDetailProject');
    if (projectElement) {
        let projectOptions = '';
        currentProjects.forEach(project => {
            const selected = project.id === task.project_id ? 'selected' : '';
            projectOptions += `<option value="${project.id}" ${selected}>${project.name}</option>`;
        });
        
        projectElement.innerHTML = `
            <select id="editTaskProject" class="form-control" style="background-color: #fff3cd; border-color: #ffeaa7; color: black; font-size: var(--text-xs); padding: 2px 5px;">
                ${projectOptions}
            </select>
        `;
    } else {
        console.error('프로젝트 요소를 찾을 수 없습니다.');
    }
    
    // 설명 편집 가능하게 만들기
    const descriptionElement = document.getElementById('taskDetailDescription');
    if (descriptionElement) {
        const currentDescription = descriptionElement.textContent.trim();
        descriptionElement.innerHTML = `<textarea id="editTaskDescription" class="form-control" rows="3" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">${currentDescription}</textarea>`;
        
        const descriptionTextarea = document.getElementById('editTaskDescription');
        if (descriptionTextarea) {
            descriptionTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveTaskEdit(task);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTaskEdit(task);
                }
            });
        }
    } else {
        console.error('설명 요소를 찾을 수 없습니다.');
    }
    
    // 시작일 편집 가능하게 만들기
    const startDateElement = document.getElementById('taskDetailStartDate');
    if (startDateElement) {
        const currentStartDate = task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '';
        startDateElement.innerHTML = `<input type="date" id="editTaskStartDate" class="form-control" value="${currentStartDate}" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">`;
    } else {
        console.error('시작일 요소를 찾을 수 없습니다.');
    }
    
    // 마감일 편집 가능하게 만들기
    const dueDateElement = document.getElementById('taskDetailDueDate');
    if (dueDateElement) {
        const currentDueDate = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '';
        dueDateElement.innerHTML = `<input type="date" id="editTaskDueDate" class="form-control" value="${currentDueDate}" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">`;
    } else {
        console.error('마감일 요소를 찾을 수 없습니다.');
    }
    
    // 편집 버튼을 저장 버튼으로 변경
    const editBtn = document.getElementById('editTaskHeader');
    if (editBtn) {
        editBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        editBtn.title = '저장';
        editBtn.style.backgroundColor = 'var(--success-500)';
        editBtn.style.color = 'white';
        
        // 함수 직접 정의로 변경
        editBtn.onclick = function() {
            console.log('저장 버튼 클릭됨');
            saveTaskEdit(task);
        };
    } else {
        console.error('편집 버튼을 찾을 수 없습니다.');
    }
    
    // 취소 버튼 추가
    const headerButtons = document.querySelector('#taskDetailModal .modal-header > div:last-child');
    if (headerButtons) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-ghost btn-sm';
        cancelBtn.title = '취소';
        cancelBtn.style.color = 'var(--error-600)';
        cancelBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
        
        // 함수 직접 정의로 변경
        cancelBtn.onclick = function() {
            console.log('취소 버튼 클릭됨');
            cancelTaskEdit(task);
        };
        
        // 추가하기 전에 이미 있는지 확인
        if (!document.getElementById('cancelEditBtn')) {
            // 편집 버튼 바로 다음에 삽입
            headerButtons.insertBefore(cancelBtn, editBtn.nextSibling);
            console.log('취소 버튼 추가됨');
        }
    } else {
        console.error('헤더 버튼 컨테이너를 찾을 수 없습니다.');
    }
    
    console.log('편집 모드 UI 변경 완료');
    showNotification('편집 모드가 활성화되었습니다. Enter로 저장, Esc로 취소하세요.', 'info');
}

// 작업 제목 저장
async function saveTaskTitle(taskId, newTitle) {
    if (!newTitle.trim()) {
        showNotification('제목을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        if (isDemoMode) {
            const taskIndex = currentTasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].title = newTitle.trim();
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
            }
        } else if (supabase) {
            const { error } = await supabase
                .from('todos')
                .update({ title: newTitle.trim() })
                .eq('id', taskId);
                
            if (error) throw error;
            
            const taskIndex = currentTasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].title = newTitle.trim();
            }
        }
        
        showNotification('제목이 저장되었습니다.', 'success');
    } catch (error) {
        console.error('제목 저장 실패:', error);
        showNotification('제목 저장에 실패했습니다.', 'error');
    }
}

// 작업 편집 저장
async function saveTaskEdit(task) {
    const titleInput = document.getElementById('editTaskTitle');
    const descriptionTextarea = document.getElementById('editTaskDescription');
    const startDateInput = document.getElementById('editTaskStartDate');
    const dueDateInput = document.getElementById('editTaskDueDate');
    const projectSelect = document.getElementById('editTaskProject');
    
    if (!titleInput || !descriptionTextarea) {
        showNotification('편집 중인 내용을 찾을 수 없습니다.', 'error');
        return;
    }
    
    const newTitle = titleInput.value.trim();
    const newDescription = descriptionTextarea.value.trim();
    const newStartDate = startDateInput ? startDateInput.value : task.start_date;
    const newDueDate = dueDateInput ? dueDateInput.value : task.due_date;
    const newProjectId = projectSelect ? projectSelect.value : task.project_id;
    
    if (!newTitle) {
        showNotification('제목을 입력해주세요.', 'warning');
        titleInput.focus();
        return;
    }
    
    try {
        console.log('작업 저장 시작:', {
            id: task.id,
            title: newTitle,
            description: newDescription,
            project_id: newProjectId,
            start_date: newStartDate || null,
            due_date: newDueDate || null
        });
        
        const updateData = {
            title: newTitle,
            description: newDescription,
            project_id: newProjectId,
            start_date: newStartDate || null,
            due_date: newDueDate || null,
            updated_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            console.log('데모 모드에서 작업 저장:', updateData);
            const taskIndex = currentTasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                Object.assign(currentTasks[taskIndex], updateData);
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                console.log('로컬 스토리지에 저장 완료');
            }
        } else if (supabase) {
            console.log('Supabase에 작업 저장:', task.id, updateData);
            const { data, error } = await supabase
                .from('todos')
                .update(updateData)
                .eq('id', task.id)
                .select();
                
            if (error) {
                console.error('Supabase 작업 저장 오류:', error);
                throw error;
            }
            
            console.log('Supabase 작업 저장 결과:', data);
            
            const taskIndex = currentTasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                Object.assign(currentTasks[taskIndex], updateData);
            }
        }
        
        // 편집 모드 종료하고 일반 모드로 복원
        disableTaskEditMode();
        const updatedTask = currentTasks.find(t => t.id === task.id);
        if (updatedTask) {
            populateTaskDetailModal(updatedTask);
        }
        
        // UI 업데이트
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        renderCalendar();
        
        showNotification('작업이 저장되었습니다.', 'success');
        
    } catch (error) {
        console.error('작업 저장 실패:', error);
        showNotification('작업 저장에 실패했습니다.', 'error');
    }
}

// 작업 편집 취소
function cancelTaskEdit(task) {
    // 편집 모드 종료하고 원래 내용으로 복원
    disableTaskEditMode();
    populateTaskDetailModal(task);
    showNotification('편집이 취소되었습니다.', 'info');
}

// 편집 모드 비활성화
function disableTaskEditMode() {
    // 취소 버튼 제거
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
    
    // 편집 버튼 원래대로 복원
    const editBtn = document.getElementById('editTaskHeader');
    if (editBtn) {
        editBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        `;
        editBtn.title = '작업 편집';
        editBtn.style.backgroundColor = '';
        editBtn.style.color = '';
        editBtn.onclick = () => handleTaskEdit();
    }
}

// 작업 삭제 핸들러
async function handleTaskDelete() {
    if (!currentTaskId) return;
    
    if (!confirm('정말로 이 작업을 삭제하시겠습니까?')) return;
    
    try {
        console.log('작업 삭제 시작:', currentTaskId);
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 삭제
            currentTasks = currentTasks.filter(task => task.id !== currentTaskId);
            localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
            showNotification('작업이 삭제되었습니다.', 'success');
        } else if (supabase) {
            // Supabase에서 삭제
            const { error } = await supabase
                .from('todos')
                .delete()
                .eq('id', currentTaskId);
                
            if (error) throw error;
            
            // 로컬 상태에서도 제거
            currentTasks = currentTasks.filter(task => task.id !== currentTaskId);
            showNotification('작업이 삭제되었습니다.', 'success');
        }
        
        // 모달 닫기 및 UI 업데이트
        closeModal('taskDetailModal');
        
        // 대시보드 및 캘린더 업데이트
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        renderCalendar();
        
    } catch (error) {
        console.error('작업 삭제 실패:', error);
        showNotification('작업 삭제에 실패했습니다.', 'error');
    }
}

// 작업 완료 핸들러
async function handleTaskComplete() {
    if (!currentTaskId) return;
    
    try {
        console.log('작업 완료 처리 시작:', currentTaskId);
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 업데이트
            const taskIndex = currentTasks.findIndex(task => task.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = 'completed';
                currentTasks[taskIndex].completed_at = new Date().toISOString();
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                showNotification('작업이 완료되었습니다!', 'success');
            }
        } else if (supabase) {
            // Supabase에서 업데이트
            const { error } = await supabase
                .from('todos')
                .update({ 
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', currentTaskId);
                
            if (error) throw error;
            
            // 로컬 상태도 업데이트
            const taskIndex = currentTasks.findIndex(task => task.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = 'completed';
                currentTasks[taskIndex].completed_at = new Date().toISOString();
            }
            
            showNotification('작업이 완료되었습니다!', 'success');
        }
        
        // 모달 닫기 및 UI 업데이트
        closeModal('taskDetailModal');
        
        // 대시보드 및 캘린더 업데이트
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        renderCalendar();
        
    } catch (error) {
        console.error('작업 완료 처리 실패:', error);
        showNotification('작업 완료 처리에 실패했습니다.', 'error');
    }
}



// 작업 상세 모달 데이터 채우기
function populateTaskDetailModal(task) {
    if (!task) {
        console.error('작업 데이터가 없습니다.');
        return;
    }

    console.log('작업 상세 모달 데이터 채우기:', task);

    // 기본 정보 업데이트
    const titleElement = document.getElementById('taskDetailTitle');
    const mainTitleElement = document.getElementById('taskDetailMainTitle');
    const descriptionElement = document.getElementById('taskDetailDescription');
    const projectElement = document.getElementById('taskDetailProject');
    const priorityElement = document.getElementById('taskDetailPriority');
    const statusElement = document.getElementById('taskDetailStatus');
    const startDateElement = document.getElementById('taskDetailStartDate');
    const dueDateElement = document.getElementById('taskDetailDueDate');
    const createdElement = document.getElementById('taskDetailCreated');
    const assigneeElement = document.getElementById('taskDetailAssignee');
    
    // 요소들이 실제로 존재하는지 확인
    const missingElements = [];
    const elementMap = {
        'taskDetailTitle': titleElement,
        'taskDetailMainTitle': mainTitleElement,
        'taskDetailDescription': descriptionElement,
        'taskDetailProject': projectElement,
        'taskDetailPriority': priorityElement,
        'taskDetailStatus': statusElement,
        'taskDetailStartDate': startDateElement,
        'taskDetailDueDate': dueDateElement
    };
    
    Object.entries(elementMap).forEach(([id, element]) => {
        if (!element) {
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('다음 요소들을 찾을 수 없습니다:', missingElements);
        showNotification('할 일 상세 정보를 표시하는 중 오류가 발생했습니다.', 'error');
        return;
    }
    
    // 버튼 요소 가져오기
    const editTaskHeaderBtn = document.getElementById('editTaskHeader');
    const deleteTaskHeaderBtn = document.getElementById('deleteTaskHeader');
    const completeTaskHeaderBtn = document.getElementById('completeTaskHeader');
    const closeTaskDetailBtn = document.getElementById('closeTaskDetail');
    const addCommentBtn = document.getElementById('addComment');
    const completeTaskBtn = document.getElementById('completeTask');
    const closeTaskDetailBtnFooter = document.getElementById('closeTaskDetailBtn');

    // 기존의 취소 버튼이 있으면 제거 (이전 편집 모드에서 남아있을 수 있음)
    const existingCancelBtn = document.getElementById('cancelEditBtn');
    if (existingCancelBtn) {
        existingCancelBtn.remove();
    }

    // 버튼 이벤트 리스너 재설정 (기존 이벤트 리스너 제거 후 새로 추가)
    if (editTaskHeaderBtn) {
        console.log('편집 버튼 이벤트 설정');
        // 기존 이벤트 리스너 제거
        editTaskHeaderBtn.onclick = null;
        editTaskHeaderBtn.removeEventListener('click', handleTaskEdit);
        
        // 버튼 스타일 초기화
        editTaskHeaderBtn.style.backgroundColor = '';
        editTaskHeaderBtn.style.color = '';
        editTaskHeaderBtn.title = '작업 편집';
        editTaskHeaderBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        `;
        
        // 새 이벤트 리스너 추가
        editTaskHeaderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('편집 버튼 클릭됨, currentTaskId:', currentTaskId);
            
            if (!currentTaskId) {
                showNotification('편집할 작업이 선택되지 않았습니다.', 'warning');
                return;
            }
            
            try {
                handleTaskEdit();
            } catch (error) {
                console.error('작업 편집 처리 중 오류:', error);
                showNotification('작업 편집 중 오류가 발생했습니다.', 'error');
            }
        });
    } else {
        console.warn('편집 버튼을 찾을 수 없습니다. (ID: editTaskHeader)');
    }
    
    if (deleteTaskHeaderBtn) {
        deleteTaskHeaderBtn.onclick = null;
        deleteTaskHeaderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('삭제 버튼 클릭됨, currentTaskId:', currentTaskId);
            
            if (!currentTaskId) {
                showNotification('삭제할 작업이 선택되지 않았습니다.', 'warning');
                return;
            }
            
            if (confirm('정말로 이 작업을 삭제하시겠습니까?')) {
                try {
                    handleTaskDelete();
                } catch (error) {
                    console.error('작업 삭제 처리 중 오류:', error);
                    showNotification('작업 삭제 중 오류가 발생했습니다.', 'error');
                }
            }
        });
    }
    
    if (completeTaskHeaderBtn) {
        completeTaskHeaderBtn.onclick = null;
        completeTaskHeaderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('완료 버튼 클릭됨, currentTaskId:', currentTaskId);
            
            if (!currentTaskId) {
                showNotification('완료할 작업이 선택되지 않았습니다.', 'warning');
                return;
            }
            
            try {
                handleTaskComplete();
            } catch (error) {
                console.error('작업 완료 처리 중 오류:', error);
                showNotification('작업 완료 중 오류가 발생했습니다.', 'error');
            }
        });
    }
    
    if (closeTaskDetailBtn) {
        closeTaskDetailBtn.onclick = null;
        closeTaskDetailBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeModal('taskDetailModal');
        });
    }
    
    if (addCommentBtn) {
        addCommentBtn.onclick = null;
        addCommentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('댓글 추가 버튼 클릭됨');
            
            try {
                handleAddComment();
            } catch (error) {
                console.error('댓글 추가 처리 중 오류:', error);
                showNotification('댓글 추가 중 오류가 발생했습니다.', 'error');
            }
        });
    }
    
    if (completeTaskBtn) {
        completeTaskBtn.onclick = null;
        completeTaskBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!currentTaskId) {
                showNotification('완료할 작업이 선택되지 않았습니다.', 'warning');
                return;
            }
            
            try {
                handleTaskComplete();
            } catch (error) {
                console.error('작업 완료 처리 중 오류:', error);
                showNotification('작업 완료 중 오류가 발생했습니다.', 'error');
            }
        });
    }
    
    if (closeTaskDetailBtnFooter) {
        closeTaskDetailBtnFooter.onclick = null;
        closeTaskDetailBtnFooter.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeModal('taskDetailModal');
        });
    }

    // 기본 정보 텍스트 업데이트
    if (titleElement) titleElement.textContent = task.title || '할 일 상세';
    if (mainTitleElement) mainTitleElement.textContent = task.title || '제목 없음';
    if (descriptionElement) descriptionElement.textContent = task.description || '설명이 없습니다.';
    
    // 프로젝트 정보
    const project = currentProjects.find(p => p.id === task.project_id);
    if (projectElement) {
        projectElement.textContent = project ? project.name : '프로젝트 없음';
        if (project) {
            projectElement.style.backgroundColor = project.color || '#3B82F6';
            projectElement.dataset.projectId = project.id; // 프로젝트 ID 저장
        }
    }

    // 우선순위
    if (priorityElement) {
        const priorityText = task.priority === 'high' ? '높음' : 
                           task.priority === 'medium' ? '보통' : '낮음';
        const priorityColor = task.priority === 'high' ? 'var(--error-600)' : 
                            task.priority === 'medium' ? 'var(--warning-600)' : 'var(--success-600)';
        priorityElement.textContent = `● ${priorityText}`;
        priorityElement.style.color = priorityColor;
    }

    // 상태 (데이터베이스와 UI 상태 값 매핑)
    if (statusElement) {
        const statusText = (task.status === 'todo' || task.status === 'pending') ? '대기중' : 
                         (task.status === 'in_progress' || task.status === 'doing') ? '진행중' : 
                         (task.status === 'completed' || task.status === 'done') ? '완료' : '취소';
        statusElement.textContent = statusText;
        
        const statusColor = (task.status === 'todo' || task.status === 'pending') ? 'var(--neutral-500)' : 
                          (task.status === 'in_progress' || task.status === 'doing') ? 'var(--warning-500)' : 
                          (task.status === 'completed' || task.status === 'done') ? 'var(--success-500)' : 'var(--error-500)';
        statusElement.style.backgroundColor = statusColor + '20';
        statusElement.style.color = statusColor;
        statusElement.style.borderColor = statusColor + '50';
    }

    // 날짜 정보
    if (startDateElement) {
        if (task.start_date) {
            const startDate = new Date(task.start_date);
            startDateElement.textContent = startDate.toLocaleDateString('ko-KR');
        } else {
            startDateElement.textContent = '없음';
        }
    }
    
    if (dueDateElement) {
        if (task.due_date) {
            const dueDate = new Date(task.due_date);
            dueDateElement.textContent = dueDate.toLocaleDateString('ko-KR');
        } else {
            dueDateElement.textContent = '없음';
        }
    }

    if (createdElement && task.created_at) {
        const createdDate = new Date(task.created_at);
        createdElement.textContent = createdDate.toLocaleString('ko-KR');
    }

    if (assigneeElement) {
        assigneeElement.textContent = task.assignee || (currentUser?.user_metadata?.full_name || '담당자 없음');
    }

    // 댓글 로드
    loadTaskComments(task.id);
    console.log('작업 상세 모달 데이터 채우기 완료');
}

// 작업 댓글 로드
async function loadTaskComments(taskId) {
    try {
        console.log('댓글 로드 시도:', { taskId, isDemoMode });
        let comments = [];
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 스토리지에서 로드
            const storedComments = localStorage.getItem('demo_comments');
            console.log('로컬 스토리지에서 댓글 데이터 확인:', storedComments ? '데이터 있음' : '데이터 없음');
            
            if (storedComments) {
                try {
                    const allComments = JSON.parse(storedComments);
                    console.log('모든 댓글 수:', allComments.length);
                    comments = allComments.filter(comment => {
                        console.log('댓글 ID 비교:', { commentTaskId: comment.task_id, currentTaskId: taskId });
                        return String(comment.task_id) === String(taskId);
                    });
                    console.log('필터링된 댓글 수:', comments.length);
                } catch (e) {
                    console.error('로컬 스토리지 댓글 파싱 오류:', e);
                }
            }
        } else if (supabase) {
            // Supabase에서 로드
            console.log('Supabase에서 댓글 로드 중...');
            console.log('댓글 조회를 위한 할 일 ID:', {
                taskId,
                type: typeof taskId
            });
            
            // 두 가지 방법으로 조회 시도 (todo_id와 task_id 모두 시도)
            let data = [];
            let error = null;
            
            // 1. 먼저 task_id로 조회
            const taskResult = await supabase
                .from('comments')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: false });
                
            if (taskResult.error) {
                console.error('task_id로 댓글 로드 오류:', taskResult.error);
                error = taskResult.error;
            } else if (taskResult.data && taskResult.data.length > 0) {
                // task_id로 찾았으면 그 결과 사용
                data = taskResult.data;
                console.log('task_id로 댓글 찾음:', data.length);
            } else {
                // 2. task_id로 찾지 못했으면 todo_id로 시도
                console.log('task_id로 찾지 못해 todo_id로 시도합니다.');
                const todoResult = await supabase
                    .from('comments')
                    .select('*')
                    .eq('todo_id', taskId)
                    .order('created_at', { ascending: false });
                    
                if (todoResult.error) {
                    console.error('todo_id로 댓글 로드 오류:', todoResult.error);
                    error = todoResult.error;
                } else {
                    data = todoResult.data || [];
                    console.log('todo_id로 댓글 찾음:', data.length);
                }
            }
            
            // 최종 결과 처리
            if (error) {
                throw error;
            }
            
            comments = data;
            console.log('Supabase에서 로드된 댓글 수:', comments.length);
        }

        renderTaskComments(comments);
        
    } catch (error) {
        console.error('댓글 로드 실패:', error);
        renderTaskComments([]);
    }
}

// 댓글 렌더링
function renderTaskComments(comments) {
    const commentsList = document.getElementById('commentsList');
    const commentCount = document.getElementById('commentCount');
    
    if (!commentsList) {
        console.error('댓글 목록 요소를 찾을 수 없습니다.');
        return;
    }

    console.log('댓글 렌더링 중...', comments.length, '개의 댓글');

    // 댓글 수 업데이트
    if (commentCount) {
        commentCount.textContent = comments.length;
    }

    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
                <svg style="width: 3rem; height: 3rem; margin: 0 auto var(--space-4) auto; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <p>아직 댓글이 없습니다.<br>첫 번째 댓글을 작성해보세요!</p>
            </div>
        `;
        return;
    }

    commentsList.innerHTML = comments.map(comment => `
        <div style="padding: var(--space-4); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); margin-bottom: var(--space-3); background-color: var(--bg-secondary); transition: all 0.2s ease;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div style="width: 2rem; height: 2rem; background-color: var(--primary-500); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: var(--font-semibold); font-size: var(--text-sm);">
                        ${(comment.author_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: var(--font-semibold); color: var(--text-primary); font-size: var(--text-sm);">${comment.author_name || '사용자'}</div>
                        <div style="font-size: var(--text-xs); color: var(--text-tertiary);">${comment.created_at ? new Date(comment.created_at).toLocaleString('ko-KR') : '방금 전'}</div>
                    </div>
                </div>
            </div>
            <p style="color: var(--text-secondary); line-height: var(--leading-relaxed); margin: 0;">${comment.content || ''}</p>
        </div>
    `).join('');
    
    console.log('댓글 렌더링 완료');
}



// 댓글 추가 핸들러
async function handleAddComment() {
    if (!currentTaskId) {
        console.error('현재 선택된 태스크가 없습니다.');
        return;
    }
    
    const commentTextarea = document.querySelector('#taskDetailModal textarea#newComment');
    if (!commentTextarea) {
        console.error('댓글 입력 필드를 찾을 수 없습니다.');
        return;
    }
    
    const content = commentTextarea.value.trim();
    if (!content) {
        showNotification('댓글 내용을 입력해주세요.', 'warning');
        return;
    }
    
    console.log('댓글 추가 시도:', { taskId: currentTaskId, content, isDemoMode });
    
    try {
        const newComment = {
            id: Date.now().toString(),
            task_id: currentTaskId,
            content: content,
            author_name: currentUser?.user_metadata?.full_name || '데모 사용자',
            author_id: currentUser?.id || 'demo-user',
            created_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            console.log('데모 모드에서 댓글 추가 중...');
            // 데모 모드에서 로컬 저장
            let comments = [];
            const storedComments = localStorage.getItem('demo_comments');
            if (storedComments) {
                try {
                    comments = JSON.parse(storedComments);
                    console.log('기존 댓글 목록 로드됨:', comments.length);
                } catch (e) {
                    console.error('로컬 스토리지 댓글 파싱 오류:', e);
                    comments = [];
                }
            }
            
            comments.push(newComment);
            localStorage.setItem('demo_comments', JSON.stringify(comments));
            console.log('댓글이 로컬스토리지에 저장됨');
            
            // 현재 댓글 목록에도 추가
            currentComments.push(newComment);
            
            showNotification('댓글이 추가되었습니다.', 'success');
        } else if (supabase) {
            console.log('Supabase에 댓글 추가 중...');
            
            // 디버깅 정보 출력
            console.log('현재 할 일 ID 정보:', {
                currentTaskId,
                type: typeof currentTaskId
            });
            
            // 두 필드 모두 설정 (todo_id와 task_id)
            const commentData = {
                todo_id: currentTaskId,  // 외래키로 설정된 필드
                task_id: currentTaskId,  // 기존 필드도 유지
                content: content,
                author_name: currentUser?.user_metadata?.full_name || '사용자',
                author_id: currentUser?.id
            };
            
            console.log('Supabase에 저장할 댓글 데이터:', commentData);
            
            // Supabase에 저장
            const { data, error } = await supabase
                .from('comments')
                .insert([commentData])
                .select();
                
            if (error) {
                console.error('Supabase 댓글 추가 오류:', error);
                throw error;
            }
            
            console.log('Supabase에 댓글 추가 성공:', data);
            showNotification('댓글이 추가되었습니다.', 'success');
        }
        
        // 댓글 입력창 초기화
        commentTextarea.value = '';
        
        // 댓글 목록 새로고침
        loadTaskComments(currentTaskId);
        
    } catch (error) {
        console.error('댓글 추가 실패:', error);
        showNotification('댓글 추가에 실패했습니다.', 'error');
    }
}

// 프로젝트 뷰 업데이트
function updateProjectsView() {
    const projectsGrid = document.querySelector('#projectsView .projects-grid');
    if (!projectsGrid) return;
    
    // 기존 프로젝트 카드들 제거 (새 프로젝트 추가 카드는 제외)
    const existingCards = projectsGrid.querySelectorAll('.project-card');
    existingCards.forEach(card => card.remove());
    
    // 프로젝트 카드들을 새 프로젝트 추가 카드 앞에 삽입
    const addNewCard = projectsGrid.querySelector('[onclick*="newProjectModal"]');
    
    currentProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        if (addNewCard) {
            projectsGrid.insertBefore(projectCard, addNewCard);
        } else {
            projectsGrid.appendChild(projectCard);
        }
    });
}

// 프로젝트 카드 생성
function createProjectCard(project) {
    const projectCard = document.createElement('div');
    projectCard.className = 'project-card';
    
    const statusText = project.status === 'planning' ? '계획 중' : 
                      project.status === 'in_progress' ? '진행 중' : 
                      project.status === 'completed' ? '완료' : '대기';
    
    const statusColor = project.status === 'planning' ? 'var(--success-100)' : 
                       project.status === 'in_progress' ? 'var(--warning-100)' : 
                       project.status === 'completed' ? 'var(--primary-100)' : 'var(--neutral-100)';
    
    const statusTextColor = project.status === 'planning' ? 'var(--success-700)' : 
                           project.status === 'in_progress' ? 'var(--warning-700)' : 
                           project.status === 'completed' ? 'var(--primary-700)' : 'var(--neutral-700)';
    
    const projectTasks = currentTasks.filter(task => task.project_id === project.id);
    const completedTasks = projectTasks.filter(task => task.status === 'completed');
    const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
    
    const dueDateStr = project.due_date ? new Date(project.due_date).toLocaleDateString('ko-KR', {year: 'numeric', month: '2-digit', day: '2-digit'}).replace(/\./g, '.') : '미정';
    
    projectCard.innerHTML = `
        <div style="background-color: ${project.color}; height: 0.5rem;"></div>
        <div style="padding: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3); gap: var(--space-2);">
                <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); flex: 1;">${project.name}</h3>
                <span style="background-color: ${statusColor}; color: ${statusTextColor}; padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); white-space: nowrap;">${statusText}</span>
            </div>
            
            <p style="color: var(--text-tertiary); margin-bottom: var(--space-4); font-size: var(--text-sm);">${project.description || '설명 없음'}</p>
            
            <div style="margin-bottom: var(--space-3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
                    <span style="font-size: var(--text-sm); color: var(--text-secondary);">진행률</span>
                    <span style="font-size: var(--text-sm); color: var(--text-secondary);">${progress}%</span>
                </div>
                <div style="width: 100%; height: 0.5rem; background-color: var(--neutral-200); border-radius: var(--radius-sm);">
                    <div style="width: ${progress}%; height: 100%; background-color: ${project.color}; border-radius: var(--radius-sm);"></div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: var(--space-4);">
                <span>할 일: ${completedTasks.length}/${projectTasks.length}</span>
                <span>마감일: ${dueDateStr}</span>
            </div>
            
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                <button class="btn btn-ghost btn-sm" onclick="openNewTaskModal(${project.id})">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    할 일 추가
                </button>
                <button class="btn btn-ghost btn-sm" onclick="editProject(${project.id})">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    편집
                </button>
            </div>
        </div>
    `;
    
    return projectCard;
}

// 새 할 일 모달을 특정 프로젝트로 열기
function openNewTaskModal(projectId) {
    openModal('newTaskModal');
    // 프로젝트 선택 필드가 있다면 해당 프로젝트로 설정
    setTimeout(() => {
        const projectSelect = document.getElementById('taskProject');
        if (projectSelect) {
            projectSelect.value = projectId;
        }
    }, 100);
}

// 프로젝트 편집 (추후 구현)
function editProject(projectId) {
    showNotification('프로젝트 편집 기능은 준비 중입니다.', 'info');
}

// 캘린더 뷰 변경
function changeCalendarView(view) {
    calendarView = view;
    renderCalendar();
    console.log(`캘린더 뷰가 ${view}로 변경되었습니다.`);
}

// 캘린더 날짜 이동
function moveCalendarDate(direction) {
    // 이전/다음 달로 이동 로직
    if (direction === 'prev') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (direction === 'next') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // 캘린더 UI 업데이트
    renderCalendar();
    console.log(`캘린더 날짜가 ${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월로 변경되었습니다.`);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('페이지 로드됨, 초기화 시작...');
    
    try {
        showLoading();
        setupEventListeners();
        
        // 인증 상태 확인 후 적절한 화면 표시
        setTimeout(() => {
            hideLoading();
            checkAuthState();
            
            // 데모 버튼 클릭 이벤트 재확인
            const demoBtn = document.getElementById('demoBtn');
            console.log('데모 버튼 요소:', demoBtn);
            if (demoBtn) {
                console.log('데모 버튼 이벤트 리스너 재설정');
                demoBtn.onclick = function() {
                    console.log('데모 버튼 클릭됨');
                    handleDemoMode();
                };
            }
            
            // 바로 데모 모드 시작
            handleDemoMode();
            
            // UI/UX 디자인 시안 작성 할 일 찾아서 클릭
            setTimeout(() => {
                // 모든 할 일 항목 가져오기
                const allTasks = document.querySelectorAll('.task-item');
                console.log('전체 할일 항목 수:', allTasks.length);
                
                // UI/UX 디자인 시안 작성 항목 찾기
                let uiuxTask = null;
                allTasks.forEach(task => {
                    const titleElement = task.querySelector('h3');
                    if (titleElement && titleElement.textContent.includes('UI/UX 디자인 시안')) {
                        uiuxTask = task;
                        console.log('UI/UX 디자인 시안 작업 찾음:', titleElement.textContent);
                    }
                });
                
                // 찾은 항목 클릭
                if (uiuxTask) {
                    console.log('UI/UX 디자인 시안 작업 클릭 시도...');
                    uiuxTask.click();
                    
                    // 모달이 열린 후 댓글 입력 및 추가
                    setTimeout(() => {
                        const commentTextarea = document.querySelector('#newComment');
                        if (commentTextarea) {
                            console.log('댓글 입력 필드 찾음, 내용 입력 중...');
                            commentTextarea.value = '테스트 댓글입니다. 댓글 기능이 정상 작동하는지 확인해보겠습니다.';
                            const addCommentBtn = document.querySelector('#addComment');
                            if (addCommentBtn) {
                                console.log('댓글 추가 버튼 클릭 시도...');
                                addCommentBtn.click();
                            } else {
                                console.error('댓글 추가 버튼을 찾을 수 없습니다.');
                            }
                        } else {
                            console.error('댓글 입력 필드를 찾을 수 없습니다.');
                        }
                    }, 2000);
                } else {
                    console.error('UI/UX 디자인 시안 작업을 찾을 수 없습니다.');
                }
            }, 3000);
        }, 800);
        
    } catch (error) {
        console.error('초기화 오류:', error);
        hideLoading();
        showLoginScreen();
    }
});

// CSS 애니메이션용 스타일 추가
const style = document.createElement('style');
style.textContent = `
    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        display: inline-block;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);