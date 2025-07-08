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

// 한국 시간대 처리 함수들
function getKoreanTime(date = new Date()) {
    return new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
}

function formatKoreanDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return getKoreanTime(date);
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
            // 문자열과 숫자 ID 모두 처리하도록 수정
            filteredTasks = filteredTasks.filter(task => {
                return String(task.project_id) === String(currentProjectFilter);
            });
        }
        
        // 최근 순으로 정렬하고 상위 10개 선택
        const recentTasks = filteredTasks
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);
        
        // 할일 목록을 렌더링할 컨테이너 찾기
        const tasksListContainer = document.getElementById('recentTasksList');
        if (tasksListContainer) {
            // 기존 task-item들 모두 제거
            tasksListContainer.innerHTML = '';
            
            // 새로운 할일 목록 렌더링
            if (recentTasks.length === 0) {
                let emptyMessage = '할일이 없습니다.';
                if (currentStatusFilter !== 'all' || currentProjectFilter !== 'all') {
                    emptyMessage = '선택한 필터 조건에 맞는 할일이 없습니다.';
                }
                
                tasksListContainer.innerHTML = `
                    <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
                        <svg style="width: 3rem; height: 3rem; margin: 0 auto var(--space-4) auto; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                        <p>${emptyMessage}</p>
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
                    
                    // 클릭 이벤트 추가
                    taskElement.addEventListener('click', () => {
                        openTaskDetail(task.id);
                    });
                    
                    tasksListContainer.appendChild(taskElement);
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
    // 현재 선택된 날짜를 기준으로 한 주간 계산
    const selectedDate = new Date(currentDate);
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay()); // 일요일로 설정
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 토요일까지
    
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    // 주간 헤더 업데이트
    const monthYearDisplay = document.querySelector('#calendarView .calendar-controls h3');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = `${startOfWeek.getFullYear()}년 ${startOfWeek.getMonth() + 1}월 ${startOfWeek.getDate()}일 - ${endOfWeek.getDate()}일`;
    }
    
    let weekHTML = `
        <!-- 요일 헤더 -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 2px solid var(--border-primary); background-color: var(--bg-secondary);">
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); color: var(--error-600); border-right: 1px solid var(--border-primary);">일요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); border-right: 1px solid var(--border-primary);">월요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); border-right: 1px solid var(--border-primary);">화요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); border-right: 1px solid var(--border-primary);">수요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); border-right: 1px solid var(--border-primary);">목요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); border-right: 1px solid var(--border-primary);">금요일</div>
            <div style="padding: var(--space-3); text-align: center; font-weight: var(--font-semibold); color: var(--primary-600);">토요일</div>
        </div>
        <!-- 주간 뷰 -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); min-height: 400px;">`;
    
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const today = new Date();
        const isToday = currentDay.toDateString() === today.toDateString();
        const dayNum = currentDay.getDate();
        const monthName = currentDay.getMonth() + 1;
        
        // 해당 날짜의 할 일 찾기 (마감일 + 범위 내 태스크)
        const dayTasks = currentTasks.filter(task => {
            if (!task.due_date) return false;
            const taskDate = getKoreanTime(new Date(task.due_date));
            const koreanCurrentDay = getKoreanTime(currentDay);
            return taskDate.toDateString() === koreanCurrentDay.toDateString();
        });
        
        const rangeInTasks = currentTasks.filter(task => {
            const startDate = task.start_date ? getKoreanTime(new Date(task.start_date)) : null;
            const dueDate = task.due_date ? getKoreanTime(new Date(task.due_date)) : null;
            const currentDate = getKoreanTime(new Date(currentDay));
            currentDate.setHours(0, 0, 0, 0);
            
            if (startDate && dueDate) {
                startDate.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                return currentDate >= startDate && currentDate <= dueDate;
            } else if (dueDate) {
                dueDate.setHours(0, 0, 0, 0);
                return currentDate.getTime() === dueDate.getTime();
            }
            return false;
        });
        
        const allDayTasks = [...new Set([...dayTasks, ...rangeInTasks])]; // 중복 제거
        
        let dayColor = '';
        let bgColor = 'background-color: var(--bg-card);';
        if (i === 0) dayColor = 'color: var(--error-600);'; // 일요일
        else if (i === 6) dayColor = 'color: var(--primary-600);'; // 토요일
        else dayColor = 'color: var(--text-primary);'; // 평일
        
        if (isToday) {
            bgColor = 'background-color: var(--primary-50); border: 2px solid var(--primary-200);';
        }
        
        weekHTML += `
            <div class="calendar-day week-day" data-date="${currentDay.toISOString().split('T')[0]}"
                 style="min-height: 400px; padding: var(--space-3); ${i < 6 ? 'border-right: 1px solid var(--border-primary);' : ''} ${dayColor} ${bgColor} cursor: pointer; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-secondary); padding-bottom: var(--space-2);">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <span style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">${monthName}월</span>
                        <span style="font-weight: var(--font-bold); font-size: var(--text-2xl); ${isToday ? 'color: var(--primary-600);' : ''}">${dayNum}</span>
                    </div>
                    ${isToday ? '<span class="today-marker" style="background-color: var(--primary-500); color: white; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">오늘</span>' : ''}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: var(--space-2);">`;
                
        // 할일들을 카드 형태로 표시
        allDayTasks.slice(0, 8).forEach(task => { // 최대 8개까지 표시
            const project = currentProjects.find(p => p.id === task.project_id);
            const projectColor = project ? project.color : '#3B82F6';
            const projectName = project ? project.name : '기본 프로젝트';
            
            // 마감일인지 범위 내인지 구분
            const isDueDate = dayTasks.some(t => t.id === task.id);
            const statusColor = getStatusColor(task.status);
            const priorityIcon = getPriorityIcon(task.priority);
            
            const taskCardStyle = isDueDate 
                ? `background: linear-gradient(135deg, ${projectColor}15, ${projectColor}05); border-left: 4px solid ${projectColor}; border: 1px solid ${projectColor}40;`
                : `background: linear-gradient(135deg, ${projectColor}08, ${projectColor}02); border-left: 3px solid ${projectColor}60; border: 1px solid ${projectColor}20;`;
            
            weekHTML += `
                <div class="task-card week-task" 
                     data-task-id="${task.id}"
                     style="${taskCardStyle} padding: var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s ease;"
                     onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    
                    <div style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: var(--space-1);">
                        <span style="font-weight: var(--font-semibold); font-size: var(--text-sm); color: var(--text-primary); line-height: 1.3; flex: 1;">${task.title}</span>
                        <div style="display: flex; gap: 2px; margin-left: var(--space-1);">
                            ${priorityIcon}
                            ${isDueDate ? '<span style="font-size: 10px;">📅</span>' : '<span style="font-size: 10px;">⏱️</span>'}
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: var(--text-xs); color: var(--text-secondary); background-color: ${projectColor}20; padding: 1px 6px; border-radius: 8px;">${projectName}</span>
                        <span class="status-badge" style="background-color: ${statusColor}; color: white; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 500;">${getStatusText(task.status)}</span>
                    </div>
                </div>`;
        });
        
        // 더 많은 할일이 있으면 표시
        if (allDayTasks.length > 8) {
            weekHTML += `
                <div style="text-align: center; padding: var(--space-2); color: var(--text-tertiary); font-size: var(--text-sm); border: 1px dashed var(--border-secondary); border-radius: var(--radius-md);">
                    +${allDayTasks.length - 8}개 더 보기
                </div>`;
        }
        
        // 할일이 없을 때
        if (allDayTasks.length === 0) {
            weekHTML += `
                <div style="text-align: center; padding: var(--space-4); color: var(--text-quaternary); font-size: var(--text-sm);">
                    <svg style="width: 24px; height: 24px; margin-bottom: var(--space-2); opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h9.5a2 2 0 002-2V7a2 2 0 00-2-2H14m-5 0V3m0 2h5V3"></path>
                    </svg>
                    <br>할 일 없음
                </div>`;
        }
        
        weekHTML += `</div></div>`;
    }
    
    weekHTML += `</div>`;
    calendarContainer.innerHTML = weekHTML;
    
    // 이벤트 리스너 추가
    addWeekViewEventListeners();
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

// 주간 뷰 이벤트 리스너 추가
function addWeekViewEventListeners() {
    // 태스크 카드 클릭 이벤트
    const taskCards = document.querySelectorAll('.week-task');
    taskCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = card.getAttribute('data-task-id');
            if (taskId) {
                openTaskDetail(taskId);
            }
        });
    });
    
    // 날짜 클릭 이벤트 (새 할일 추가)
    const weekDays = document.querySelectorAll('.week-day');
    weekDays.forEach(day => {
        day.addEventListener('click', (e) => {
            // 태스크 카드가 아닌 빈 공간 클릭시에만 실행
            if (!e.target.closest('.week-task')) {
                const date = day.getAttribute('data-date');
                openNewTaskModal(date);
            }
        });
    });
}

// 상태별 색상 반환
function getStatusColor(status) {
    switch(status) {
        case 'completed': return 'var(--success-500)';
        case 'in_progress': return 'var(--warning-500)';
        case 'pending': return 'var(--neutral-400)';
        default: return 'var(--neutral-400)';
    }
}

// 상태 텍스트 반환
function getStatusText(status) {
    switch(status) {
        case 'completed': return '완료';
        case 'in_progress': return '진행중';
        case 'pending': return '대기';
        default: return '대기';
    }
}

// 우선순위 아이콘 반환
function getPriorityIcon(priority) {
    switch(priority) {
        case 'high': return '<span style="color: var(--error-500); font-size: 10px;">🔴</span>';
        case 'medium': return '<span style="color: var(--warning-500); font-size: 10px;">🟡</span>';
        case 'low': return '<span style="color: var(--success-500); font-size: 10px;">🟢</span>';
        default: return '<span style="color: var(--neutral-400); font-size: 10px;">⚪</span>';
    }
}

// 새 할일 모달 열기 (날짜 지정)
function openNewTaskModal(selectedDate) {
    const modal = document.getElementById('newTaskModal');
    const dueDateInput = document.getElementById('newTaskDueDate');
    
    if (modal && dueDateInput) {
        // 선택된 날짜를 마감일로 설정
        dueDateInput.value = selectedDate;
        openModal('newTaskModal');
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
        listContent.innerHTML = `
            <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
                <svg style="width: 48px; height: 48px; margin-bottom: var(--space-4); opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h9.5a2 2 0 002-2V7a2 2 0 00-2-2H14m-5 0V3m0 2h5V3"></path>
                </svg>
                <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">할 일이 없습니다</p>
                <p style="font-size: var(--text-sm);">새로운 할 일을 추가해보세요!</p>
            </div>`;
        return;
    }
    
    // 필터 및 정렬 옵션 HTML
    const filterSortHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-6); padding: var(--space-4); background-color: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-primary);">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <label style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary);">상태:</label>
                <select id="listStatusFilter" style="padding: var(--space-1) var(--space-2); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--text-sm);">
                    <option value="all">전체</option>
                    <option value="pending">대기</option>
                    <option value="in_progress">진행중</option>
                    <option value="completed">완료</option>
                </select>
            </div>
            
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <label style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary);">우선순위:</label>
                <select id="listPriorityFilter" style="padding: var(--space-1) var(--space-2); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--text-sm);">
                    <option value="all">전체</option>
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                </select>
            </div>
            
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <label style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary);">프로젝트:</label>
                <select id="listProjectFilter" style="padding: var(--space-1) var(--space-2); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--text-sm);">
                    <option value="all">전체 프로젝트</option>
                    ${currentProjects.map(project => `<option value="${project.id}">${project.name}</option>`).join('')}
                </select>
            </div>
            
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <label style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary);">정렬:</label>
                <select id="listSortBy" style="padding: var(--space-1) var(--space-2); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--text-sm);">
                    <option value="due_date">마감일순</option>
                    <option value="priority">우선순위순</option>
                    <option value="created_at">생성일순</option>
                    <option value="title">제목순</option>
                    <option value="status">상태순</option>
                </select>
            </div>
            
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <input type="text" id="listSearchInput" placeholder="할일 검색..." 
                       style="padding: var(--space-1) var(--space-2); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--text-sm); min-width: 200px;">
                <button onclick="clearListFilters()" class="btn btn-ghost btn-sm">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>`;
    
    // 통계 정보 HTML
    const completedTasks = currentTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = currentTasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = currentTasks.filter(t => t.status === 'pending').length;
    const overdueTasks = currentTasks.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        return new Date(t.due_date) < new Date();
    }).length;
    
    const statsHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-6);">
            <div style="background-color: var(--bg-card); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--border-primary); text-align: center;">
                <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-1);">${currentTasks.length}</div>
                <div style="font-size: var(--text-sm); color: var(--text-secondary);">전체 할일</div>
            </div>
            <div style="background-color: var(--success-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--success-200); text-align: center;">
                <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--success-700); margin-bottom: var(--space-1);">${completedTasks}</div>
                <div style="font-size: var(--text-sm); color: var(--success-600);">완료</div>
            </div>
            <div style="background-color: var(--warning-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--warning-200); text-align: center;">
                <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--warning-700); margin-bottom: var(--space-1);">${inProgressTasks}</div>
                <div style="font-size: var(--text-sm); color: var(--warning-600);">진행중</div>
            </div>
            <div style="background-color: var(--neutral-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--neutral-200); text-align: center;">
                <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--neutral-700); margin-bottom: var(--space-1);">${pendingTasks}</div>
                <div style="font-size: var(--text-sm); color: var(--neutral-600);">대기</div>
            </div>
            ${overdueTasks > 0 ? `
                <div style="background-color: var(--error-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--error-200); text-align: center;">
                    <div style="font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--error-700); margin-bottom: var(--space-1);">${overdueTasks}</div>
                    <div style="font-size: var(--text-sm); color: var(--error-600);">지연</div>
                </div>
            ` : ''}
        </div>`;
    
    // 날짜별로 할일 그룹화
    const tasksByDate = {};
    const tasksWithoutDate = [];
    
    currentTasks.forEach(task => {
        if (task.due_date) {
            const dateKey = task.due_date.split('T')[0]; // 날짜 부분만 추출
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
    
    let listHTML = statsHTML + filterSortHTML + '<div id="taskListContainer">';
    
    // 지연된 할일 먼저 표시
    if (overdueTasks > 0) {
        const overdue = currentTasks.filter(t => {
            if (!t.due_date || t.status === 'completed') return false;
            return new Date(t.due_date) < new Date();
        });
        
        listHTML += `
            <div style="margin-bottom: var(--space-6);">
                <h4 style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--error-600); margin-bottom: var(--space-3); padding: var(--space-2); background-color: var(--error-50); border-radius: var(--radius-md); border: 1px solid var(--error-200);">
                    <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    지연된 할일 (${overdueTasks}개)
                </h4>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">`;
        
        overdue.forEach(task => {
            listHTML += generateTaskCard(task, true);
        });
        
        listHTML += `</div></div>`;
    }
    
    // 오늘 할일
    const today = new Date().toISOString().split('T')[0];
    if (tasksByDate[today]) {
        listHTML += `
            <div style="margin-bottom: var(--space-6);">
                <h4 style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--primary-600); margin-bottom: var(--space-3); padding: var(--space-2); background-color: var(--primary-50); border-radius: var(--radius-md); border: 1px solid var(--primary-200);">
                    <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    오늘 할일 (${tasksByDate[today].length}개)
                </h4>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">`;
        
        tasksByDate[today].forEach(task => {
            listHTML += generateTaskCard(task);
        });
        
        listHTML += `</div></div>`;
    }
    
    // 다른 날짜별 할일
    sortedDates.forEach(dateKey => {
        if (dateKey === today) return; // 오늘은 이미 표시했음
        
        const tasks = tasksByDate[dateKey];
        const date = new Date(dateKey);
        const isOverdue = date < new Date() && !tasks.every(t => t.status === 'completed');
        const dateStr = formatDateString(dateKey);
        
        listHTML += `
            <div style="margin-bottom: var(--space-6);">
                <h4 style="display: flex; align-items: center; justify-content: space-between; font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-3); padding: var(--space-2); background-color: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-primary);">
                    <span style="display: flex; align-items: center; gap: var(--space-2);">
                        <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        ${dateStr}
                        ${isOverdue ? '<span style="color: var(--error-500); font-size: var(--text-sm);">(지연)</span>' : ''}
                    </span>
                    <span style="font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-normal);">${tasks.length}개</span>
                </h4>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">`;
        
        tasks.forEach(task => {
            listHTML += generateTaskCard(task, isOverdue);
        });
        
        listHTML += `</div></div>`;
    });
    
    // 마감일이 없는 할일
    if (tasksWithoutDate.length > 0) {
        listHTML += `
            <div style="margin-bottom: var(--space-6);">
                <h4 style="display: flex; align-items: center; justify-content: space-between; font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-secondary); margin-bottom: var(--space-3); padding: var(--space-2); background-color: var(--neutral-50); border-radius: var(--radius-md); border: 1px solid var(--neutral-200);">
                    <span style="display: flex; align-items: center; gap: var(--space-2);">
                        <svg style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h9.5a2 2 0 002-2V7a2 2 0 00-2-2H14m-5 0V3m0 2h5V3"></path>
                        </svg>
                        마감일 없음
                    </span>
                    <span style="font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-normal);">${tasksWithoutDate.length}개</span>
                </h4>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">`;
        
        tasksWithoutDate.forEach(task => {
            listHTML += generateTaskCard(task);
        });
        
        listHTML += `</div></div>`;
    }
    
    listHTML += '</div>';
    listContent.innerHTML = listHTML;
    
    // 필터 이벤트 리스너 추가
    addListViewEventListeners();
}

// 할일 카드 생성
function generateTaskCard(task, isOverdue = false) {
    const project = currentProjects.find(p => p.id === task.project_id);
    const projectColor = project ? project.color : '#3B82F6';
    const projectName = project ? project.name : '기본 프로젝트';
    const statusColor = getStatusColor(task.status);
    const priorityIcon = getPriorityIcon(task.priority);
    const progress = task.progress || 0;
    
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const dueDateStr = dueDate ? formatDateString(task.due_date.split('T')[0]) : '';
    
    const overdueStyle = isOverdue ? 'border-left: 4px solid var(--error-500); background-color: var(--error-50);' : `border-left: 4px solid ${projectColor};`;
    
    return `
        <div class="task-list-card" data-task-id="${task.id}" 
             style="${overdueStyle} background-color: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: var(--space-4); cursor: pointer; transition: all 0.2s ease;"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.1)';"
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
                <div style="flex: 1;">
                    <h5 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: var(--space-1); line-height: 1.4;">${task.title}</h5>
                    ${task.description ? `<p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-2);">${task.description}</p>` : ''}
                </div>
                
                <div style="display: flex; align-items: center; gap: var(--space-2); margin-left: var(--space-3);">
                    ${priorityIcon}
                    <span class="status-badge" style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600;">${getStatusText(task.status)}</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                <span style="font-size: var(--text-sm); color: var(--text-secondary); background-color: ${projectColor}20; color: ${projectColor}; padding: 4px 8px; border-radius: var(--radius-md); font-weight: 500;">${projectName}</span>
                ${dueDateStr ? `<span style="font-size: var(--text-sm); color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-1);">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    ${dueDateStr}
                </span>` : ''}
            </div>
            
            ${progress > 0 ? `
                <div style="margin-bottom: var(--space-2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-1);">
                        <span style="font-size: var(--text-sm); color: var(--text-secondary);">진행률</span>
                        <span style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary);">${progress}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background-color: var(--neutral-200); border-radius: var(--radius-sm);">
                        <div style="width: ${progress}%; height: 100%; background-color: ${projectColor}; border-radius: var(--radius-sm); transition: width 0.3s ease;"></div>
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-tertiary);">
                <span>생성일: ${formatDateString(task.created_at?.split('T')[0] || '')}</span>
                ${task.updated_at ? `<span>수정일: ${formatDateString(task.updated_at.split('T')[0])}</span>` : ''}
            </div>
        </div>`;
}

// 날짜 문자열 포맷팅
function formatDateString(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
        return '오늘';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
        return '어제';
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
        return '내일';
    } else {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        
        if (year === today.getFullYear()) {
            return `${month}월 ${day}일 (${dayName})`;
        } else {
            return `${year}년 ${month}월 ${day}일 (${dayName})`;
        }
    }
}

// 목록 뷰 이벤트 리스너
function addListViewEventListeners() {
    // 태스크 카드 클릭
    const taskCards = document.querySelectorAll('.task-list-card');
    taskCards.forEach(card => {
        card.addEventListener('click', () => {
            const taskId = card.getAttribute('data-task-id');
            if (taskId) {
                openTaskDetail(taskId);
            }
        });
    });
    
    // 필터 이벤트 리스너
    const statusFilter = document.getElementById('listStatusFilter');
    const priorityFilter = document.getElementById('listPriorityFilter');
    const projectFilter = document.getElementById('listProjectFilter');
    const sortBy = document.getElementById('listSortBy');
    const searchInput = document.getElementById('listSearchInput');
    
    if (statusFilter) statusFilter.addEventListener('change', applyListFilters);
    if (priorityFilter) priorityFilter.addEventListener('change', applyListFilters);
    if (projectFilter) projectFilter.addEventListener('change', applyListFilters);
    if (sortBy) sortBy.addEventListener('change', applyListFilters);
    if (searchInput) searchInput.addEventListener('input', applyListFilters);
}

// 필터 적용
function applyListFilters() {
    // 필터 로직은 향후 구현
    console.log('필터 적용 중...');
}

// 필터 초기화
function clearListFilters() {
    document.getElementById('listStatusFilter').value = 'all';
    document.getElementById('listPriorityFilter').value = 'all';
    document.getElementById('listProjectFilter').value = 'all';
    document.getElementById('listSortBy').value = 'due_date';
    document.getElementById('listSearchInput').value = '';
    applyListFilters();
}

// 목록 뷰 렌더링 함수 수정
function renderListViewContent() {
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
    // 대시보드 통계 카드 클릭 이벤트 설정
    const statsCards = document.querySelectorAll('.stats-card[data-filter]');
    statsCards.forEach(card => {
        const filterType = card.getAttribute('data-filter');
        if (filterType) {
            // 인라인 onclick 속성을 제거하고 이벤트 리스너로 대체
            card.removeAttribute('onclick');
            card.addEventListener('click', function() {
                handleStatsCardClick(filterType);
            });
        }
    });
    
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

    // 작업 상세 모달의 상태 버튼 클릭 이벤트
    const taskDetailStatus = document.getElementById('taskDetailStatus');
    if (taskDetailStatus) {
        taskDetailStatus.addEventListener('click', handleStatusChange);
    }
    
    // 댓글 새로고침 버튼 클릭 이벤트
    const refreshCommentsBtn = document.getElementById('refreshComments');
    if (refreshCommentsBtn) {
        refreshCommentsBtn.addEventListener('click', handleRefreshComments);
    }
    
    // 진행률 슬라이더 및 입력 필드 이벤트
    const progressSlider = document.getElementById('progressSlider');
    const progressInput = document.getElementById('progressInput');
    
    if (progressSlider) {
        progressSlider.addEventListener('input', handleProgressSliderChange);
    }
    
    if (progressInput) {
        progressInput.addEventListener('input', handleProgressInputChange);
        progressInput.addEventListener('blur', handleProgressInputBlur);
    }

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
        // 이벤트 리스너 제거 후 새로 설정
        editTaskHeaderBtn.onclick = null;
        if (editTaskHeaderBtn._saveHandler) {
            editTaskHeaderBtn.removeEventListener('click', editTaskHeaderBtn._saveHandler);
            editTaskHeaderBtn._saveHandler = null;
        }
        // 기본 상태로 설정 (편집 버튼)
        editTaskHeaderBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        `;
        editTaskHeaderBtn.title = '작업 편집';
        editTaskHeaderBtn.style.backgroundColor = '';
        editTaskHeaderBtn.style.color = '';
        
        // 새로운 이벤트 리스너 설정
        editTaskHeaderBtn.addEventListener('click', handleTaskEdit);
        editTaskHeaderBtn.onclick = handleTaskEdit; // 백업용 onclick 설정
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
        'cancelNewTask',
        'closeProjectEditModal',
        'cancelEditProject'
    ];
    
    closeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                if (buttonId.includes('ProjectEdit') || buttonId.includes('EditProject')) {
                    closeModal('projectEditModal');
                } else if (buttonId.includes('Project')) {
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
    
    // 프로젝트 편집 폼
    const editProjectForm = document.getElementById('editProjectForm');
    if (editProjectForm) {
        editProjectForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProjectEdit();
        });
    }
    
    // 프로젝트 삭제 버튼
    const deleteProjectBtn = document.getElementById('deleteProjectBtn');
    if (deleteProjectBtn) {
        deleteProjectBtn.addEventListener('click', () => {
            if (currentEditingProject) {
                deleteProject(currentEditingProject.id);
            }
        });
    }
    
    // 프로젝트 편집 색상 선택기
    const editColorPicker = document.getElementById('editColorPicker');
    if (editColorPicker) {
        editColorPicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                // 기존 선택 제거
                editColorPicker.querySelectorAll('.color-option').forEach(option => {
                    option.classList.remove('selected');
                });
                
                // 새 선택 추가
                e.target.classList.add('selected');
                document.getElementById('editProjectColor').value = e.target.dataset.color;
            }
        });
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
    
    // 필터 이벤트 리스너 설정
    setupFilterListeners();
}

// 필터 이벤트 리스너 설정
function setupFilterListeners() {
    const statusFilter = document.getElementById('statusFilter');
    const projectFilter = document.getElementById('projectFilter');
    const resetFilters = document.getElementById('resetFilters');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentStatusFilter = this.value;
            updateRecentTasksList();
            updateDashboardStats();
        });
    }
    
    if (projectFilter) {
        projectFilter.addEventListener('change', function() {
            currentProjectFilter = this.value;
            updateRecentTasksList();
            updateDashboardStats();
        });
    }
    
    if (resetFilters) {
        resetFilters.addEventListener('click', function() {
            currentStatusFilter = 'all';
            currentProjectFilter = 'all';
            
            if (statusFilter) statusFilter.value = 'all';
            if (projectFilter) projectFilter.value = 'all';
            
            updateRecentTasksList();
            updateDashboardStats();
            updateProjectFilterOptions();
        });
    }
    
    // 프로젝트 필터 옵션 업데이트
    updateProjectFilterOptions();
}

// 통계 카드 클릭 핸들러
function handleStatsCardClick(filterType) {
    currentStatusFilter = filterType;
    
    // 상태 필터 드롭다운 업데이트
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.value = filterType;
    }
    
    // 할 일 목록 업데이트
    updateRecentTasksList();
    
    // 대시보드 통계 업데이트
    updateDashboardStats();
    
    // 시각적 피드백
    showNotification(`${getFilterDisplayName(filterType)} 작업만 표시합니다`, 'info');
}

// 프로젝트 통계 카드 클릭 핸들러
function handleProjectStatsClick() {
    const dropdown = document.getElementById('projectDropdown');
    if (dropdown) {
        dropdown.classList.toggle('d-none');
        
        // 다른 곳 클릭시 드롭다운 닫기
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.stats-card[onclick="handleProjectStatsClick()"]')) {
                dropdown.classList.add('d-none');
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);
    }
}

// 프로젝트 드롭다운에서 선택
function selectProjectFromDropdown(projectId) {
    currentProjectFilter = projectId;
    
    // 프로젝트 필터 드롭다운 업데이트
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        projectFilter.value = projectId;
    }
    
    // 할 일 목록 업데이트
    updateRecentTasksList();
    
    // 대시보드 통계 업데이트 (필터가 변경되었으므로)
    updateDashboardStats();
    
    // 드롭다운 닫기
    const dropdown = document.getElementById('projectDropdown');
    if (dropdown) {
        dropdown.classList.add('d-none');
    }
    
    // 시각적 피드백
    const projectName = projectId === 'all' ? '모든 프로젝트' : 
        currentProjects.find(p => String(p.id) === String(projectId))?.name || '선택된 프로젝트';
    showNotification(`${projectName}의 작업만 표시합니다`, 'info');
}

// 필터 이름 표시용 함수
function getFilterDisplayName(filterType) {
    switch(filterType) {
        case 'all': return '전체';
        case 'pending': return '대기중';
        case 'in_progress': return '진행중';
        case 'completed': return '완료';
        default: return '전체';
    }
}

// 프로젝트 필터 옵션 업데이트
function updateProjectFilterOptions() {
    // 프로젝트 필터 드롭다운 업데이트
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
    
    // 프로젝트 드롭다운 메뉴 업데이트
    const projectDropdownList = document.getElementById('projectDropdownList');
    if (projectDropdownList) {
        projectDropdownList.innerHTML = '';
        
        // 모든 프로젝트 옵션 추가
        const allOption = document.createElement('div');
        allOption.className = 'project-dropdown-item';
        allOption.dataset.project = 'all';
        allOption.style.cssText = 'padding: var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: background-color 0.2s ease; display: flex; align-items: center; gap: var(--space-2);';
        allOption.onclick = () => selectProjectFromDropdown('all');
        allOption.onmouseover = () => allOption.style.backgroundColor = 'var(--bg-secondary)';
        allOption.onmouseout = () => allOption.style.backgroundColor = 'transparent';
        allOption.innerHTML = `
            <div style="width: 8px; height: 8px; background-color: var(--neutral-400); border-radius: 50%;"></div>
            <span style="font-size: var(--text-sm); color: var(--text-primary);">모든 프로젝트</span>
        `;
        projectDropdownList.appendChild(allOption);
        
        // 현재 프로젝트들을 옵션으로 추가
        currentProjects.forEach(project => {
            const option = document.createElement('div');
            option.className = 'project-dropdown-item';
            option.dataset.project = project.id;
            option.style.cssText = 'padding: var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: background-color 0.2s ease; display: flex; align-items: center; gap: var(--space-2);';
            option.onclick = () => selectProjectFromDropdown(project.id);
            option.onmouseover = () => option.style.backgroundColor = 'var(--bg-secondary)';
            option.onmouseout = () => option.style.backgroundColor = 'transparent';
            
            const projectColor = project.color || 'var(--primary-500)';
            option.innerHTML = `
                <div style="width: 8px; height: 8px; background-color: ${projectColor}; border-radius: 50%;"></div>
                <span style="font-size: var(--text-sm); color: var(--text-primary);">${project.name}</span>
            `;
            projectDropdownList.appendChild(option);
        });
    }
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
        
        // 로그인 화면 숨기고 메인 앱 표시
        elements.loginScreen.style.display = 'none';
        elements.mainApp.style.display = 'block';
        
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
        // 기존의 첫 번째 워크스페이스 찾기 (모든 사용자가 공유)
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
            // 기존 워크스페이스가 있으면 그것을 사용
            targetWorkspace = existingWorkspaces[0];
        } else {
            // 첫 번째 사용자인 경우에만 새 워크스페이스 생성
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

        // 현재 사용자를 워크스페이스 멤버로 추가
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
    updateProjectFilterOptions(); // 필터 옵션 업데이트
    
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
    // 콘솔에 로깅
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 시각적 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 스타일 설정
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
    
    // 타입별 색상 설정
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
        default: // info
            notification.style.backgroundColor = '#3b82f6';
            notification.style.color = 'white';
    }
    
    notification.textContent = message;
    
    // 문서에 추가
    document.body.appendChild(notification);
    
    // 클릭 시 제거
    notification.addEventListener('click', () => {
        notification.remove();
    });
    
    // 자동 제거 (3초 후)
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
            project_id: taskProject,  // UUID는 문자열로 유지
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
            // Supabase에 저장 - project_id를 문자열로 전송 (UUID 타입)
            const { data, error } = await supabase
                .from('todos')
                .insert([{
                    title: taskTitle.trim(),
                    description: taskDescription?.trim() || '',
                    project_id: taskProject,  // parseInt 제거 - UUID는 문자열
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
        updateProjectFilterOptions(); // 필터 옵션 업데이트
        
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
        updateProjectFilterOptions(); // 필터 옵션 업데이트
        
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
    updateProjectFilterOptions(); // 필터 옵션 초기화
    
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
            
            // 해당 날짜의 할 일 찾기 (마감일 기준)
            const dayTasks = currentTasks.filter(task => {
                if (!task.due_date) return false;
                const taskDate = getKoreanTime(new Date(task.due_date));
                const koreanCalendarDate = getKoreanTime(currentCalendarDate);
                return taskDate.toDateString() === koreanCalendarDate.toDateString();
            });
            
            // 날짜 범위에 포함된 태스크 찾기 (시작일-마감일 사이)
            const rangeInTasks = currentTasks.filter(task => {
                const startDate = task.start_date ? getKoreanTime(new Date(task.start_date)) : null;
                const dueDate = task.due_date ? getKoreanTime(new Date(task.due_date)) : null;
                const currentDate = getKoreanTime(new Date(currentCalendarDate));
                currentDate.setHours(0, 0, 0, 0);
                
                // 시작일이 있고 마감일이 있는 경우
                if (startDate && dueDate) {
                    startDate.setHours(0, 0, 0, 0);
                    dueDate.setHours(0, 0, 0, 0);
                    return currentDate >= startDate && currentDate <= dueDate;
                }
                // 마감일만 있는 경우
                else if (dueDate) {
                    dueDate.setHours(0, 0, 0, 0);
                    return currentDate.getTime() === dueDate.getTime();
                }
                
                return false;
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
                const dueDate = getKoreanTime(new Date(task.due_date));
                const koreanCalendarDate = getKoreanTime(currentCalendarDate);
                return dueDate.toDateString() === koreanCalendarDate.toDateString();
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

            // 모든 관련 태스크 표시 (마감일 태스크 + 범위 내 태스크)
            const allDayTasks = [...new Set([...dayTasks, ...rangeInTasks])]; // 중복 제거
            
            if (allDayTasks.length > 0) {
                calendarHTML += `<div class="calendar-tasks" style="display: flex; flex-wrap: wrap; gap: 2px; margin-top: var(--space-1); min-height: 18px;">`;
                
                // 모든 태스크를 점으로 표시
                const maxDots = Math.min(allDayTasks.length, 10);
                for (let i = 0; i < maxDots; i++) {
                    const task = allDayTasks[i];
                    const project = currentProjects.find(p => p.id === task.project_id);
                    const projectColor = project ? project.color : '#3B82F6';
                    
                    // 마감일인지 범위 내인지 구분
                    const isDueDate = dayTasks.some(t => t.id === task.id);
                    const isInRange = rangeInTasks.some(t => t.id === task.id) && !isDueDate;
                    
                    // 태스크 바 스타일
                    const taskBarStyle = isDueDate 
                        ? `background-color: ${projectColor}; border: 2px solid ${projectColor}; font-weight: 600;`
                        : `background-color: ${projectColor}30; border: 1px solid ${projectColor}; color: ${projectColor};`;
                    
                    calendarHTML += `
                        <div class="task-dot" 
                             data-task-id="${task.id}"
                             style="width: 8px; height: 8px; border-radius: 50%; background-color: ${projectColor}; margin: 1px; cursor: pointer; display: inline-block;"
                             title="${task.title} ${isDueDate ? '(마감일)' : '(진행중)'}">
                        </div>`;
                }
                
                // 더 많은 할일이 있으면 +표시
                if (allDayTasks.length > 10) {
                    calendarHTML += `<div style="font-size: 9px; color: var(--text-tertiary); margin-left: 2px;">+${allDayTasks.length - 10}</div>`;
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
            const taskDate = getKoreanTime(new Date(task.due_date));
            const koreanSelectedDate = getKoreanTime(selectedDate);
            if (taskDate.toDateString() === koreanSelectedDate.toDateString()) {
                return true;
            }
        }
        
        // 시작일과 마감일 사이 범위에 선택된 날짜가 포함된 할일
        if (task.start_date && task.due_date) {
            const startDate = getKoreanTime(new Date(task.start_date));
            const dueDate = getKoreanTime(new Date(task.due_date));
            const koreanSelectedDate = getKoreanTime(selectedDate);
            return koreanSelectedDate >= startDate && koreanSelectedDate <= dueDate;
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
function handleTaskEdit(e) {
    // 이벤트가 전달되면 기본 동작 및 버블링 방지
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
        e.stopPropagation();
    }
    
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
        // task 객체에서 직접 제목 가져오기 (더 안전함)
        const currentTitle = task.title || titleElement.textContent.trim();
        console.log('현재 제목:', currentTitle);
        
        // HTML escape 처리
        const escapedTitle = currentTitle.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        titleElement.innerHTML = `<input type="text" id="editTaskTitle" class="form-control" value="${escapedTitle}" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">`;
        
        // Enter 키로 저장, Esc 키로 취소
        const titleInput = document.getElementById('editTaskTitle');
        if (titleInput) {
            // 값 다시 설정 (보험용)
            titleInput.value = currentTitle;
            titleInput.focus();
            titleInput.select(); // 텍스트 전체 선택
            
            // Enter 키로 저장 기능 완전히 제거
            titleInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTaskEdit(task);
                }
                // Enter 키 이벤트 기본 동작 막기
                if (e.key === 'Enter') {
                    e.preventDefault(); // Enter 키의 기본 동작 및 이벤트 전파 방지
                    return false;
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
        // task 객체에서 직접 설명 가져오기
        const currentDescription = task.description || descriptionElement.textContent.trim();
        console.log('현재 설명:', currentDescription);
        
        // HTML escape 처리
        const escapedDescription = currentDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        descriptionElement.innerHTML = `<textarea id="editTaskDescription" class="form-control" rows="3" style="background-color: #fff3cd; border-color: #ffeaa7; color: black;">${escapedDescription}</textarea>`;
        
        const descriptionTextarea = document.getElementById('editTaskDescription');
        if (descriptionTextarea) {
            // 값 다시 설정 (보험용)
            descriptionTextarea.value = currentDescription;
            
            // Enter 키로 저장 기능 완전 제거
            descriptionTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTaskEdit(task);
                }
                // Enter 키 저장 기능 제거 (Shift+Enter는 줄바꿈으로 유지)
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.stopPropagation(); // 이벤트 버블링 방지
                    // 줄바꿈 허용 - 저장 기능은 없애기
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
        // 기존 이벤트 리스너 모두 제거 (중요: 이 부분이 핵심 버그 수정)
        console.log('기존 이벤트 리스너 제거 시작');
        
        editBtn.onclick = null;
        editBtn.removeEventListener('click', handleTaskEdit);
        
        // 모든 기존 이벤트 리스너 제거
        if (editBtn._saveHandler) {
            editBtn.removeEventListener('click', editBtn._saveHandler);
            editBtn._saveHandler = null;
        }
        if (editBtn._oldClickListener) {
            editBtn.removeEventListener('click', editBtn._oldClickListener);
            editBtn._oldClickListener = null;
        }
        
        // 완전히 새로운 버튼으로 내용 변경
        editBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        editBtn.title = '저장';
        editBtn.style.backgroundColor = 'var(--success-500)';
        editBtn.style.color = 'white';
        
        // 저장 버튼 클릭 시 실행할 완전히 새로운 함수 생성
        const saveTaskHandler = async function(e) {
            console.log('저장 핸들러 실행됨');
            e.preventDefault();
            e.stopPropagation();
            
            // 중복 클릭 방지
            if (editBtn.disabled) return;
            editBtn.disabled = true;
            
            console.log('저장 버튼 클릭됨, task:', task);
            
            try {
                // DOM에서 직접 편집 필드 값 가져오기
                const titleInput = document.getElementById('editTaskTitle');
                const descriptionTextarea = document.getElementById('editTaskDescription');
                const startDateInput = document.getElementById('editTaskStartDate');
                const dueDateInput = document.getElementById('editTaskDueDate');
                const projectSelect = document.getElementById('editTaskProject');
                
                console.log('DOM에서 찾은 편집 필드:', {
                    titleInput: titleInput ? titleInput.value : null,
                    descriptionTextarea: descriptionTextarea ? descriptionTextarea.value : null,
                    startDateInput: startDateInput ? startDateInput.value : null,
                    dueDateInput: dueDateInput ? dueDateInput.value : null,
                    projectSelect: projectSelect ? projectSelect.value : null
                });
                
                if (!titleInput || !descriptionTextarea) {
                    console.error('필수 편집 필드를 찾을 수 없음');
                    showNotification('편집 중인 내용을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                // 업데이트할 데이터 생성
                const updatedData = {
                    title: titleInput.value.trim(),
                    description: descriptionTextarea.value.trim(),
                    project_id: projectSelect ? projectSelect.value : task.project_id,
                    start_date: startDateInput ? startDateInput.value || null : task.start_date,
                    due_date: dueDateInput ? dueDateInput.value || null : task.due_date,
                    updated_at: new Date().toISOString()
                };
                
                // 유효성 검사
                if (!updatedData.title.trim()) {
                    showNotification('제목을 입력해주세요.', 'warning');
                    titleInput.focus();
                    editBtn.disabled = false;
                    return;
                }
                
                console.log('저장 시작:', {
                    isDemoMode: isDemoMode,
                    hasSupabase: !!supabase,
                    taskId: task.id,
                    updatedData: updatedData
                });
                
                // 데이터 저장 처리
                if (isDemoMode) {
                    console.log('데모 모드에서 작업 저장:', updatedData);
                    
                    // 데모 모드 저장 로직
                    const taskIndex = currentTasks.findIndex(t => t.id === task.id);
                    if (taskIndex !== -1) {
                        // 기존 작업 데이터와 병합
                        const updatedTask = {...currentTasks[taskIndex], ...updatedData};
                        currentTasks[taskIndex] = updatedTask;
                        
                        // 로컬 스토리지에 저장
                        localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                        console.log('데모 모드: 로컬 스토리지에 저장 완료');
                        
                        // 편집 모드 종료
                        disableTaskEditMode();
                        
                        // 태스크 상세 정보 업데이트
                        populateTaskDetailModal(updatedTask);
                        
                        // UI 업데이트
                        updateRecentTasksList();
                        updateDashboardStats();
                        
                        showNotification('작업이 저장되었습니다.', 'success');
                    } else {
                        console.error('데모 모드: 작업을 찾을 수 없음:', task.id);
                        showNotification('작업을 찾을 수 없습니다.', 'error');
                    }
                } else if (supabase) {
                    console.log('Supabase 모드에서 작업 저장');
                    // Supabase 저장 로직 (수정된 데이터 직접 전달)
                    const { error } = await supabase
                        .from('todos')
                        .update(updatedData)
                        .eq('id', task.id);
                        
                    if (error) {
                        console.error('Supabase 작업 저장 오류:', error);
                        showNotification(`작업 저장 오류: ${error.message}`, 'error');
                        throw error;
                    }
                    
                    // 로컬 데이터 업데이트
                    const taskIndex = currentTasks.findIndex(t => t.id === task.id);
                    if (taskIndex !== -1) {
                        Object.assign(currentTasks[taskIndex], updatedData);
                    } else {
                        console.error('Supabase: 작업을 로컬 목록에서 찾을 수 없음:', task.id);
                    }
                    
                    // 편집 모드 종료
                    disableTaskEditMode();
                    
                    // 태스크 상세 정보 업데이트
                    const updatedTask = currentTasks.find(t => t.id === task.id);
                    if (updatedTask) {
                        populateTaskDetailModal(updatedTask);
                    }
                    
                    // UI 업데이트
                    updateRecentTasksList();
                    updateDashboardStats();
                    
                    showNotification('작업이 저장되었습니다.', 'success');
                } else {
                    console.error('저장 방법을 찾을 수 없음: 데모 모드가 아니고 Supabase도 초기화되지 않음');
                    showNotification('데이터 저장 방법을 설정할 수 없습니다. 페이지를 새로고침해보세요.', 'error');
                }
                
                console.log('작업 저장 완료');
            } catch (error) {
                console.error('작업 저장 중 오류:', error);
                showNotification('작업 저장 중 오류가 발생했습니다.', 'error');
            } finally {
                editBtn.disabled = false;
            }
        };
        
        // 모든 기존 이벤트 핸들러 완전히 제거
        const clone = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(clone, editBtn);
        
        // 새로운 버튼 참조 얻기
        const newEditBtn = document.getElementById('editTaskHeader');
        
        // 새로운 이벤트 리스너로 저장 함수 지정
        newEditBtn._saveHandler = saveTaskHandler;
        
        // 저장 함수를 이벤트 리스너와 onclick 속성 모두에 할당 (안전장치)
        newEditBtn.addEventListener('click', saveTaskHandler);
        newEditBtn.onclick = saveTaskHandler;
        
        console.log('저장 버튼 이벤트 리스너 설정 완료');
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
    showNotification('편집 모드가 활성화되었습니다.', 'info');
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
    console.log('saveTaskEdit 호출됨, task:', task);
    
    const titleInput = document.getElementById('editTaskTitle');
    const descriptionTextarea = document.getElementById('editTaskDescription');
    const startDateInput = document.getElementById('editTaskStartDate');
    const dueDateInput = document.getElementById('editTaskDueDate');
    const projectSelect = document.getElementById('editTaskProject');
    
    console.log('편집 필드들:', {
        titleInput: titleInput,
        descriptionTextarea: descriptionTextarea,
        startDateInput: startDateInput,
        dueDateInput: dueDateInput,
        projectSelect: projectSelect
    });
    
    if (!titleInput || !descriptionTextarea) {
        console.error('편집 필드를 찾을 수 없음:', {
            titleInput: !!titleInput,
            descriptionTextarea: !!descriptionTextarea
        });
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
                // 기존 작업 객체의 속성을 업데이트
                Object.assign(currentTasks[taskIndex], updateData);
                // 로컬 스토리지에 전체 목록 저장
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                console.log('로컬 스토리지에 저장 완료');
            } else {
                console.error('데모 모드: 작업을 찾을 수 없음:', task.id);
                showNotification('작업을 찾을 수 없습니다.', 'error');
                return;
            }
        } else if (supabase) {
            console.log('Supabase에 작업 저장:', task.id, updateData);
            
            // workspace_id 추가 (현재 워크스페이스 정보)
            if (currentWorkspace && currentWorkspace.id) {
                updateData.workspace_id = currentWorkspace.id;
            }
            
            // 날짜 형식 변환 (ISO 형식으로)
            if (updateData.start_date && updateData.start_date !== '') {
                updateData.start_date = new Date(updateData.start_date).toISOString();
            } else {
                updateData.start_date = null;
            }
            
            if (updateData.due_date && updateData.due_date !== '') {
                updateData.due_date = new Date(updateData.due_date).toISOString();
            } else {
                updateData.due_date = null;
            }
            
            console.log('Supabase 업데이트 데이터 최종:', updateData);
            
            const { data, error } = await supabase
                .from('todos')
                .update(updateData)
                .eq('id', task.id)
                .select();
                
            if (error) {
                console.error('Supabase 작업 저장 오류:', error);
                showNotification(`작업 저장 오류: ${error.message}`, 'error');
                throw error;
            }
            
            console.log('Supabase 작업 저장 성공:', data);
            
            // 로컬 데이터 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                Object.assign(currentTasks[taskIndex], updateData);
            } else {
                console.error('Supabase: 작업을 로컬 목록에서 찾을 수 없음:', task.id);
            }
        } else {
            console.error('Supabase: 데이터 저장 방법을 찾을 수 없음');
            showNotification('데이터베이스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }
        
        // 편집 모드 종료하고 일반 모드로 복원
        disableTaskEditMode();
        const updatedTask = currentTasks.find(t => t.id === task.id);
        if (updatedTask) {
            populateTaskDetailModal(updatedTask);
        }
        
        // UI 업데이트
        updateRecentTasksList();
        updateDashboardStats();
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
        
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
        // 기존 스타일과 내용 리셋
        editBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        `;
        editBtn.title = '작업 편집';
        editBtn.style.backgroundColor = '';
        editBtn.style.color = '';
        
        // 모든 이벤트 리스너 제거
        editBtn.onclick = null;
        
        // 저장 핸들러 제거
        if (editBtn._saveHandler) {
            editBtn.removeEventListener('click', editBtn._saveHandler);
            editBtn._saveHandler = null;
        }
        
        // 이전에 저장해둔 리스너도 제거
        if (editBtn._oldClickListener) {
            editBtn.removeEventListener('click', editBtn._oldClickListener);
            editBtn._oldClickListener = null;
        }
        
        // 편집 기능으로 새 이벤트 핸들러 설정
        const newEditHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleTaskEdit();
        };
        
        // 이벤트 리스너와 onclick 속성 모두에 할당
        editBtn.addEventListener('click', newEditHandler);
        editBtn.onclick = newEditHandler;
        
        console.log('편집 버튼 상태 복원 완료');
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
        
        // 기존 이벤트 리스너가 있다면 제거
        if (addCommentBtn._commentHandler) {
            addCommentBtn.removeEventListener('click', addCommentBtn._commentHandler);
        }
        
        // 새로운 댓글 추가 핸들러 생성 - 중복 호출 방지 로직은 handleAddComment() 함수 내부로 이동
        addCommentBtn._commentHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('댓글 추가 버튼 클릭됨');
            
            try {
                handleAddComment();
            } catch (error) {
                console.error('댓글 추가 처리 중 오류:', error);
                showNotification('댓글 추가 중 오류가 발생했습니다.', 'error');
            }
        };
        
        addCommentBtn.addEventListener('click', addCommentBtn._commentHandler);
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

    // 상태 (데이터베이스와 UI 상태 값 매핑) - 클릭 가능하도록 스타일 설정
    if (statusElement) {
        // 기존 이벤트 리스너 제거
        statusElement.onclick = null;
        statusElement.removeEventListener('click', handleStatusChange);
        
        // 새 이벤트 리스너 추가
        statusElement.addEventListener('click', handleStatusChange);
        
        // 클릭 가능함을 나타내는 커서 스타일
        statusElement.style.cursor = 'pointer';
        statusElement.title = '클릭하여 상태 선택';
        
        // 상태 업데이트
        updateTaskDetailStatus(task.status);
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

    // 진행률 정보 업데이트
    const taskProgress = task.progress !== undefined ? task.progress : 0;
    updateProgressDisplay(taskProgress);
    updateProgressSlider(taskProgress);
    updateProgressInput(taskProgress);

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
            
            // Supabase 댓글 조회 (created_by는 auth.users와 직접 연결됨)
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .or(`todo_id.eq.${taskId},task_id.eq.${taskId}`)
                .order('created_at', { ascending: false });
                
            if (error) {
                console.error('Supabase 댓글 로드 오류:', error);
                throw error;
            }
            
            // 댓글 데이터 가공 (author_name 필드 추가)
            comments = (data || []).map(comment => ({
                ...comment,
                author_id: comment.created_by,  // author_id 필드로 통일
                author_name: comment.created_by === currentUser?.id ? 
                           (currentUser?.user_metadata?.full_name || currentUser?.email || '나') : 
                           '사용자'
            }));
            
            console.log('Supabase에서 로드된 댓글 수:', comments.length);
            console.log('로드된 댓글 데이터:', comments);
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
                <div style="display: flex; gap: var(--space-2);">
                    ${(comment.author_id || comment.created_by) === (currentUser?.id || 'demo-user') ? `
                        <button class="btn btn-ghost btn-xs" onclick="editComment('${comment.id}')" title="댓글 수정">
                            <svg style="width: 0.875rem; height: 0.875rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-ghost btn-xs" onclick="deleteComment('${comment.id}')" title="댓글 삭제" style="color: var(--error-600);">
                            <svg style="width: 0.875rem; height: 0.875rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p style="color: var(--text-secondary); line-height: var(--leading-relaxed); margin: 0;">${comment.content || ''}</p>
        </div>
    `).join('');
    
    console.log('댓글 렌더링 완료');
}



// 댓글 추가 진행 중 플래그
let isAddingComment = false;

// 댓글 추가 핸들러 (async 함수로 수정)
async function handleAddComment() {
    // 중복 호출 방지
    if (isAddingComment) {
        console.log('댓글 추가가 이미 진행 중입니다.');
        return;
    }
    
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
    
    // 댓글 추가 진행 중 플래그 설정
    isAddingComment = true;
    
    // 댓글 추가 버튼 비활성화
    const addCommentBtn = document.getElementById('addComment');
    if (addCommentBtn) {
        addCommentBtn.disabled = true;
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
            
            // Supabase 테이블 구조에 맞는 댓글 데이터 생성
            const commentData = {
                todo_id: currentTaskId,  // 필수 외래키
                task_id: currentTaskId,  // 추가 참조 필드
                content: content,
                created_by: currentUser?.id || null  // Supabase auth.users와 연결
            };
            
            console.log('Supabase에 저장할 댓글 데이터:', commentData);
            console.log('현재 사용자 정보:', {
                id: currentUser?.id,
                email: currentUser?.email,
                full_name: currentUser?.user_metadata?.full_name
            });
            
            // Supabase에 저장
            const { data, error } = await supabase
                .from('comments')
                .insert([commentData])
                .select('*');
                
            if (error) {
                console.error('Supabase 댓글 추가 오류:', error);
                showNotification(`댓글 추가 오류: ${error.message}`, 'error');
                throw error;
            }
            
            console.log('Supabase에 댓글 추가 성공:', data);
            
            // 로컬 댓글 목록에 추가 (UI 즉시 업데이트용)
            if (data && data.length > 0) {
                const savedComment = data[0];
                const localComment = {
                    id: savedComment.id,
                    task_id: savedComment.task_id,
                    todo_id: savedComment.todo_id,
                    content: savedComment.content,
                    created_at: savedComment.created_at,
                    author_name: currentUser?.user_metadata?.full_name || currentUser?.email || '사용자',
                    author_id: savedComment.created_by
                };
                currentComments.push(localComment);
            }
            
            showNotification('댓글이 추가되었습니다.', 'success');
        }
        
        // 댓글 입력창 초기화
        commentTextarea.value = '';
        
        // 댓글 목록 새로고침
        loadTaskComments(currentTaskId);
        
    } catch (error) {
        console.error('댓글 추가 실패:', error);
        showNotification('댓글 추가에 실패했습니다.', 'error');
    } finally {
        // 댓글 추가 진행 중 플래그 해제
        isAddingComment = false;
        
        // 댓글 추가 버튼 활성화
        if (addCommentBtn) {
            addCommentBtn.disabled = false;
        }
    }
}

// 작업 상태 변경 드롭다운 토글
function handleStatusChange() {
    if (!currentTaskId) {
        console.error('현재 작업 ID가 없습니다.');
        return;
    }
    
    toggleStatusDropdown();
}

// 상태 드롭다운 표시/숨기기
function toggleStatusDropdown() {
    const statusElement = document.getElementById('taskDetailStatus');
    if (!statusElement) return;
    
    // 기존 드롭다운이 있으면 제거
    const existingDropdown = document.getElementById('statusDropdown');
    if (existingDropdown) {
        existingDropdown.remove();
        return;
    }
    
    // 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.id = 'statusDropdown';
    dropdown.className = 'position-absolute bg-white border';
    dropdown.style.cssText = `
        top: 100%;
        left: 0;
        min-width: 100px;
        z-index: 1000;
        margin-top: 2px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;
    
    // 상태 옵션들
    const statusOptions = [
        { value: 'pending', text: '대기중' },
        { value: 'in_progress', text: '진행중' },
        { value: 'completed', text: '완료' }
    ];
    
    // 현재 작업의 상태
    const task = currentTasks.find(t => t.id === currentTaskId);
    const currentStatus = task?.status || 'pending';
    
    statusOptions.forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'px-3 py-2';
        item.style.cssText = `
            cursor: pointer;
            font-size: 14px;
            ${index > 0 ? 'border-top: 1px solid #eee;' : ''}
            ${option.value === currentStatus ? 'background-color: #f8f9fa; font-weight: 500;' : ''}
        `;
        
        // 현재 상태인 경우 체크 표시
        const checkIcon = option.value === currentStatus ? '✓ ' : '';
        
        item.innerHTML = `${checkIcon}${option.text}`;
        
        // 호버 효과
        item.addEventListener('mouseenter', () => {
            if (option.value !== currentStatus) {
                item.style.backgroundColor = '#f8f9fa';
            }
        });
        
        item.addEventListener('mouseleave', () => {
            if (option.value !== currentStatus) {
                item.style.backgroundColor = '';
            }
        });
        
        // 클릭 이벤트
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            await changeTaskStatus(option.value);
            dropdown.remove();
        });
        
        dropdown.appendChild(item);
    });
    
    // 상태 요소를 relative position으로 설정
    statusElement.style.position = 'relative';
    statusElement.appendChild(dropdown);
    
    // 외부 클릭 시 드롭다운 닫기
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && !statusElement.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeDropdown);
    }, 10);
}

// 작업 상태 변경 실행
async function changeTaskStatus(newStatus) {
    if (!currentTaskId) {
        console.error('현재 작업 ID가 없습니다.');
        return;
    }
    
    const task = currentTasks.find(t => t.id === currentTaskId);
    if (!task) {
        console.error('현재 작업을 찾을 수 없습니다.');
        return;
    }
    
    // 현재 상태와 같으면 변경하지 않음
    if (task.status === newStatus) {
        return;
    }
    
    try {
        console.log('작업 상태 변경:', task.status, '→', newStatus);
        
        if (isDemoMode) {
            // 데모 모드에서 상태 변경
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = newStatus;
                currentTasks[taskIndex].updated_at = new Date().toISOString();
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                console.log('데모 모드에서 상태 변경 완료');
            }
        } else {
            // Supabase에서 상태 변경
            const { error } = await supabase
                .from('todos')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentTaskId);
                
            if (error) {
                console.error('Supabase 상태 업데이트 실패:', error);
                showNotification('상태 변경에 실패했습니다.', 'error');
                return;
            }
            
            // 로컬 데이터도 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = newStatus;
                currentTasks[taskIndex].updated_at = new Date().toISOString();
            }
            
            console.log('Supabase에서 상태 변경 완료');
        }
        
        // 상태 UI 업데이트
        updateTaskDetailStatus(newStatus);
        
        // 대시보드와 다른 뷰들 새로고침
        updateDashboard();
        if (currentView === 'calendar') {
            renderCalendar();
        }
        
        showNotification('작업 상태가 변경되었습니다.', 'success');
        
    } catch (error) {
        console.error('상태 변경 실패:', error);
        showNotification('상태 변경에 실패했습니다.', 'error');
    }
}

// 작업 상세 모달의 상태 표시 업데이트
function updateTaskDetailStatus(status) {
    const statusElement = document.getElementById('taskDetailStatus');
    if (!statusElement) return;
    
    // 상태에 따른 텍스트와 스타일 설정
    const statusConfig = {
        'pending': {
            text: '대기중',
            className: 'btn-warning',
            style: 'background-color: var(--warning-500)20; color: var(--warning-500); border-color: var(--warning-500)50;'
        },
        'in_progress': {
            text: '진행중',
            className: 'btn-primary',
            style: 'background-color: var(--primary-500)20; color: var(--primary-500); border-color: var(--primary-500)50;'
        },
        'completed': {
            text: '완료',
            className: 'btn-success',
            style: 'background-color: var(--success-500)20; color: var(--success-500); border-color: var(--success-500)50;'
        }
    };
    
    const config = statusConfig[status] || statusConfig['pending'];
    
    // 기존 클래스 제거
    statusElement.className = 'btn btn-sm';
    // 새 클래스 추가
    statusElement.classList.add(config.className);
    // 텍스트 업데이트
    statusElement.textContent = config.text;
    // 스타일 적용
    statusElement.setAttribute('style', config.style);
}

// 진행률 슬라이더 변경 처리
function handleProgressSliderChange(event) {
    const value = parseInt(event.target.value);
    updateProgressDisplay(value);
    updateProgressInput(value);
    
    // 디바운스를 위한 타이머 클리어 및 설정
    if (window.progressUpdateTimer) {
        clearTimeout(window.progressUpdateTimer);
    }
    
    window.progressUpdateTimer = setTimeout(() => {
        saveProgressChange(value);
    }, 500); // 500ms 후 저장
}

// 진행률 입력 필드 변경 처리
function handleProgressInputChange(event) {
    let value = parseInt(event.target.value);
    
    // 범위 검증
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    
    updateProgressDisplay(value);
    updateProgressSlider(value);
}

// 진행률 입력 필드 포커스 아웃 처리
function handleProgressInputBlur(event) {
    let value = parseInt(event.target.value);
    
    // 범위 검증 및 수정
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    
    // 입력 필드 값 보정
    event.target.value = value;
    
    updateProgressDisplay(value);
    updateProgressSlider(value);
    saveProgressChange(value);
}

// 진행률 표시 업데이트
function updateProgressDisplay(progress) {
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');
    
    if (progressPercentage) {
        progressPercentage.textContent = `${progress}%`;
    }
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        
        // 진행률에 따른 색상 변경
        if (progress === 0) {
            progressBar.style.backgroundColor = 'var(--neutral-400)';
        } else if (progress === 100) {
            progressBar.style.backgroundColor = 'var(--success-500)';
        } else {
            progressBar.style.backgroundColor = 'var(--primary-500)';
        }
    }
    
    if (progressStatus) {
        let statusText = '시작 전';
        if (progress > 0 && progress < 100) {
            statusText = '진행중';
        } else if (progress === 100) {
            statusText = '완료';
        }
        progressStatus.textContent = statusText;
    }
}

// 진행률 슬라이더 업데이트
function updateProgressSlider(value) {
    const progressSlider = document.getElementById('progressSlider');
    if (progressSlider) {
        progressSlider.value = value;
    }
}

// 진행률 입력 필드 업데이트
function updateProgressInput(value) {
    const progressInput = document.getElementById('progressInput');
    if (progressInput) {
        progressInput.value = value;
    }
}

// 진행률 변경 저장
async function saveProgressChange(progress) {
    if (!currentTaskId) {
        console.error('현재 작업 ID가 없습니다.');
        return;
    }
    
    const task = currentTasks.find(t => t.id === currentTaskId);
    if (!task) {
        console.error('현재 작업을 찾을 수 없습니다.');
        return;
    }
    
    try {
        console.log('진행률 변경 저장:', progress);
        
        if (isDemoMode) {
            // 데모 모드에서 진행률 저장
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].progress = progress;
                currentTasks[taskIndex].updated_at = new Date().toISOString();
                localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
                console.log('데모 모드에서 진행률 저장 완료');
            }
        } else {
            // Supabase에서 진행률 저장
            const { error } = await supabase
                .from('todos')
                .update({ 
                    progress: progress,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentTaskId);
                
            if (error) {
                console.error('Supabase 진행률 업데이트 실패:', error);
                showNotification('진행률 저장에 실패했습니다.', 'error');
                return;
            }
            
            // 로컬 데이터도 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].progress = progress;
                currentTasks[taskIndex].updated_at = new Date().toISOString();
            }
            
            console.log('Supabase에서 진행률 저장 완료');
        }
        
        // 대시보드 새로고침 (진행률이 프로젝트 통계에 영향을 줄 수 있음)
        updateDashboard();
        if (currentView === 'calendar') {
            renderCalendar();
        }
        
        showNotification('진행률이 업데이트되었습니다.', 'success');
        
    } catch (error) {
        console.error('진행률 저장 실패:', error);
        showNotification('진행률 저장에 실패했습니다.', 'error');
    }
}

// 댓글 새로고침 처리 함수
async function handleRefreshComments() {
    if (!currentTaskId) {
        console.error('현재 작업 ID가 없습니다.');
        return;
    }
    
    const refreshBtn = document.getElementById('refreshComments');
    if (!refreshBtn) return;
    
    try {
        // 버튼 비활성화 및 로딩 애니메이션
        refreshBtn.disabled = true;
        const originalIcon = refreshBtn.innerHTML;
        refreshBtn.innerHTML = `
            <svg style="width: 1rem; height: 1rem; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
        `;
        
        // 댓글 다시 로드
        await loadTaskComments(currentTaskId);
        
        showNotification('댓글이 새로고침되었습니다.', 'success');
        
    } catch (error) {
        console.error('댓글 새로고침 실패:', error);
        showNotification('댓글 새로고침에 실패했습니다.', 'error');
    } finally {
        // 버튼 복원
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = `
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                `;
            }
        }, 1000); // 1초 후 버튼 복원
    }
}

// 댓글 삭제 함수
async function deleteComment(commentId) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        console.log('댓글 삭제 시작:', commentId);
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 삭제
            let comments = [];
            const storedComments = localStorage.getItem('demo_comments');
            if (storedComments) {
                comments = JSON.parse(storedComments);
                comments = comments.filter(c => c.id !== commentId);
                localStorage.setItem('demo_comments', JSON.stringify(comments));
                console.log('로컬 스토리지에서 댓글 삭제 완료');
            }
        } else if (supabase) {
            // Supabase에서 삭제
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);
                
            if (error) {
                console.error('Supabase 댓글 삭제 오류:', error);
                showNotification(`댓글 삭제 오류: ${error.message}`, 'error');
                throw error;
            }
            
            console.log('Supabase에서 댓글 삭제 완료');
        }
        
        showNotification('댓글이 삭제되었습니다.', 'success');
        
        // 댓글 목록 새로고침
        if (currentTaskId) {
            loadTaskComments(currentTaskId);
        }
        
    } catch (error) {
        console.error('댓글 삭제 실패:', error);
        showNotification('댓글 삭제에 실패했습니다.', 'error');
    }
}

// 댓글 수정 함수
async function editComment(commentId) {
    try {
        console.log('댓글 수정 시작:', commentId);
        
        // 현재 댓글 찾기
        let comment = null;
        
        if (isDemoMode) {
            const storedComments = localStorage.getItem('demo_comments');
            if (storedComments) {
                const comments = JSON.parse(storedComments);
                comment = comments.find(c => c.id === commentId);
            }
        } else if (supabase) {
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('id', commentId)
                .single();
                
            if (error) {
                console.error('댓글 조회 오류:', error);
                throw error;
            }
            
            comment = data;
        }
        
        if (!comment) {
            showNotification('댓글을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 새로운 내용 입력받기
        const newContent = prompt('댓글을 수정하세요:', comment.content);
        if (!newContent || newContent.trim() === '') {
            return; // 취소하거나 빈 내용
        }
        
        // 댓글 업데이트
        if (isDemoMode) {
            let comments = [];
            const storedComments = localStorage.getItem('demo_comments');
            if (storedComments) {
                comments = JSON.parse(storedComments);
                const commentIndex = comments.findIndex(c => c.id === commentId);
                if (commentIndex !== -1) {
                    comments[commentIndex].content = newContent.trim();
                    comments[commentIndex].updated_at = new Date().toISOString();
                    localStorage.setItem('demo_comments', JSON.stringify(comments));
                }
            }
        } else if (supabase) {
            const { error } = await supabase
                .from('comments')
                .update({
                    content: newContent.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', commentId);
                
            if (error) {
                console.error('댓글 수정 오류:', error);
                showNotification(`댓글 수정 오류: ${error.message}`, 'error');
                throw error;
            }
        }
        
        showNotification('댓글이 수정되었습니다.', 'success');
        
        // 댓글 목록 새로고침
        if (currentTaskId) {
            loadTaskComments(currentTaskId);
        }
        
    } catch (error) {
        console.error('댓글 수정 실패:', error);
        showNotification('댓글 수정에 실패했습니다.', 'error');
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
                <button class="btn btn-ghost btn-sm" onclick="openNewTaskModal('${project.id}')">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    할 일 추가
                </button>
                <button class="btn btn-ghost btn-sm" onclick="editProject('${project.id}')">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    편집
                </button>
                <button class="btn btn-ghost btn-sm" onclick="deleteProject('${project.id}')" style="color: var(--error-600);">
                    <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    삭제
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

// 프로젝트 편집
function editProject(projectId) {
    const project = currentProjects.find(p => p.id === projectId);
    if (!project) {
        showNotification('프로젝트를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 현재 편집 중인 프로젝트 저장
    currentEditingProject = project;
    
    // 폼에 데이터 채우기
    document.getElementById('editProjectName').value = project.name || '';
    document.getElementById('editProjectDescription').value = project.description || '';
    document.getElementById('editProjectColor').value = project.color || '#3B82F6';
    
    // 색상 선택기 업데이트
    const colorPicker = document.getElementById('editColorPicker');
    if (colorPicker) {
        const colorOptions = colorPicker.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.color === project.color) {
                option.classList.add('selected');
            }
        });
    }
    
    // 모달 표시
    openModal('projectEditModal');
}

// 프로젝트 삭제
async function deleteProject(projectId) {
    const project = currentProjects.find(p => p.id === projectId);
    if (!project) {
        showNotification('프로젝트를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 확인 메시지
    if (!confirm(`'${project.name}' 프로젝트를 삭제하시겠습니까?\n이 프로젝트의 모든 할 일도 함께 삭제됩니다.`)) {
        return;
    }
    
    try {
        if (isDemoMode) {
            // 데모 모드에서 로컬 삭제
            currentProjects = currentProjects.filter(p => p.id !== projectId);
            currentTasks = currentTasks.filter(t => t.project_id !== projectId);
            localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
            localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
        } else if (supabase) {
            console.log('Supabase에서 프로젝트 삭제 시작:', projectId);
            
            // workspace_id 조건 추가하여 보안 강화
            const workspaceCondition = currentWorkspace && currentWorkspace.id ? 
                { project_id: projectId, workspace_id: currentWorkspace.id } : 
                { project_id: projectId };
            
            // 먼저 관련된 댓글들 삭제 (todos와 연관된)
            const relatedTodos = currentTasks.filter(t => t.project_id === projectId);
            for (const todo of relatedTodos) {
                const { error: commentsError } = await supabase
                    .from('comments')
                    .delete()
                    .eq('todo_id', todo.id);
                    
                if (commentsError) {
                    console.error('댓글 삭제 오류:', commentsError);
                    // 댓글 삭제 실패는 치명적이지 않으므로 계속 진행
                }
                
                // task_id로도 삭제 시도
                const { error: taskCommentsError } = await supabase
                    .from('comments')
                    .delete()
                    .eq('task_id', todo.id);
                    
                if (taskCommentsError) {
                    console.error('Task 댓글 삭제 오류:', taskCommentsError);
                }
            }
            
            // 관련된 할 일들 삭제
            const { error: tasksError } = await supabase
                .from('todos')
                .delete()
                .match(workspaceCondition);
                
            if (tasksError) {
                console.error('프로젝트 할 일 삭제 오류:', tasksError);
                showNotification(`할 일 삭제 오류: ${tasksError.message}`, 'error');
                throw tasksError;
            }
            
            console.log('프로젝트 관련 할 일 삭제 완료');
            
            // 프로젝트 삭제 (workspace 조건 추가)
            const projectDeleteCondition = currentWorkspace && currentWorkspace.id ? 
                { id: projectId, workspace_id: currentWorkspace.id } : 
                { id: projectId };
                
            const { error: projectError } = await supabase
                .from('projects')
                .delete()
                .match(projectDeleteCondition);
                
            if (projectError) {
                console.error('프로젝트 삭제 오류:', projectError);
                showNotification(`프로젝트 삭제 오류: ${projectError.message}`, 'error');
                throw projectError;
            }
            
            console.log('프로젝트 삭제 완료');
            
            // 로컬 데이터 업데이트
            currentProjects = currentProjects.filter(p => p.id !== projectId);
            currentTasks = currentTasks.filter(t => t.project_id !== projectId);
        }
        
        // UI 업데이트
        updateProjectsView();
        updateDashboard();
        renderCalendar();
        
        // 모달 닫기
        closeModal('projectEditModal');
        
        showNotification(`'${project.name}' 프로젝트가 삭제되었습니다.`, 'success');
        
    } catch (error) {
        console.error('프로젝트 삭제 실패:', error);
        showNotification('프로젝트 삭제에 실패했습니다.', 'error');
    }
}

// 프로젝트 편집 저장
async function saveProjectEdit() {
    if (!currentEditingProject) {
        showNotification('편집할 프로젝트가 선택되지 않았습니다.', 'error');
        return;
    }
    
    const name = document.getElementById('editProjectName').value.trim();
    const description = document.getElementById('editProjectDescription').value.trim();
    const color = document.getElementById('editProjectColor').value;
    
    if (!name) {
        showNotification('프로젝트 이름을 입력해주세요.', 'warning');
        return;
    }
    
    try {
        const updateData = {
            name,
            description,
            color,
            updated_at: new Date().toISOString()
        };
        
        if (isDemoMode) {
            // 데모 모드에서 로컬 업데이트
            const projectIndex = currentProjects.findIndex(p => p.id === currentEditingProject.id);
            if (projectIndex !== -1) {
                Object.assign(currentProjects[projectIndex], updateData);
                localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
            }
        } else if (supabase) {
            // Supabase에 업데이트
            const { error } = await supabase
                .from('projects')
                .update(updateData)
                .eq('id', currentEditingProject.id);
                
            if (error) {
                console.error('프로젝트 업데이트 오류:', error);
                throw error;
            }
            
            // 로컬 데이터 업데이트
            const projectIndex = currentProjects.findIndex(p => p.id === currentEditingProject.id);
            if (projectIndex !== -1) {
                Object.assign(currentProjects[projectIndex], updateData);
            }
        }
        
        // UI 업데이트
        updateProjectsView();
        updateDashboard();
        
        // 모달 닫기
        closeModal('projectEditModal');
        currentEditingProject = null;
        
        showNotification('프로젝트가 성공적으로 수정되었습니다.', 'success');
        
    } catch (error) {
        console.error('프로젝트 수정 실패:', error);
        showNotification('프로젝트 수정에 실패했습니다.', 'error');
    }
}

// 캘린더 뷰 변경
function changeCalendarView(view) {
    calendarView = view;
    renderCalendar();
    console.log(`캘린더 뷰가 ${view}로 변경되었습니다.`);
}

// 캘린더 날짜 이동
function moveCalendarDate(direction) {
    if (calendarView === 'week') {
        // 주간 뷰에서는 1주씩 이동
        if (direction === 'prev') {
            currentDate.setDate(currentDate.getDate() - 7);
        } else if (direction === 'next') {
            currentDate.setDate(currentDate.getDate() + 7);
        }
        renderWeekView();
    } else {
        // 월간 뷰에서는 1달씩 이동
        if (direction === 'prev') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else if (direction === 'next') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        renderCalendar();
    }
    
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
                // 기존 이벤트 리스너 제거 후 재설정
                demoBtn.removeEventListener('click', handleDemoMode);
                demoBtn.onclick = null; // 기존 onclick 핸들러 제거
                demoBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('데모 버튼 클릭됨');
                    handleDemoMode();
                });
            }
            

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