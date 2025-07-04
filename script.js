// 환경변수 설정
const getEnvVar = (name, fallback = '') => {
    // Vercel 환경변수 또는 브라우저 환경변수에서 읽기
    if (typeof window !== 'undefined' && window.env) {
        return window.env[name] || fallback;
    }
    // 개발 환경에서는 fallback 사용
    return fallback;
};

// Supabase 설정 (환경변수에서 로드)
const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', '');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', '');

// Supabase 클라이언트 초기화
let supabase = null;
try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase 클라이언트 초기화 완료');
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

// DOM 요소
const elements = {
    loading: document.getElementById('loading'),
    loginScreen: document.getElementById('loginScreen'),
    mainApp: document.getElementById('mainApp'),
    loginBtn: document.getElementById('loginBtn'),
    demoBtn: document.getElementById('demoBtn'),
    projectFilterBtn: document.getElementById('projectFilterBtn'),
    projectFilterDropdown: document.getElementById('projectFilterDropdown'),
    projectFilterList: document.getElementById('projectFilterList'),
    advancedFilterBtn: document.getElementById('advancedFilterBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    userMenuBtn: document.getElementById('userMenuBtn'),
    userMenu: document.getElementById('userMenu'),
    
    // Navigation
    dashboardBtn: document.getElementById('dashboardBtn'),
    calendarBtn: document.getElementById('calendarBtn'),
    projectsBtn: document.getElementById('projectsBtn'),
    
    // Views
    dashboardView: document.getElementById('dashboardView'),
    calendarView: document.getElementById('calendarView'),
    projectsView: document.getElementById('projectsView'),
    
    // Stats
    totalTasks: document.getElementById('totalTasks'),
    inProgressTasks: document.getElementById('inProgressTasks'),
    completedTasks: document.getElementById('completedTasks'),
    pendingTasks: document.getElementById('pendingTasks'),
    
    // Tasks
    tasksList: document.getElementById('tasksList'),
    newTaskBtn: document.getElementById('newTaskBtn'),
    newTaskModal: document.getElementById('newTaskModal'),
    newTaskForm: document.getElementById('newTaskForm'),
    cancelTaskBtn: document.getElementById('cancelTaskBtn'),
    
    // Projects
    projectsList: document.getElementById('projectsList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    newProjectModal: document.getElementById('newProjectModal'),
    newProjectForm: document.getElementById('newProjectForm'),
    cancelProjectBtn: document.getElementById('cancelProjectBtn'),
    
    // Calendar
    currentMonth: document.getElementById('currentMonth'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    calendarGrid: document.getElementById('calendarGrid'),
    
    // Task Detail Modal
    taskDetailModal: document.getElementById('taskDetailModal'),
    taskDetailTitle: document.getElementById('taskDetailTitle'),
    taskDetailContent: document.getElementById('taskDetailContent'),
    editTaskBtn: document.getElementById('editTaskBtn'),
    deleteTaskBtn: document.getElementById('deleteTaskBtn'),
    completeTaskBtn: document.getElementById('completeTaskBtn'),
    closeTaskDetailBtn: document.getElementById('closeTaskDetailBtn'),
    toggleModalSizeBtn: document.getElementById('toggleModalSizeBtn'),
    taskDetailModalContainer: document.getElementById('taskDetailModalContainer'),
    taskDetailMainContent: document.getElementById('taskDetailMainContent'),
    commentsCount: document.getElementById('commentsCount'),
    
    // Comments
    newCommentForm: document.getElementById('newCommentForm'),
    newCommentText: document.getElementById('newCommentText'),
    commentsList: document.getElementById('commentsList')
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 로딩 표시
        showLoading();
        
        // 인증 상태 확인 (Supabase가 초기화된 경우에만)
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await handleAuthSuccess(session);
            } else {
                showLoginScreen();
            }
        } else {
            // Supabase가 없는 경우 로그인 화면으로
            showLoginScreen();
        }
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        // 실시간 구독 설정 (Supabase가 초기화된 경우에만)
        if (supabase) {
            setupRealtimeSubscriptions();
        }
        
    } catch (error) {
        console.error('초기화 오류:', error);
        showNotification('초기화 중 오류가 발생했습니다.', 'error');
        showLoginScreen();
    }
});

// 로딩 표시/숨김
function showLoading() {
    elements.loading.classList.remove('hidden');
    elements.loginScreen.classList.add('hidden');
    elements.mainApp.classList.add('hidden');
}

function hideLoading() {
    elements.loading.classList.add('hidden');
}

function showLoginScreen() {
    hideLoading();
    elements.loginScreen.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
}

function showMainApp() {
    hideLoading();
    elements.loginScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 인증
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.demoBtn.addEventListener('click', handleDemoMode);
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // 사용자 메뉴
    elements.userMenuBtn.addEventListener('click', toggleUserMenu);
    document.addEventListener('click', (e) => {
        if (!elements.userMenuBtn.contains(e.target)) {
            elements.userMenu.classList.add('hidden');
        }
    });
    
    // 네비게이션
    elements.dashboardBtn.addEventListener('click', () => switchView('dashboard'));
    elements.calendarBtn.addEventListener('click', () => switchView('calendar'));
    elements.projectsBtn.addEventListener('click', () => switchView('projects'));
    
    // 필터 버튼
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            setFilter(filter);
        });
    });
    
    // 프로젝트 필터 드롭다운
    if (elements.projectFilterBtn) {
        elements.projectFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.projectFilterDropdown.classList.toggle('hidden');
        });
        
        document.addEventListener('click', (e) => {
            if (!elements.projectFilterBtn.contains(e.target) && 
                !elements.projectFilterDropdown.contains(e.target)) {
                elements.projectFilterDropdown.classList.add('hidden');
            }
        });
    }
    
    // 프로젝트 필터 버튼 클릭 이벤트 (이벤트 위임)
    if (elements.projectFilterDropdown) {
        elements.projectFilterDropdown.addEventListener('click', (e) => {
            const btn = e.target.closest('.project-filter-btn');
            if (btn) {
                const projectId = btn.dataset.projectFilter;
                setProjectFilter(projectId);
                elements.projectFilterDropdown.classList.add('hidden');
            }
        });
    }
    
    // 모달
    elements.newTaskBtn.addEventListener('click', () => openModal('newTaskModal'));
    elements.cancelTaskBtn.addEventListener('click', () => closeModal('newTaskModal'));
    elements.newProjectBtn.addEventListener('click', () => openModal('newProjectModal'));
    elements.cancelProjectBtn.addEventListener('click', () => closeModal('newProjectModal'));
    elements.closeTaskDetailBtn.addEventListener('click', () => closeModal('taskDetailModal'));
    
    // 폼 제출
    elements.newTaskForm.addEventListener('submit', handleNewTask);
    elements.newProjectForm.addEventListener('submit', handleNewProject);
    elements.newCommentForm.addEventListener('submit', handleNewComment);
    
    // 프로젝트 색상 선택
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            selectProjectColor(color);
        });
    });
    
    // 우선순위 선택
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const priority = e.currentTarget.dataset.priority;
            selectTaskPriority(priority);
        });
    });
    
    // 레거시 캘린더 네비게이션 (새 캘린더가 있으면 비활성화)
    if (!document.getElementById('monthViewContainer')) {
        elements.prevMonth?.addEventListener('click', () => changeMonth(-1));
        elements.nextMonth?.addEventListener('click', () => changeMonth(1));
    }
    
    // 캘린더 초기화는 initCalendars에서 처리하므로 여기서는 제거
    
    // 기존 커스텀 달력 코드 제거됨 - HTML5 date input 사용
    
    // 기존 복잡한 커스텀 달력 함수들 제거됨 - HTML5 date input 사용
    
    // 할 일 상세 모달 액션
    elements.editTaskBtn.addEventListener('click', handleEditTask);
    elements.deleteTaskBtn.addEventListener('click', handleDeleteTask);
    elements.completeTaskBtn.addEventListener('click', handleCompleteTask);
    elements.toggleModalSizeBtn.addEventListener('click', toggleModalSize);
    
    // 키보드 단축키
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // 프로젝트 삭제 버튼 이벤트 (이벤트 위임 사용)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-project-btn')) {
            const btn = e.target.closest('.delete-project-btn');
            const projectId = btn.dataset.projectId;
            const projectName = btn.dataset.projectName;
            showDeleteProjectModal(projectId, projectName);
        }
    });
    
    // 프로젝트 삭제 모달 버튼들
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        closeModal('deleteProjectModal');
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        confirmDeleteProject();
    });
}

// 프로젝트 삭제 관련 함수들
let pendingDeleteProjectId = null;

function showDeleteProjectModal(projectId, projectName) {
    pendingDeleteProjectId = projectId;
    document.getElementById('deleteProjectName').textContent = projectName;
    openModal('deleteProjectModal');
}

async function confirmDeleteProject() {
    if (!pendingDeleteProjectId) return;
    
    try {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const originalText = confirmBtn.textContent;
        confirmBtn.textContent = '삭제 중...';
        confirmBtn.disabled = true;
        
        // 데모 모드에서는 로컬 배열에서 삭제
        if (isDemoMode) {
            // 관련 할 일들도 삭제
            const deletedTaskIds = currentTasks.filter(task => task.project_id === pendingDeleteProjectId).map(task => task.id);
            currentTasks = currentTasks.filter(task => task.project_id !== pendingDeleteProjectId);
            
            // 관련 댓글들도 삭제
            currentComments = currentComments.filter(comment => !deletedTaskIds.includes(comment.task_id));
            
            // 프로젝트 삭제
            currentProjects = currentProjects.filter(project => project.id !== pendingDeleteProjectId);
        } else {
            // 실제 데이터베이스에서 삭제
            // 1. 관련 댓글들 삭제
            const { data: projectTasks } = await supabase
                .from('todos')
                .select('id')
                .eq('project_id', pendingDeleteProjectId);
            
            if (projectTasks && projectTasks.length > 0) {
                const taskIds = projectTasks.map(task => task.id);
                await supabase
                    .from('comments')
                    .delete()
                    .in('task_id', taskIds);
            }
            
            // 2. 관련 할 일들 삭제
            await supabase
                .from('todos')
                .delete()
                .eq('project_id', pendingDeleteProjectId);
            
            // 3. 프로젝트 삭제
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', pendingDeleteProjectId);
            
            if (error) throw error;
            
            // 로컬 상태 업데이트
            await loadProjects();
            await loadTasks();
            await loadComments();
        }
        
        // UI 업데이트
        renderCurrentView();
        
        // 성공 메시지
        showNotification('프로젝트가 성공적으로 삭제되었습니다.', 'success');
        
        closeModal('deleteProjectModal');
        pendingDeleteProjectId = null;
        
    } catch (error) {
        console.error('프로젝트 삭제 실패:', error);
        showNotification('프로젝트 삭제에 실패했습니다.', 'error');
    } finally {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        confirmBtn.textContent = '삭제';
        confirmBtn.disabled = false;
    }
}

// 실시간 구독 설정
function setupRealtimeSubscriptions() {
    if (!currentWorkspace) return;
    
    // 할 일 변경 구독
    supabase
        .channel('todos_changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'todos',
                filter: `workspace_id=eq.${currentWorkspace.id}`
            }, 
            (payload) => {
                console.log('할 일 변경:', payload);
                handleTaskRealTimeUpdate(payload);
            }
        )
        .subscribe();
    
    // 댓글 변경 구독
    supabase
        .channel('comments_changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'comments'
            }, 
            (payload) => {
                console.log('댓글 변경:', payload);
                handleCommentRealTimeUpdate(payload);
            }
        )
        .subscribe();
}

// 인증 처리
async function handleLogin() {
    try {
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<div class="spinner"></div> 로그인 중...';
        
        if (!supabase) {
            showNotification('Supabase가 초기화되지 않았습니다. 데모 모드를 이용해주세요.', 'error');
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });
        
        if (error) {
            console.error('OAuth 오류:', error);
            throw error;
        }
        
        console.log('OAuth 인증 시작됨');
        
    } catch (error) {
        console.error('로그인 오류:', error);
        let errorMessage = '로그인 중 오류가 발생했습니다.';
        
        if (error.message.includes('Invalid login')) {
            errorMessage = 'Supabase 프로젝트 설정을 확인해주세요.';
        } else if (error.message.includes('redirect_uri')) {
            errorMessage = 'OAuth Redirect URI 설정을 확인해주세요.';
        }
        
        showNotification(errorMessage, 'error');
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = '<img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="w-5 h-5 mr-3"><span class="font-medium text-gray-700">Google로 로그인</span>';
    }
}

// 데모 모드 처리
async function handleDemoMode() {
    try {
        elements.demoBtn.disabled = true;
        elements.demoBtn.innerHTML = '<div class="spinner"></div> 데모 준비 중...';
        
        isDemoMode = true;
        
        // 데모 사용자 설정 (아바타 이미지 없이)
        currentUser = {
            id: 'demo-user-1',
            email: 'demo@example.com',
            user_metadata: {
                full_name: '데모 사용자',
                avatar_url: null // 데모 모드에서는 아바타 이미지 없음
            }
        };
        
        // 데모 워크스페이스 설정
        currentWorkspace = {
            id: 'demo-workspace-1',
            name: '데모 워크스페이스',
            description: '데모용 워크스페이스입니다'
        };
        
        // 데모 데이터 초기화
        initializeDemoData();
        
        // UI 업데이트
        updateUserUI();
        
        // 달력 초기화
        setTimeout(() => {
            initializeCalendars();
        }, 500);
        
        // 데모 모드 표시
        document.getElementById('demoIndicator').classList.remove('hidden');
        
        showMainApp();
        showNotification('데모 모드로 시작합니다! 🎉', 'success');
        
        // 데이터 렌더링
        renderCurrentView();
        updateStats();
        
    } catch (error) {
        console.error('데모 모드 오류:', error);
        showNotification('데모 모드 시작 중 오류가 발생했습니다.', 'error');
        elements.demoBtn.disabled = false;
        elements.demoBtn.innerHTML = '🚀 데모 체험하기';
    }
}

async function handleLogout() {
    try {
        if (!supabase) {
            // 데모 모드에서는 단순히 로그아웃 처리
            currentUser = null;
            currentWorkspace = null;
            showLoginScreen();
            return;
        }
        
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // 상태 초기화
        currentUser = null;
        currentWorkspace = null;
        currentProjects = [];
        currentTasks = [];
        isDemoMode = false;
        
        // 데모 모드 표시 숨김
        document.getElementById('demoIndicator').classList.add('hidden');
        
        showLoginScreen();
        showNotification('로그아웃되었습니다.', 'success');
        
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

async function handleAuthSuccess(session) {
    try {
        currentUser = session.user;
        
        // 사용자 프로필 확인/생성
        await ensureUserProfile();
        
        // 워크스페이스 확인/생성
        await ensureWorkspace();
        
        // UI 업데이트
        updateUserUI();
        
        // 데이터 로드
        await loadInitialData();
        
        showMainApp();
        
    } catch (error) {
        console.error('인증 처리 오류:', error);
        showNotification('사용자 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        showLoginScreen();
    }
}

// 사용자 프로필 확인/생성
async function ensureUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            // 프로필이 없으면 생성
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email,
                    avatar_url: currentUser.user_metadata?.avatar_url || null
                });
            
            if (insertError) {
                console.error('Profile creation error:', insertError);
                throw insertError;
            }
        } else if (error) {
            console.error('Profile fetch error:', error);
            // profiles 테이블이 없는 경우 조용히 넘어감
            if (error.code === '42P01') {
                console.warn('Profiles table does not exist, skipping profile setup');
                return;
            }
            throw error;
        }
    } catch (error) {
        console.error('ensureUserProfile error:', error);
        // 테이블이 없는 경우에도 앱이 계속 작동하도록 함
        if (error.code === '42P01') {
            console.warn('Database table missing, continuing without profile');
            return;
        }
        throw error;
    }
}

// 워크스페이스 확인/생성
async function ensureWorkspace() {
    // 사용자가 속한 워크스페이스 찾기
    const { data: workspaces, error } = await supabase
        .from('workspace_members')
        .select(`
            workspace_id,
            workspaces (
                id,
                name,
                description
            )
        `)
        .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    if (workspaces && workspaces.length > 0) {
        currentWorkspace = workspaces[0].workspaces;
    } else {
        // 워크스페이스가 없으면 기본 워크스페이스 생성
        const { data: newWorkspace, error: createError } = await supabase
            .from('workspaces')
            .insert({
                name: '내 워크스페이스',
                description: '개인 워크스페이스',
                created_by: currentUser.id
            })
            .select()
            .single();
        
        if (createError) throw createError;
        
        // 워크스페이스 멤버로 추가
        const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: newWorkspace.id,
                user_id: currentUser.id,
                role: 'admin'
            });
        
        if (memberError) throw memberError;
        
        currentWorkspace = newWorkspace;
    }
}

// 사용자 UI 업데이트
function updateUserUI() {
    const avatarContainer = document.getElementById('userAvatarContainer');
    
    if (isDemoMode) {
        // 데모 모드에서는 아바타 이미지 숨기기
        if (avatarContainer) {
            avatarContainer.style.display = 'none';
        }
    } else {
        // 일반 모드에서는 아바타 이미지 표시
        if (avatarContainer) {
            avatarContainer.style.display = 'block';
        }
        if (currentUser.user_metadata?.avatar_url) {
            elements.userAvatar.src = currentUser.user_metadata.avatar_url;
        }
    }
    
    const displayName = currentUser.user_metadata?.full_name || currentUser.email;
    elements.userName.textContent = displayName;
}

// 초기 데이터 로드
async function loadInitialData() {
    try {
        if (isDemoMode) {
            // 데모 모드에서는 이미 초기화된 데이터 사용
            renderCurrentView();
            return;
        }
        
        await Promise.all([
            loadProjects(),
            loadTasks(),
            updateStats()
        ]);
        
        renderCurrentView();
        
    } catch (error) {
        console.error('초기 데이터 로드 오류:', error);
        showNotification('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 프로젝트 로드
async function loadProjects() {
    if (isDemoMode) {
        // 데모 모드에서는 이미 초기화된 데이터 사용
        updateProjectSelectors();
        return;
    }
    
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    currentProjects = data || [];
    updateProjectSelectors();
}

// 할 일 로드
async function loadTasks() {
    if (isDemoMode) {
        // 데모 모드에서는 이미 초기화된 데이터 사용
        return;
    }
    
    const { data, error } = await supabase
        .from('todos')
        .select(`
            *,
            projects:project_id (
                name,
                color
            ),
            assigned_user:assigned_to (
                full_name,
                avatar_url
            ),
            creator:created_by (
                full_name,
                avatar_url
            )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    currentTasks = data || [];
}

// 통계 업데이트
async function updateStats() {
    const total = currentTasks.length;
    const pending = currentTasks.filter(task => task.status === 'pending').length;
    const inProgress = currentTasks.filter(task => task.status === 'in_progress').length;
    const completed = currentTasks.filter(task => task.status === 'completed').length;
    
    elements.totalTasks.textContent = total;
    elements.pendingTasks.textContent = pending;
    elements.inProgressTasks.textContent = inProgress;
    elements.completedTasks.textContent = completed;
}

// 프로젝트 선택기 업데이트
function updateProjectSelectors() {
    const selectors = [
        document.getElementById('taskProject')
    ];
    
    selectors.forEach(selector => {
        if (!selector) return;
        
        // 기존 옵션 제거 (첫 번째 옵션 제외)
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }
        
        // 프로젝트 옵션 추가
        currentProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
    });
    
    // 프로젝트 필터 드롭다운도 업데이트
    updateProjectFilter();
}

// 프로젝트 필터 드롭다운 업데이트
function updateProjectFilter() {
    if (elements.projectFilterList) {
        elements.projectFilterList.innerHTML = currentProjects.map(project => `
            <button data-project-filter="${project.id}" class="project-filter-btn w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center">
                <span class="w-3 h-3 rounded-full bg-${project.color}-500 mr-2"></span>
                ${escapeHtml(project.name)}
            </button>
        `).join('');
    }
}

// 뷰 전환
function switchView(view) {
    currentView = view;
    
    // 네비게이션 버튼 업데이트
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('text-blue-600', 'bg-blue-50');
        btn.classList.add('text-gray-500');
    });
    
    const activeBtn = document.getElementById(`${view}Btn`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-500');
        activeBtn.classList.add('text-blue-600', 'bg-blue-50');
    }
    
    // 뷰 표시/숨김
    elements.dashboardView.classList.add('hidden');
    elements.calendarView.classList.add('hidden');
    elements.projectsView.classList.add('hidden');
    
    elements[`${view}View`].classList.remove('hidden');
    
    renderCurrentView();
}

// 현재 뷰 렌더링
function renderCurrentView() {
    switch (currentView) {
        case 'dashboard':
            renderTasksList();
            break;
        case 'calendar':
            renderCalendar(); // 통합된 렌더링 함수 호출
            break;
        case 'projects':
            renderProjectsList();
            break;
    }
}

// 할 일 목록 렌더링
function renderTasksList() {
    let filteredTasks = currentTasks.filter(task => {
        if (currentFilter === 'all') return true;
        return task.status === currentFilter;
    });
    
    // 프로젝트별 필터링 추가
    if (currentProjectFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.project_id === currentProjectFilter);
    }
    
    if (filteredTasks.length === 0) {
        const emptyStateConfig = getEmptyStateConfig();
        elements.tasksList.innerHTML = `
            <div class="empty-state">
                <div class="w-20 h-20 mx-auto mb-6 text-gray-300">
                    ${emptyStateConfig.icon}
                </div>
                <h3 class="text-lg font-medium text-gray-800 mb-2">${emptyStateConfig.title}</h3>
                <p class="text-gray-700 mb-4">${emptyStateConfig.description}</p>
                ${emptyStateConfig.showButton ? `
                    <button onclick="document.getElementById('newTaskBtn').click()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                        ${emptyStateConfig.buttonText}
                    </button>
                ` : `
                    <div class="flex flex-wrap justify-center gap-2 mt-4">
                        <button onclick="setFilter('all')" class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                            전체 보기
                        </button>
                        ${currentProjectFilter !== 'all' ? `
                            <button onclick="setProjectFilter('all')" class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                                모든 프로젝트
                            </button>
                        ` : ''}
                    </div>
                `}
            </div>
        `;
        return;
    }
    
    elements.tasksList.innerHTML = filteredTasks.map(task => {
        const project = task.projects;
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('ko-KR') : '';
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        
        return `
            <div class="task-card bg-white rounded-lg shadow p-6 cursor-pointer ${task.status}" onclick="openTaskDetail('${task.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 mb-1">${escapeHtml(task.title)}</h3>
                        ${task.description ? `<p class="text-gray-600 text-sm">${escapeHtml(task.description)}</p>` : ''}
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                        <span class="px-2 py-1 rounded-full text-xs font-medium priority-${task.priority}">
                            ${getPriorityText(task.priority)}
                        </span>
                        <div class="status-dot status-${task.status.replace('_', '-')}"></div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between text-sm text-gray-500">
                    <div class="flex items-center space-x-4">
                        ${project ? `
                            <span class="flex items-center space-x-1">
                                <div class="w-3 h-3 rounded-full" style="background-color: ${project.color}"></div>
                                <span>${escapeHtml(project.name)}</span>
                            </span>
                        ` : ''}
                        
                        ${dueDate ? `
                            <span class="flex items-center space-x-1 ${isOverdue ? 'text-red-600 font-medium' : ''}">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                                </svg>
                                <span>${dueDate}</span>
                                ${isOverdue ? '<span class="text-red-600">지연</span>' : ''}
                            </span>
                        ` : ''}
                    </div>
                    
                    ${task.assigned_user ? `
                        <div class="flex items-center space-x-2">
                            <span>${escapeHtml(task.assigned_user.full_name)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 빈 상태 설정 가져오기
function getEmptyStateConfig() {
    // 현재 적용된 필터에 따라 다른 빈 상태 표시
    const isFiltered = currentFilter !== 'all' || currentProjectFilter !== 'all';
    
    if (!isFiltered) {
        // 필터가 없는 경우 - 실제로 할 일이 없는 상태
        return {
            icon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>`,
            title: '할 일이 없습니다',
            description: '새로운 할 일을 추가해서 시작해보세요!',
            showButton: true,
            buttonText: '+ 새 할 일 추가'
        };
    }
    
    // 필터링된 상태에서 결과가 없는 경우
    let filterText = '';
    let icon = '';
    
    if (currentFilter !== 'all' && currentProjectFilter !== 'all') {
        // 상태 + 프로젝트 필터 모두 적용
        const project = currentProjects.find(p => p.id === currentProjectFilter);
        const statusText = getStatusText(currentFilter);
        filterText = `"${project?.name || '선택된 프로젝트'}"의 "${statusText}"`;
        icon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>`;
    } else if (currentFilter !== 'all') {
        // 상태 필터만 적용
        const statusText = getStatusText(currentFilter);
        filterText = `"${statusText}"`;
        icon = getStatusIcon(currentFilter);
    } else if (currentProjectFilter !== 'all') {
        // 프로젝트 필터만 적용
        const project = currentProjects.find(p => p.id === currentProjectFilter);
        filterText = `"${project?.name || '선택된 프로젝트'}"`;
        icon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>`;
    }
    
    return {
        icon,
        title: `${filterText} 할 일이 없습니다`,
        description: '다른 필터를 선택하거나 새로운 할 일을 추가해보세요.',
        showButton: false,
        buttonText: ''
    };
}

// 상태 텍스트 변환
function getStatusText(status) {
    const statusMap = {
        'pending': '대기 중',
        'in_progress': '진행 중',
        'completed': '완료'
    };
    return statusMap[status] || status;
}

// 상태별 아이콘
function getStatusIcon(status) {
    const iconMap = {
        'pending': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,
        'in_progress': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>`,
        'completed': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-full h-full">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`
    };
    return iconMap[status] || iconMap['pending'];
}

// 프로젝트 목록 렌더링
function renderProjectsList() {
    // 프로젝트 필터 드롭다운 목록도 업데이트
    updateProjectFilter();
    
    if (currentProjects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="col-span-full empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
                <p class="text-gray-600 mb-4">새로운 프로젝트를 생성해보세요!</p>
                <button onclick="document.getElementById('newProjectBtn').click()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    + 새 프로젝트 생성
                </button>
            </div>
        `;
        return;
    }
    
    elements.projectsList.innerHTML = currentProjects.map(project => {
        const projectTasks = currentTasks.filter(task => task.project_id === project.id);
        const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
        const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
        
        return `
            <div class="project-card bg-white bg-opacity-95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300">
                <div class="bg-gradient-to-br from-${project.color}-100 to-${project.color}-200 p-6 relative overflow-hidden">
                    <!-- 배경 패턴 -->
                    <div class="absolute top-0 right-0 w-20 h-20 bg-${project.color}-300 opacity-20 rounded-full -mr-10 -mt-10"></div>
                    <div class="absolute bottom-0 left-0 w-16 h-16 bg-${project.color}-400 opacity-10 rounded-full -ml-8 -mb-8"></div>
                    
                    <div class="relative z-10">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h3 class="text-xl font-bold mb-2 text-${project.color}-800">${escapeHtml(project.name)}</h3>
                                ${project.description ? `<p class="text-${project.color}-700 text-sm leading-relaxed">${escapeHtml(project.description)}</p>` : ''}
                            </div>
                            <button class="delete-project-btn ml-3 p-1.5 text-${project.color}-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200" 
                                    data-project-id="${project.id}" 
                                    data-project-name="${escapeHtml(project.name)}"
                                    title="프로젝트 삭제">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-sm text-gray-600">진행률</span>
                        <span class="text-sm font-medium text-gray-900">${Math.round(progress)}%</span>
                    </div>
                    
                    <div class="progress-bar mb-4">
                        <div class="progress-fill bg-${project.color}-500" style="width: ${progress}%"></div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-2xl font-bold text-gray-900">${projectTasks.length}</div>
                            <div class="text-xs text-gray-500">전체 할 일</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-blue-600">${projectTasks.filter(task => task.status === 'in_progress').length}</div>
                            <div class="text-xs text-gray-500">진행 중</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-green-600">${completedTasks}</div>
                            <div class="text-xs text-gray-500">완료</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 레거시 캘린더 렌더링 함수
function renderLegacyCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 월 표시 업데이트
    elements.currentMonth.textContent = `${year}년 ${month + 1}월`;
    
    // 캘린더 그리드 생성
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendarHtml = [];
    
    // 요일 헤더
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    calendarHtml.push(`
        <div class="grid grid-cols-7 gap-1 mb-4">
            ${days.map(day => `<div class="text-center font-medium text-gray-700 py-2">${day}</div>`).join('')}
        </div>
    `);
    
    // 날짜 그리드
    calendarHtml.push('<div class="grid grid-cols-7 gap-1">');
    
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const isCurrentMonth = date.getMonth() === month;
        const isToday = date.toDateString() === new Date().toDateString();
        const dayTasks = currentTasks.filter(task => {
            if (!task.due_date) return false;
            const taskDate = new Date(task.due_date);
            return taskDate.toDateString() === date.toDateString();
        });
        
        let dayClass = 'calendar-day p-2';
        if (!isCurrentMonth) dayClass += ' other-month';
        if (isToday) dayClass += ' today';
        
        calendarHtml.push(`
            <div class="${dayClass}">
                <div class="font-medium text-sm mb-1">${date.getDate()}</div>
                ${dayTasks.slice(0, 3).map(task => {
                    const project = task.projects;
                    return `
                        <div class="calendar-task text-white text-xs mb-1 cursor-pointer" 
                             style="background-color: ${project?.color || '#6b7280'}"
                             onclick="openTaskDetail('${task.id}')">
                            ${escapeHtml(task.title)}
                        </div>
                    `;
                }).join('')}
                ${dayTasks.length > 3 ? `<div class="text-xs text-gray-500">+${dayTasks.length - 3}개 더</div>` : ''}
            </div>
        `);
    }
    
    calendarHtml.push('</div>');
    elements.calendarGrid.innerHTML = calendarHtml.join('');
}

// 필터 설정
// 상태 필터 설정
function setFilter(filter) {
    currentFilter = filter;
    
    // 필터 버튼 업데이트
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-gradient-to-r', 'from-blue-600', 'to-purple-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-gray-600', 'hover:bg-gray-100');
    });
    
    const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        activeBtn.classList.add('bg-gradient-to-r', 'from-blue-600', 'to-purple-600', 'text-white', 'shadow-sm');
    }
    
    if (currentView === 'dashboard') {
        renderTasksList();
    }
}

// 프로젝트 필터 설정
function setProjectFilter(projectId) {
    currentProjectFilter = projectId;
    
    // 프로젝트 필터 버튼 업데이트
    document.querySelectorAll('.project-filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-50', 'text-blue-600', 'font-medium');
    });
    
    const activeBtn = document.querySelector(`[data-project-filter="${projectId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('bg-blue-50', 'text-blue-600', 'font-medium');
    }
    
    // 프로젝트 필터 드롭다운 버튼 텍스트 업데이트
    const filterBtn = document.getElementById('projectFilterBtn');
    if (filterBtn) {
        const btnText = filterBtn.querySelector('span');
        if (projectId === 'all') {
            btnText.textContent = '프로젝트';
        } else {
            const project = currentProjects.find(p => p.id === projectId);
            btnText.textContent = project ? project.name : '프로젝트';
        }
    }
    
    // 할 일 목록 다시 렌더링
    if (currentView === 'dashboard') {
        renderTasksList();
    }
}

// 모달 관리
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('modal-enter');
        
        // 새 할일 모달이 열릴 때 달력 초기화
        if (modalId === 'newTaskModal') {
            setTimeout(() => {
                initializeCalendars();
            }, 200);
        }
        
        // 첫 번째 입력 필드에 포커스
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('modal-enter');
        
        // 새 할일 모달이 닫힐 때 캘린더도 닫기
        if (modalId === 'newTaskModal') {
            const startDateCalendar = document.getElementById('startDateCalendar');
            const dueDateCalendar = document.getElementById('dueDateCalendar');
            if (startDateCalendar) startDateCalendar.style.display = 'none';
            if (dueDateCalendar) dueDateCalendar.style.display = 'none';
        }
        
        // 폼 리셋
        const modalForm = modal.querySelector('form');
        if (modalForm) modalForm.reset();
    }
}

// 새 할 일 처리
async function handleNewTask(e) {
    e.preventDefault();
    
    try {
        const form = e.target;
        const isEditMode = form.dataset.editMode === 'true';
        const editTaskId = form.dataset.editTaskId;
        
        const formData = new FormData(e.target);
        const taskData = {
            id: isEditMode ? editTaskId : (isDemoMode ? `demo-task-${Date.now()}` : undefined),
            title: formData.get('title') || document.getElementById('taskTitle').value,
            description: formData.get('description') || document.getElementById('taskDescription').value,
            project_id: formData.get('project') || document.getElementById('taskProject').value,
            start_date: document.getElementById('taskStartDate').value || null,
            due_date: document.getElementById('taskDueDate').value || null,
            priority: formData.get('priority') || document.getElementById('taskPriority').value,
            workspace_id: currentWorkspace.id,
            created_by: currentUser.id,
            assigned_to: currentUser.id,
            status: isEditMode ? undefined : 'pending', // 편집 모드에서는 상태 변경하지 않음
            created_at: isEditMode ? undefined : new Date().toISOString()
        };
        
        if (!taskData.title.trim()) {
            showNotification('할 일 제목을 입력해주세요.', 'error');
            return;
        }
        
        if (!taskData.project_id) {
            showNotification('프로젝트를 선택해주세요.', 'error');
            return;
        }
        
        if (isDemoMode) {
            const project = currentProjects.find(p => p.id === taskData.project_id);
            taskData.projects = project ? { name: project.name, color: project.color } : null;
            taskData.assigned_user = { 
                full_name: currentUser.user_metadata.full_name, 
                avatar_url: currentUser.user_metadata.avatar_url 
            };
            
            if (isEditMode) {
                // 편집 모드: 기존 할 일 업데이트
                const taskIndex = currentTasks.findIndex(t => t.id === editTaskId);
                if (taskIndex !== -1) {
                    // 기존 데이터를 유지하면서 업데이트
                    currentTasks[taskIndex] = {
                        ...currentTasks[taskIndex],
                        ...taskData,
                        projects: taskData.projects,
                        assigned_user: taskData.assigned_user
                    };
                }
            } else {
                // 새 할 일 추가
                currentTasks.unshift(taskData);
            }
            saveDemoDataToStorage();
        } else {
            if (isEditMode) {
                // 편집 모드: 기존 할 일 업데이트
                const { error } = await supabase
                    .from('todos')
                    .update({
                        title: taskData.title,
                        description: taskData.description,
                        project_id: taskData.project_id,
                        start_date: taskData.start_date,
                        due_date: taskData.due_date,
                        priority: taskData.priority
                    })
                    .eq('id', editTaskId);
                
                if (error) throw error;
            } else {
                // 새 할 일 추가
                const { error } = await supabase
                    .from('todos')
                    .insert(taskData);
                
                if (error) throw error;
            }
            
            await loadTasks();
        }
        
        await updateStats();
        renderCurrentView();
        
        // 폼 초기화
        const taskForm = document.getElementById('newTaskForm');
        taskForm.reset();
        taskForm.removeAttribute('data-edit-mode');
        taskForm.removeAttribute('data-edit-task-id');
        
        // 모달 제목 및 버튼 텍스트 초기화
        const modal = elements.newTaskModal;
        const modalTitle = modal.querySelector('h3');
        const submitBtn = taskForm.querySelector('button[type="submit"]');
        modalTitle.textContent = '할 일 관리';
        submitBtn.innerHTML = '<span>+ 할 일 추가</span>';
        
        // 우선순위 버튼 초기화
        selectTaskPriority('medium');
        
        closeModal('newTaskModal');
        showNotification(isEditMode ? '할 일이 수정되었습니다.' : '새 할 일이 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('할 일 추가 오류:', error);
        showNotification('할 일 추가 중 오류가 발생했습니다.', 'error');
    }
}

// 새 프로젝트 처리
async function handleNewProject(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const projectData = {
            id: isDemoMode ? `demo-project-${Date.now()}` : undefined,
            name: formData.get('name') || document.getElementById('projectName').value,
            description: formData.get('description') || document.getElementById('projectDescription').value,
            color: document.getElementById('projectColor').value,
            workspace_id: currentWorkspace.id,
            created_by: currentUser.id,
            created_at: new Date().toISOString()
        };
        
        if (!projectData.name.trim()) {
            showNotification('프로젝트 이름을 입력해주세요.', 'error');
            return;
        }
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열에 추가
            currentProjects.unshift(projectData);
            saveDemoDataToStorage();
            updateProjectSelectors();
        } else {
            const { error } = await supabase
                .from('projects')
                .insert(projectData);
            
            if (error) throw error;
            
            await loadProjects();
        }
        
        renderCurrentView();
        closeModal('newProjectModal');
        showNotification('새 프로젝트가 생성되었습니다.', 'success');
        
    } catch (error) {
        console.error('프로젝트 생성 오류:', error);
        showNotification('프로젝트 생성 중 오류가 발생했습니다.', 'error');
    }
}

// 프로젝트 색상 선택
function selectProjectColor(color) {
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.remove('border-gray-600');
        btn.classList.add('border-transparent');
    });
    
    const selectedBtn = document.querySelector(`[data-color="${color}"]`);
    if (selectedBtn) {
        selectedBtn.classList.remove('border-transparent');
        selectedBtn.classList.add('border-gray-600');
    }
    
    document.getElementById('projectColor').value = color;
}

// 할 일 상세 보기
async function openTaskDetail(taskId) {
    try {
        currentTaskId = taskId;
        const task = currentTasks.find(t => t.id === taskId);
        if (!task) return;
        
        // 할 일 상세 정보 표시
        elements.taskDetailTitle.textContent = task.title;
        
        const project = task.projects;
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('ko-KR') : '없음';
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        
        elements.taskDetailContent.innerHTML = `
            <!-- 프로젝트 정보 -->
            <div class="mb-6">
                <div class="flex items-center space-x-3 mb-2">
                    <span class="text-sm font-medium text-gray-600">프로젝트</span>
                    ${project ? `
                        <div class="flex items-center space-x-2">
                            <div class="w-4 h-4 rounded-full" style="background-color: ${project.color}"></div>
                            <span class="text-sm font-medium text-gray-900">${escapeHtml(project.name)}</span>
                        </div>
                    ` : '<span class="text-sm text-gray-500">프로젝트 없음</span>'}
                </div>
            </div>

            <!-- 상태 및 우선순위 -->
            <div class="mb-6">
                <div class="flex items-center space-x-1 text-sm text-gray-600">
                    <span class="font-medium">상태:</span>
                    <select id="taskStatusSelect" class="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>대기중</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>진행중</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>완료</option>
                    </select>
                    <span class="text-gray-400">•</span>
                    <span class="font-medium">우선순위:</span>
                    <span class="px-2 py-1 rounded-full text-xs font-medium priority-${task.priority}">
                        ${getPriorityText(task.priority)}
                    </span>
                </div>
            </div>

            <!-- 일정 -->
            <div class="mb-6">
                <h4 class="text-sm font-semibold text-gray-900 mb-3">일정</h4>
                <div class="space-y-2">
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600">시작일</span>
                        <span class="text-gray-900">${task.created_at ? new Date(task.created_at).toLocaleDateString('ko-KR') : '미정'}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600">마감일</span>
                        <span class="text-gray-900 ${isOverdue ? 'text-red-600 font-medium' : ''}">${dueDate}</span>
                    </div>
                </div>
            </div>

            <!-- 상세 설명 -->
            <div class="mb-6">
                <h4 class="text-sm font-semibold text-gray-900 mb-3">상세 설명</h4>
                <p class="text-sm text-gray-700 leading-relaxed">${task.description || 'React, Webpack, 각종 개발 도구들을 설정합니다.'}</p>
            </div>

            <!-- 생성 정보 -->
            <div class="mb-6">
                <h4 class="text-sm font-semibold text-gray-900 mb-3">생성 정보</h4>
                <div class="text-sm text-gray-600">
                    생성일: ${task.created_at ? new Date(task.created_at).toLocaleString('ko-KR') : '정보 없음'}
                </div>
                ${task.assigned_user ? `
                    <div class="flex items-center space-x-2 mt-2">
                        <span class="text-sm text-gray-700">${escapeHtml(task.assigned_user.full_name)}</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // 상태 변경 이벤트 리스너
        document.getElementById('taskStatusSelect').addEventListener('change', handleTaskStatusChange);
        
        // 댓글 로드
        await loadComments(taskId);
        
        openModal('taskDetailModal');
        
    } catch (error) {
        console.error('할 일 상세 보기 오류:', error);
        showNotification('할 일 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 할 일 상태 변경
async function handleTaskStatusChange(e) {
    try {
        const newStatus = e.target.value;
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열 업데이트
            const taskIndex = currentTasks.findIndex(task => task.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = newStatus;
                currentTasks[taskIndex].completed_at = newStatus === 'completed' ? new Date().toISOString() : null;
                saveDemoDataToStorage();
            }
        } else {
            const { error } = await supabase
                .from('todos')
                .update({ 
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null
                })
                .eq('id', currentTaskId);
            
            if (error) throw error;
            
            await loadTasks();
        }
        
        await updateStats();
        renderCurrentView();
        showNotification('할 일 상태가 업데이트되었습니다.', 'success');
        
    } catch (error) {
        console.error('상태 변경 오류:', error);
        showNotification('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

// 댓글 로드
async function loadComments(taskId) {
    try {
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열에서 필터링
            const taskComments = currentComments.filter(comment => 
                comment.task_id === taskId || comment.todo_id === taskId
            );
            currentComments = taskComments;
            renderComments();
            updateCommentsCount();
            return;
        }
        
        const { data, error } = await supabase
            .from('comments')
            .select(`
                *,
                user:user_id (
                    full_name,
                    avatar_url
                )
            `)
            .or(`todo_id.eq.${taskId},task_id.eq.${taskId}`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        currentComments = data || [];
        renderComments();
        updateCommentsCount();
        
    } catch (error) {
        console.error('댓글 로드 오류:', error);
        currentComments = [];
        renderComments();
    }
}

// 댓글 개수 업데이트
function updateCommentsCount() {
    if (elements.commentsCount) {
        elements.commentsCount.textContent = currentComments.length;
    }
}

// 댓글 렌더링
function renderComments() {
    if (currentComments.length === 0) {
        elements.commentsList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p class="text-sm">아직 댓글이 없습니다.</p>
                <p class="text-xs text-gray-400">첫 번째 댓글을 작성해보세요!</p>
            </div>
        `;
        return;
    }
    
    elements.commentsList.innerHTML = currentComments.map(comment => {
        const timeAgo = getTimeAgo(new Date(comment.created_at));
        
        return `
            <div class="comment-item py-3 border-b border-gray-100 last:border-b-0" data-comment-id="${comment.id}">
                <div class="flex space-x-2">
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="font-medium text-xs text-gray-900">${escapeHtml(comment.user?.full_name || '이팀장')}</span>
                                <span class="text-xs text-gray-400 ml-2">${timeAgo}</span>
                            </div>
                            <div class="flex space-x-1">
                                <button class="edit-comment-btn text-gray-400 hover:text-blue-500 p-1 text-xs">수정</button>
                                <button class="delete-comment-btn text-gray-400 hover:text-red-500 p-1 text-xs">삭제</button>
                            </div>
                        </div>
                        <div class="comment-content mt-1">
                            <p class="text-gray-700 text-xs leading-relaxed">${escapeHtml(comment.content)}</p>
                        </div>
                        <div class="comment-edit-form hidden mt-1">
                            <textarea class="edit-comment-text w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none" rows="2">${escapeHtml(comment.content)}</textarea>
                            <div class="flex justify-end space-x-2 mt-1">
                                <button class="cancel-edit-btn text-xs text-gray-500 px-2 py-0.5 rounded hover:bg-gray-100">취소</button>
                                <button class="save-comment-btn text-xs text-white bg-purple-600 hover:bg-purple-700 px-2 py-0.5 rounded">저장</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // 수정/삭제 버튼 이벤트 리스너 추가
    setupCommentActions();
}

// 새 댓글 처리
async function handleNewComment(e) {
    e.preventDefault();
    
    try {
        const content = elements.newCommentText.value.trim();
        if (!content) {
            showNotification('댓글 내용을 입력해주세요.', 'error');
            return;
        }
        
        const commentData = {
            id: isDemoMode ? `demo-comment-${Date.now()}` : undefined,
            content: content,
            task_id: currentTaskId,
            todo_id: currentTaskId, // 기존 필드와의 호환성
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
            user: {
                full_name: currentUser.user_metadata.full_name,
                avatar_url: currentUser.user_metadata.avatar_url
            }
        };
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열에 추가
            currentComments.push(commentData);
            saveDemoDataToStorage();
            renderComments();
            updateCommentsCount();
        } else {
            const { error } = await supabase
                .from('comments')
                .insert(commentData);
            
            if (error) throw error;
            
            await loadComments(currentTaskId);
        }
        
        elements.newCommentText.value = '';
        showNotification('댓글이 추가되었습니다.', 'success');
        showNotification('댓글이 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('댓글 추가 오류:', error);
        showNotification('댓글 추가 중 오류가 발생했습니다.', 'error');
    }
}

// 할 일 완료하기
async function handleCompleteTask() {
    try {
        const task = currentTasks.find(t => t.id === currentTaskId);
        if (!task) return;
        
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex].status = newStatus;
                currentTasks[taskIndex].completed_at = newStatus === 'completed' ? new Date().toISOString() : null;
                saveDemoDataToStorage();
            }
        } else {
            const { error } = await supabase
                .from('todos')
                .update({ 
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentTaskId);
            
            if (error) throw error;
            await loadTasks();
        }
        
        await updateStats();
        renderCurrentView();
        closeModal('taskDetailModal');
        
        const message = newStatus === 'completed' ? '할 일이 완료되었습니다!' : '할 일을 미완료로 변경했습니다.';
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('할 일 완료 처리 오류:', error);
        showNotification('할 일 완료 처리 중 오류가 발생했습니다.', 'error');
    }
}

// 할 일 편집
async function handleEditTask() {
    try {
        if (!currentTaskId) return;
        
        const task = currentTasks.find(t => t.id === currentTaskId);
        if (!task) {
            showNotification('할 일을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 인라인 편집 모드로 전환
        await toggleInlineEditMode(task);
    } catch (error) {
        console.error('Error editing task:', error);
        showNotification('할 일 편집 중 오류가 발생했습니다.', 'error');
    }
}

// 인라인 편집 모드 토글
async function toggleInlineEditMode(task) {
    const contentDiv = document.getElementById('taskDetailContent');
    const editBtn = document.getElementById('editTaskBtn');
    
    if (editBtn.textContent.trim() === '편집') {
        // 편집 모드로 전환
        editBtn.textContent = '취소';
        editBtn.classList.remove('border-gray-300', 'text-gray-700');
        editBtn.classList.add('border-red-300', 'text-red-700');
        
        // 편집 폼 생성
        contentDiv.innerHTML = createEditForm(task);
        
        // 저장 버튼을 완료 버튼 자리에 배치
        const completeBtn = document.getElementById('completeTaskBtn');
        completeBtn.textContent = '저장';
        completeBtn.onclick = saveInlineEdit;
        
    } else {
        // 보기 모드로 전환
        editBtn.textContent = '편집';
        editBtn.classList.remove('border-red-300', 'text-red-700');
        editBtn.classList.add('border-gray-300', 'text-gray-700');
        
        // 원래 내용으로 복원 - openTaskDetail로 전체 새로고침
        await openTaskDetail(currentTaskId);
        
        // 완료 버튼 복원
        const completeBtn = document.getElementById('completeTaskBtn');
        completeBtn.textContent = '완료하기';
        completeBtn.onclick = handleCompleteTask;
    }
}

// 편집 폼 생성
function createEditForm(task) {
    const project = currentProjects.find(p => p.id === task.project_id);
    
    return `
        <div class="space-y-6">
            <!-- 프로젝트 선택 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">프로젝트</label>
                <select id="editTaskProject" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                    ${currentProjects.map(p => `
                        <option value="${p.id}" ${p.id === task.project_id ? 'selected' : ''}>
                            ${p.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <!-- 할 일 제목 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">제목</label>
                <input type="text" id="editTaskTitle" value="${task.title || ''}" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
            </div>
            
            <!-- 설명 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">설명</label>
                <textarea id="editTaskDescription" rows="4" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none">${task.description || ''}</textarea>
            </div>
            
            <!-- 상태 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">상태</label>
                <select id="editTaskStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                    <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>대기 중</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>진행 중</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>완료</option>
                </select>
            </div>
            
            <!-- 우선순위 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                <select id="editTaskPriority" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>낮음</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>보통</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>높음</option>
                </select>
            </div>
            
            <!-- 날짜 -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                    <input type="date" id="editTaskStartDate" value="${task.start_date ? task.start_date.split('T')[0] : ''}" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">마감일</label>
                    <input type="date" id="editTaskDueDate" value="${task.due_date ? task.due_date.split('T')[0] : ''}" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                </div>
            </div>
        </div>
    `;
}

// 인라인 편집 저장
async function saveInlineEdit() {
    try {
        if (!currentTaskId) return;
        
        const updatedTask = {
            id: currentTaskId,
            project_id: document.getElementById('editTaskProject').value,
            title: document.getElementById('editTaskTitle').value.trim(),
            description: document.getElementById('editTaskDescription').value.trim(),
            status: document.getElementById('editTaskStatus').value,
            priority: document.getElementById('editTaskPriority').value,
            start_date: document.getElementById('editTaskStartDate').value || null,
            due_date: document.getElementById('editTaskDueDate').value || null
        };
        
        if (!updatedTask.title) {
            showNotification('할 일 제목을 입력해주세요.', 'error');
            return;
        }
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열 업데이트
            const taskIndex = currentTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks[taskIndex] = {
                    ...currentTasks[taskIndex],
                    ...updatedTask,
                    updated_at: new Date().toISOString()
                };
                saveDemoDataToStorage();
            }
        } else {
            // Supabase 업데이트
            const { error } = await supabase
                .from('todos')
                .update({
                    project_id: updatedTask.project_id,
                    title: updatedTask.title,
                    description: updatedTask.description,
                    status: updatedTask.status,
                    priority: updatedTask.priority,
                    start_date: updatedTask.start_date,
                    due_date: updatedTask.due_date,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentTaskId);
            
            if (error) throw error;
            await loadTasks();
        }
        
        // 업데이트된 할 일 정보로 상세 보기 새로고침
        const task = currentTasks.find(t => t.id === currentTaskId);
        if (task) {
            await toggleInlineEditMode(task); // 편집 모드 해제
        }
        
        await updateStats();
        renderCurrentView();
        showNotification('할 일이 수정되었습니다.', 'success');
        
    } catch (error) {
        console.error('Error saving task:', error);
        showNotification('할 일 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 할 일 편집 모달 열기
function openEditTaskModal(task) {
    // 새 할 일 모달을 편집 모드로 전환
    const modal = elements.newTaskModal;
    const editForm = elements.newTaskForm;
    const modalTitle = modal.querySelector('h3');
    const submitBtn = editForm.querySelector('button[type="submit"]');
    
    // 제목 및 버튼 텍스트 변경
    modalTitle.textContent = '할 일 편집';
    submitBtn.innerHTML = '<span>수정하기</span>';
    
    // 폼에 기존 데이터 채우기
    elements.taskProject.value = task.project_id || '';
    elements.taskTitle.value = task.title || '';
    elements.taskDescription.value = task.description || '';
    elements.taskStartDateDisplay.value = task.start_date ? formatDateForInput(task.start_date) : '';
    elements.taskDueDateDisplay.value = task.due_date ? formatDateForInput(task.due_date) : '';
    elements.taskStartDate.value = task.start_date || '';
    elements.taskDueDate.value = task.due_date || '';
    elements.taskPriority.value = task.priority || 'medium';
    
    // 우선순위 버튼 상태 업데이트
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.remove('priority-selected', 'border-orange-300', 'bg-orange-50', 'text-orange-700');
        btn.classList.add('border-orange-200', 'text-orange-600');
        
        if (btn.dataset.priority === task.priority) {
            btn.classList.add('priority-selected', 'border-orange-300', 'bg-orange-50', 'text-orange-700');
            btn.classList.remove('border-orange-200', 'text-orange-600');
        }
    });
    
    // 편집 모드 플래그 설정
    editForm.dataset.editMode = 'true';
    editForm.dataset.editTaskId = task.id;
    
    modal.classList.remove('hidden');
}

// 날짜 포맷팅 함수
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// 할 일 삭제
async function handleDeleteTask() {
    if (!confirm('이 할 일을 삭제하시겠습니까?')) return;
    
    try {
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열에서 제거
            const taskIndex = currentTasks.findIndex(task => task.id === currentTaskId);
            if (taskIndex !== -1) {
                currentTasks.splice(taskIndex, 1);
                saveDemoDataToStorage();
            }
            
            // 관련 댓글도 제거
            currentComments = currentComments.filter(comment => 
                comment.task_id !== currentTaskId && comment.todo_id !== currentTaskId
            );
            saveDemoDataToStorage();
        } else {
            const { error } = await supabase
                .from('todos')
                .delete()
                .eq('id', currentTaskId);
            
            if (error) throw error;
            
            await loadTasks();
        }
        
        await updateStats();
        renderCurrentView();
        closeModal('taskDetailModal');
        showNotification('할 일이 삭제되었습니다.', 'success');
        
    } catch (error) {
        console.error('할 일 삭제 오류:', error);
        showNotification('할 일 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 캘린더 월 변경 (기존 방식)
function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar(); // 통합된 렌더링 함수 호출
}

// 사용자 메뉴 토글
function toggleUserMenu() {
    elements.userMenu.classList.toggle('hidden');
}

// 키보드 단축키
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'k':
                e.preventDefault();
                // TODO: 검색 기능 구현
                break;
            case 'n':
                e.preventDefault();
                elements.newTaskBtn.click();
                break;
        }
    }
    
    if (e.key === 'Escape') {
        // 열린 모달 닫기
        document.querySelectorAll('.fixed.inset-0:not(.hidden)').forEach(modal => {
            if (modal.id !== 'loading' && modal.id !== 'loginScreen') {
                modal.classList.add('hidden');
            }
        });
    }
}

// 실시간 업데이트 처리
function handleTaskRealTimeUpdate(payload) {
    switch (payload.eventType) {
        case 'INSERT':
            loadTasks().then(() => {
                updateStats();
                renderCurrentView();
                showNotification('새로운 할 일이 추가되었습니다.', 'info');
            });
            break;
        case 'UPDATE':
            loadTasks().then(() => {
                updateStats();
                renderCurrentView();
            });
            break;
        case 'DELETE':
            loadTasks().then(() => {
                updateStats();
                renderCurrentView();
            });
            break;
    }
}

function handleCommentRealTimeUpdate(payload) {
    if (currentTaskId && (payload.new?.task_id === currentTaskId || payload.new?.todo_id === currentTaskId)) {
        loadComments(currentTaskId);
        if (payload.eventType === 'INSERT') {
            showNotification('새 댓글이 추가되었습니다.', 'info');
        }
    }
}

// 유틸리티 함수들
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPriorityText(priority) {
    const priorities = {
        high: '높음',
        medium: '보통',
        low: '낮음'
    };
    return priorities[priority] || '보통';
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    
    return date.toLocaleDateString('ko-KR');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification p-4 rounded-lg shadow-lg text-white ${
        type === 'error' ? 'bg-red-500' : 
        type === 'success' ? 'bg-green-500' : 
        type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// 데모 데이터 초기화
function initializeDemoData() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // 데모 프로젝트
    currentProjects = [
        {
            id: 'demo-project-1',
            name: '웹사이트 리뉴얼',
            description: '회사 웹사이트 전면 리뉴얼 프로젝트',
            color: 'blue',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-project-2',
            name: '모바일 앱 개발',
            description: '새로운 모바일 애플리케이션 개발',
            color: 'green',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-project-3',
            name: '마케팅 캠페인',
            description: '2024년 마케팅 전략 수립 및 실행',
            color: 'purple',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            created_at: new Date().toISOString()
        }
    ];
    
    // 데모 할 일
    currentTasks = [
        {
            id: 'demo-task-1',
            title: 'UI/UX 디자인 시안 작성',
            description: '메인 페이지와 서브 페이지 디자인 시안을 작성합니다.',
            status: 'in_progress',
            priority: 'high',
            due_date: tomorrow.toISOString().split('T')[0],
            project_id: 'demo-project-1',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            assigned_to: 'demo-user-1',
            created_at: new Date().toISOString(),
            projects: { name: '웹사이트 리뉴얼', color: 'blue' },
            assigned_user: { full_name: '데모 사용자' }
        },
        {
            id: 'demo-task-2',
            title: '프론트엔드 개발 환경 설정',
            description: 'React, TypeScript, Tailwind CSS 개발 환경을 구축합니다.',
            status: 'completed',
            priority: 'medium',
            due_date: today.toISOString().split('T')[0],
            project_id: 'demo-project-1',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            assigned_to: 'demo-user-1',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            projects: { name: '웹사이트 리뉴얼', color: 'blue' },
            assigned_user: { full_name: '데모 사용자' }
        },
        {
            id: 'demo-task-3',
            title: 'API 서버 구조 설계',
            description: 'RESTful API 설계 및 데이터베이스 스키마 작성',
            status: 'pending',
            priority: 'high',
            due_date: nextWeek.toISOString().split('T')[0],
            project_id: 'demo-project-2',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            assigned_to: 'demo-user-1',
            created_at: new Date().toISOString(),
            projects: { name: '모바일 앱 개발', color: 'green' },
            assigned_user: { full_name: '데모 사용자' }
        },
        {
            id: 'demo-task-4',
            title: '소셜 미디어 콘텐츠 기획',
            description: '인스타그램, 페이스북 게시물 콘텐츠 기획 및 제작',
            status: 'in_progress',
            priority: 'medium',
            due_date: nextWeek.toISOString().split('T')[0],
            project_id: 'demo-project-3',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            assigned_to: 'demo-user-1',
            created_at: new Date().toISOString(),
            projects: { name: '마케팅 캠페인', color: 'purple' },
            assigned_user: { full_name: '데모 사용자' }
        },
        {
            id: 'demo-task-5',
            title: '사용자 테스트 계획 수립',
            description: 'α 버전 사용자 테스트를 위한 시나리오 작성',
            status: 'pending',
            priority: 'low',
            due_date: null,
            project_id: 'demo-project-2',
            workspace_id: 'demo-workspace-1',
            created_by: 'demo-user-1',
            assigned_to: 'demo-user-1',
            created_at: new Date().toISOString(),
            projects: { name: '모바일 앱 개발', color: 'green' },
            assigned_user: { full_name: '데모 사용자' }
        }
    ];
    
    // 데모 댓글
    currentComments = [
        {
            id: 'demo-comment-1',
            content: '디자인 시안 첫 번째 버전 완료했습니다. 검토 부탁드려요!',
            task_id: 'demo-task-1',
            todo_id: 'demo-task-1',
            user_id: 'demo-user-1',
            created_at: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
            user: { full_name: '데모 사용자', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face&auto=format' }
        },
        {
            id: 'demo-comment-2',
            content: '전체적인 색상 테마가 좋네요. 다만 버튼 디자인을 조금 더 현대적으로 수정하면 어떨까요?',
            task_id: 'demo-task-1',
            todo_id: 'demo-task-1',
            user_id: 'demo-user-1',
            created_at: new Date(Date.now() - 1800000).toISOString(), // 30분 전
            user: { full_name: '데모 사용자', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face&auto=format' }
        }
    ];
    
    updateProjectSelectors();
}

// 데모 모드용 로컬 스토리지 기반 CRUD
function saveDemoDataToStorage() {
    if (!isDemoMode) return;
    
    localStorage.setItem('demo_projects', JSON.stringify(currentProjects));
    localStorage.setItem('demo_tasks', JSON.stringify(currentTasks));
    localStorage.setItem('demo_comments', JSON.stringify(currentComments));
}

function loadDemoDataFromStorage() {
    if (!isDemoMode) return;
    
    const savedProjects = localStorage.getItem('demo_projects');
    const savedTasks = localStorage.getItem('demo_tasks');
    const savedComments = localStorage.getItem('demo_comments');
    
    if (savedProjects) currentProjects = JSON.parse(savedProjects);
    if (savedTasks) currentTasks = JSON.parse(savedTasks);
    if (savedComments) currentComments = JSON.parse(savedComments);
}

// 인증 상태 변경 리스너 (Supabase가 초기화된 경우에만)
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleAuthSuccess(session);
        } else if (event === 'SIGNED_OUT') {
            showLoginScreen();
        }
    });
}// 댓글 수정 처리
async function handleEditComment(commentId, newContent) {
    try {
        if (!newContent.trim()) {
            showNotification('댓글 내용을 입력해주세요.', 'error');
            return false;
        }
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열 업데이트
            const commentIndex = currentComments.findIndex(c => c.id === commentId);
            if (commentIndex !== -1) {
                currentComments[commentIndex].content = newContent;
                currentComments[commentIndex].updated_at = new Date().toISOString();
                saveDemoDataToStorage();
                renderComments();
                showNotification('댓글이 수정되었습니다.', 'success');
                return true;
            }
        } else {
            const { error } = await supabase
                .from('comments')
                .update({ 
                    content: newContent,
                    updated_at: new Date().toISOString()
                })
                .eq('id', commentId);
            
            if (error) throw error;
            
            await loadComments(currentTaskId);
            showNotification('댓글이 수정되었습니다.', 'success');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('댓글 수정 오류:', error);
        showNotification('댓글 수정 중 오류가 발생했습니다.', 'error');
        return false;
    }
}

// 댓글 삭제 처리
async function handleDeleteComment(commentId) {
    try {
        if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
        
        if (isDemoMode) {
            // 데모 모드에서는 로컬 배열에서 제거
            const commentIndex = currentComments.findIndex(c => c.id === commentId);
            if (commentIndex !== -1) {
                currentComments.splice(commentIndex, 1);
                saveDemoDataToStorage();
                renderComments();
                updateCommentsCount();
                showNotification('댓글이 삭제되었습니다.', 'success');
            }
        } else {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);
            
            if (error) throw error;
            
            await loadComments(currentTaskId);
            showNotification('댓글이 삭제되었습니다.', 'success');
        }
    } catch (error) {
        console.error('댓글 삭제 오류:', error);
        showNotification('댓글 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 댓글 수정/삭제 버튼 이벤트 리스너 설정
function setupCommentActions() {
    // 수정 버튼
    document.querySelectorAll('.edit-comment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentItem = this.closest('.comment-item');
            const contentEl = commentItem.querySelector('.comment-content');
            const editFormEl = commentItem.querySelector('.comment-edit-form');
            
            contentEl.classList.add('hidden');
            editFormEl.classList.remove('hidden');
        });
    });
    
    // 취소 버튼
    document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentItem = this.closest('.comment-item');
            const contentEl = commentItem.querySelector('.comment-content');
            const editFormEl = commentItem.querySelector('.comment-edit-form');
            
            contentEl.classList.remove('hidden');
            editFormEl.classList.add('hidden');
        });
    });
    
    // 저장 버튼
    document.querySelectorAll('.save-comment-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const commentItem = this.closest('.comment-item');
            const commentId = commentItem.dataset.commentId;
            const newContent = commentItem.querySelector('.edit-comment-text').value;
            
            const success = await handleEditComment(commentId, newContent);
            if (!success) {
                // 수정 실패 시 폼은 유지
                return;
            }
        });
    });
    
    // 삭제 버튼
    document.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentItem = this.closest('.comment-item');
            const commentId = commentItem.dataset.commentId;
            handleDeleteComment(commentId);
        });
    });
}// 모달 크기 토글 기능
function toggleModalSize() {
    isModalFullSize = !isModalFullSize;
    
    const container = elements.taskDetailModalContainer;
    const mainContent = elements.taskDetailMainContent;
    
    if (isModalFullSize) {
        // 전체보기 모드
        container.classList.remove('max-w-5xl', 'max-h-[85vh]');
        container.classList.add('max-w-[95vw]', 'max-h-[95vh]', 'w-[95vw]', 'h-[95vh]');
        mainContent.classList.remove('max-h-[65vh]');
        mainContent.classList.add('max-h-[75vh]');
        
        // 아이콘 변경 (축소 아이콘으로)
        elements.toggleModalSizeBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5m11 5.5V4.5M20.5 9H15m5.5 0l-5.5-5.5M9 20.5V15M9 20.5H4.5M9 20.5l-5.5-5.5m11-5.5V15m5.5 5.5H15m5.5 0l-5.5 5.5"></path>
            </svg>
        `;
        elements.toggleModalSizeBtn.title = "기본크기로 변경";
    } else {
        // 기본 크기 모드
        container.classList.remove('max-w-[95vw]', 'max-h-[95vh]', 'w-[95vw]', 'h-[95vh]');
        container.classList.add('max-w-5xl', 'max-h-[85vh]');
        mainContent.classList.remove('max-h-[75vh]');
        mainContent.classList.add('max-h-[65vh]');
        
        // 아이콘 변경 (확대 아이콘으로)
        elements.toggleModalSizeBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
            </svg>
        `;
        elements.toggleModalSizeBtn.title = "전체보기로 변경";
    }
}// 우선순위 선택 기능
function selectTaskPriority(priority) {
    // 모든 우선순위 버튼에서 선택 상태 제거
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.remove('priority-selected', 'border-orange-300', 'bg-orange-50', 'text-orange-700');
        btn.classList.add('border-gray-200', 'text-gray-600');
    });
    
    // 선택된 버튼에 스타일 적용
    const selectedBtn = document.querySelector(`[data-priority="${priority}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('priority-selected', 'border-orange-300', 'bg-orange-50', 'text-orange-700');
        selectedBtn.classList.remove('border-gray-200', 'text-gray-600');
    }
    
    // hidden input에 값 설정
    const priorityInput = document.getElementById('taskPriority');
    if (priorityInput) {
        priorityInput.value = priority;
    }
}// 커스텀 날짜 선택 캘린더 기능
const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

// 전역 캘린더 상태 객체
let calendarState = {
    start: {
        date: null,
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    },
    due: {
        date: null,
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    }
};

// 캘린더 초기화 통합 함수
function initializeCalendars() {
    console.log('Initializing calendars...');
    
    // 새 캘린더 시스템 초기화 (monthViewContainer가 존재하면)
    if (document.getElementById('monthViewContainer')) {
        initializeAdvancedCalendar();
    }
    
    // 할 일 입력 폼용 캘린더 초기화
    
    // 시작일 캘린더
    const startDateInput = document.getElementById('taskStartDate');
    const dueDateInput = document.getElementById('taskDueDate');
    
    console.log('Start date input:', startDateInput);
    console.log('Due date input:', dueDateInput);
    
    // 요소가 없으면 조용히 종료 (재시도하지 않음)
    if (!startDateInput || !dueDateInput) {
        return;
    }
    
    console.log('Date input elements found successfully');
    
    // HTML5 date input은 별도 초기화가 필요하지 않으므로 함수 완료

    console.log('Calendar initialization completed');
}

// 월/년 선택 옵션 업데이트
function updateMonthYearOptions(monthSelect, yearSelect, currentMonth, currentYear) {
    if (!monthSelect || !yearSelect) return;
    
    // 월 옵션 설정
    monthSelect.innerHTML = '';
    months.forEach((month, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = month;
        option.selected = i === currentMonth;
        monthSelect.appendChild(option);
    });
    
    // 년 옵션 설정 (현재 년도 ±10년)
    yearSelect.innerHTML = '';
    for (let year = currentYear - 10; year <= currentYear + 10; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + '년';
        option.selected = year === currentYear;
        yearSelect.appendChild(option);
    }
}

// 캘린더 날짜 그리드 업데이트
function updateCalendarDays(daysContainer, year, month, selectedDate, calendarType) {
    if (!daysContainer) return;
    
    daysContainer.innerHTML = '';
    
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayIndex = firstDay.getDay(); // 0은 일요일
    
    // 이전 달의 일수
    const prevLastDay = new Date(year, month, 0);
    const prevDaysInMonth = prevLastDay.getDate();
    
    // 이전 달의 날짜 표시
    for (let i = startDayIndex - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        day.textContent = prevDaysInMonth - i;
        daysContainer.appendChild(day);
    }
    
    // 현재 달의 날짜 표시
    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('day');
        day.textContent = i;
        
        // 오늘 날짜 표시
        if (
            year === today.getFullYear() &&
            month === today.getMonth() &&
            i === today.getDate()
        ) {
            day.classList.add('today');
        }
        
        // 선택된 날짜 표시
        if (
            selectedDate &&
            year === selectedDate.getFullYear() &&
            month === selectedDate.getMonth() &&
            i === selectedDate.getDate()
        ) {
            day.classList.add('selected');
        }
        
        // 날짜 클릭 이벤트
        day.addEventListener('click', function() {
            const selectedDay = new Date(year, month, i);
            
            // 이전에 선택된 날짜 클래스 제거
            daysContainer.querySelectorAll('.day.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 새로 선택된 날짜에 클래스 추가
            day.classList.add('selected');
            
            // 날짜 입력 필드 업데이트
            updateDateField(selectedDay, calendarType);
            
            // 캘린더 상태 업데이트
            if (calendarType === 'start') {
                calendarState.start.date = selectedDay;
                document.getElementById('startDateCalendar').style.display = 'none';
            } else {
                calendarState.due.date = selectedDay;
                document.getElementById('dueDateCalendar').style.display = 'none';
            }
        });
        
        daysContainer.appendChild(day);
    }
    
    // 다음 달의 날짜 표시 (마지막 줄 채우기)
    const remainingDays = 42 - (startDayIndex + daysInMonth); // 7일 * 6주 = 42
    for (let i = 1; i <= remainingDays; i++) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        day.textContent = i;
        daysContainer.appendChild(day);
    }
}

// 날짜 입력 필드 업데이트
function updateDateField(date, calendarType) {
    const formattedDate = formatDate(date);
    
    if (calendarType === 'start') {
        document.getElementById('taskStartDateDisplay').value = formattedDate;
        document.getElementById('taskStartDate').value = date.toISOString().split('T')[0];
    } else {
        document.getElementById('taskDueDateDisplay').value = formattedDate;
        document.getElementById('taskDueDate').value = date.toISOString().split('T')[0];
    }
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// formatDateYMD는 formatDate와 동일한 기능을 수행하므로 별칭으로 설정
const formatDateYMD = formatDate;

// 캘린더 초기화 함수 호출 - 중복 제거 후 통합된 initCalendars만 호출
document.addEventListener('DOMContentLoaded', function() {
    // 다른 DOMContentLoaded 이벤트 핸들러가 있을 수 있으므로 기존 코드 덮어쓰지 않도록 함
    setTimeout(() => {
        initializeCalendars(); // 통합된 캘린더 초기화 함수 호출
    }, 100);
});// 달력 위치 조정 함수
function adjustCalendarPosition(calendar, triggerElement) {
    if (!calendar || !triggerElement) return;
    
    // 기본 위치는 위쪽
    calendar.style.bottom = '100%';
    calendar.style.top = 'auto';
    calendar.style.marginBottom = '8px';
    calendar.style.marginTop = '0';
    
    // 달력 표시 후 위치 확인
    setTimeout(() => {
        const calendarRect = calendar.getBoundingClientRect();
        const triggerRect = triggerElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // 위쪽 공간이 부족한 경우 아래쪽으로 표시
        if (calendarRect.top < 0) {
            calendar.style.bottom = 'auto';
            calendar.style.top = '100%';
            calendar.style.marginBottom = '0';
            calendar.style.marginTop = '8px';
        }
    }, 10);
}

// 캘린더 뷰 관련 상태 - 기존 calendarState와 구별
const calendarViewState = {
    view: 'month', // 'month' 또는 'week'
    currentDate: new Date(),
    selectedDate: null,
    weekStartDate: null,
    weekEndDate: null
};

// formatDateYMD는 위에서 formatDate의 별칭으로 정의됨

function formatDateDisplay(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
}

function formatDateKorean(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}. ${month}. ${day}.`;
}

// 요일 이름 가져오기
function getDayName(date, isShort = false) {
    const days = isShort 
        ? ['일', '월', '화', '수', '목', '금', '토'] 
        : ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return days[date.getDay()];
}

// 고급 캘린더 초기화 및 이벤트 핸들러 설정 (initCalendars에서 호출됨)
function initializeAdvancedCalendar() {
    // 중복 이벤트 리스너 방지를 위해 기존 리스너 제거
    const prevBtn = document.getElementById('prevPeriod');
    const nextBtn = document.getElementById('nextPeriod');
    const monthBtn = document.getElementById('monthViewBtn');
    const weekBtn = document.getElementById('weekViewBtn');
    const todayBtn = document.getElementById('todayBtn');
    
    // 기존 이벤트 리스너 제거를 위해 새로운 요소로 교체
    if (prevBtn) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    }
    if (nextBtn) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    }
    
    // 월간/주간 전환 버튼 이벤트
    document.getElementById('monthViewBtn').addEventListener('click', () => {
        calendarViewState.view = 'month';
        renderCalendar();
    });
    
    document.getElementById('weekViewBtn').addEventListener('click', () => {
        calendarViewState.view = 'week';
        renderCalendar();
    });
    
    // 이전/다음 기간 이동 버튼 이벤트 (1달씩만 이동)
    document.getElementById('prevPeriod').addEventListener('click', () => {
        if (calendarViewState.view === 'month') {
            // 이전 달로 이동
            calendarViewState.currentDate.setMonth(calendarViewState.currentDate.getMonth() - 1);
        } else {
            // 이전 주로 이동
            calendarViewState.currentDate.setDate(calendarViewState.currentDate.getDate() - 7);
        }
        renderCalendar();
    });
    
    document.getElementById('nextPeriod').addEventListener('click', () => {
        if (calendarViewState.view === 'month') {
            // 다음 달로 이동
            calendarViewState.currentDate.setMonth(calendarViewState.currentDate.getMonth() + 1);
        } else {
            // 다음 주로 이동
            calendarViewState.currentDate.setDate(calendarViewState.currentDate.getDate() + 7);
        }
        renderCalendar();
    });
    
    // 오늘로 이동 버튼 이벤트
    document.getElementById('todayBtn').addEventListener('click', () => {
        calendarViewState.currentDate = new Date();
        renderCalendar();
    });
    
    // 일정 추가 버튼 이벤트
    document.getElementById('addCalendarEventBtn').addEventListener('click', () => {
        openModal('newTaskModal');
    });
    
    // 날짜 이벤트 팝업 닫기 버튼 이벤트
    document.getElementById('closePopupBtn').addEventListener('click', () => {
        document.getElementById('dateEventPopup').classList.add('hidden');
    });
    
    // 일정 상세 모달 닫기 버튼 이벤트
    document.getElementById('closeEventDetailBtn').addEventListener('click', () => {
        document.getElementById('eventDetailModal').classList.add('hidden');
    });
    
    // 초기 캘린더 렌더링
    renderCalendar();
}

// 메인 캘린더 렌더링 함수
function renderCalendar() {
    // 새로운 캘린더 시스템이 활성화되어 있으면 그것을 사용, 아니면 레거시 캘린더 사용
    if (typeof calendarViewState !== 'undefined' && document.getElementById('monthViewContainer')) {
        // 새 캘린더 시스템 사용
        if (calendarViewState.view === 'month') {
            renderMonthView();
        } else {
            renderWeekView();
        }
        
        // 현재 기간 표시 업데이트
        updatePeriodDisplay();
        
        // 뷰 버튼 상태 업데이트
        updateViewButtons();
    } else {
        // 레거시 캘린더 사용
        renderLegacyCalendar();
    }
}

// 현재 기간 표시 업데이트
function updatePeriodDisplay() {
    const currentPeriodElement = document.getElementById('currentPeriod');
    
    if (calendarViewState.view === 'month') {
        const year = calendarViewState.currentDate.getFullYear();
        const month = calendarViewState.currentDate.getMonth() + 1;
        currentPeriodElement.textContent = `${year}년 ${month}월`;
    } else {
        // 주간 뷰일 경우 시작일~종료일 표시
        const startDate = calendarViewState.weekStartDate;
        const endDate = calendarViewState.weekEndDate;
        const startMonth = startDate.getMonth() + 1;
        const endMonth = endDate.getMonth() + 1;
        const startDay = startDate.getDate();
        const endDay = endDate.getDate();
        
        if (startDate.getFullYear() === endDate.getFullYear() && startMonth === endMonth) {
            // 같은 달인 경우
            currentPeriodElement.textContent = `${startDate.getFullYear()}년 ${startMonth}월 ${startDay}일 - ${endDay}일`;
        } else if (startDate.getFullYear() === endDate.getFullYear()) {
            // 다른 달, 같은 해인 경우
            currentPeriodElement.textContent = `${startDate.getFullYear()}년 ${startMonth}월 ${startDay}일 - ${endMonth}월 ${endDay}일`;
        } else {
            // 다른 해인 경우
            currentPeriodElement.textContent = `${startDate.getFullYear()}년 ${startMonth}월 ${startDay}일 - ${endDate.getFullYear()}년 ${endMonth}월 ${endDay}일`;
        }
    }
}

// 뷰 버튼 상태 업데이트
function updateViewButtons() {
    const monthViewBtn = document.getElementById('monthViewBtn');
    const weekViewBtn = document.getElementById('weekViewBtn');
    
    if (calendarViewState.view === 'month') {
        monthViewBtn.classList.add('bg-blue-600', 'text-white');
        monthViewBtn.classList.remove('bg-gray-100', 'text-gray-700');
        weekViewBtn.classList.add('bg-gray-100', 'text-gray-700');
        weekViewBtn.classList.remove('bg-blue-600', 'text-white');
    } else {
        weekViewBtn.classList.add('bg-blue-600', 'text-white');
        weekViewBtn.classList.remove('bg-gray-100', 'text-gray-700');
        monthViewBtn.classList.add('bg-gray-100', 'text-gray-700');
        monthViewBtn.classList.remove('bg-blue-600', 'text-white');
    }
}

// 월간 뷰 렌더링
function renderMonthView() {
    const year = calendarViewState.currentDate.getFullYear();
    const month = calendarViewState.currentDate.getMonth();
    
    // 월간 뷰 컨테이너 표시, 주간 뷰 숨기기
    document.getElementById('monthViewContainer').classList.remove('hidden');
    document.getElementById('weekViewContainer').classList.add('hidden');
    
    // 해당 월의 첫째 날
    const firstDay = new Date(year, month, 1);
    // 해당 월의 마지막 날
    const lastDay = new Date(year, month + 1, 0);
    
    // 첫째 날의 요일 (0: 일요일, 1: 월요일, ...)
    const firstDayIndex = firstDay.getDay();
    // 마지막 날의 날짜
    const lastDayDate = lastDay.getDate();
    
    // 이전 달의 마지막 날
    const prevLastDay = new Date(year, month, 0);
    const prevLastDayDate = prevLastDay.getDate();
    
    // 캘린더 그리드 요소
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // 이전 달의 날짜
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const day = prevLastDayDate - i;
        const dayDate = new Date(year, month - 1, day);
        const dayCell = createDayCell(dayDate, true);
        calendarGrid.appendChild(dayCell);
    }
    
    // 현재 달의 날짜
    const today = new Date();
    
    for (let i = 1; i <= lastDayDate; i++) {
        const dayDate = new Date(year, month, i);
        const dayCell = createDayCell(dayDate, false);
        calendarGrid.appendChild(dayCell);
    }
    
    // 다음 달의 날짜 (42일을 채우기 위해)
    const daysToAdd = 42 - (firstDayIndex + lastDayDate);
    for (let i = 1; i <= daysToAdd; i++) {
        const dayDate = new Date(year, month + 1, i);
        const dayCell = createDayCell(dayDate, true);
        calendarGrid.appendChild(dayCell);
    }
}

// 주간 뷰 렌더링
function renderWeekView() {
    // 월간 뷰 숨기기, 주간 뷰 표시
    document.getElementById('monthViewContainer').classList.add('hidden');
    document.getElementById('weekViewContainer').classList.remove('hidden');
    
    // 현재 선택된 날짜가 속한 주의 시작일과 종료일 계산
    const currentDate = calendarViewState.currentDate;
    const currentDay = currentDate.getDay(); // 0: 일요일, 6: 토요일
    
    // 해당 주의 일요일(시작일)
    const weekStartDate = new Date(currentDate);
    weekStartDate.setDate(currentDate.getDate() - currentDay);
    calendarViewState.weekStartDate = weekStartDate;
    
    // 해당 주의 토요일(종료일)
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    calendarViewState.weekEndDate = weekEndDate;
    
    // 주간 그리드 요소
    const weekGrid = document.getElementById('weekGrid');
    weekGrid.innerHTML = '';
    
    // 주간 뷰의 각 날짜 표시
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + i);
        
        const dayCell = createWeekDayCell(dayDate);
        weekGrid.appendChild(dayCell);
    }
}

// 날짜 셀 생성 (월간 뷰용)
function createDayCell(date, isOtherMonth) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const dateStr = formatDateYMD(date);
    
    // 오늘 날짜 확인
    const today = new Date();
    const isToday = date.getFullYear() === today.getFullYear() && 
                  date.getMonth() === today.getMonth() && 
                  date.getDate() === today.getDate();
    
    // 선택된 날짜 확인
    const isSelected = calendarViewState.selectedDate && 
                     date.getFullYear() === calendarViewState.selectedDate.getFullYear() &&
                     date.getMonth() === calendarViewState.selectedDate.getMonth() &&
                     date.getDate() === calendarViewState.selectedDate.getDate();
    
    // 날짜 셀 요소 생성
    const dayCell = document.createElement('div');
    dayCell.className = `calendar-day ${isOtherMonth ? 'other-month opacity-40 text-gray-400' : 'current-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;
    dayCell.setAttribute('data-date', dateStr);
    
    // 날짜 번호 표시
    const dateNumber = document.createElement('div');
    dateNumber.className = `date-number ${isToday ? 'today text-blue-600 font-bold' : ''} ${isOtherMonth ? 'text-gray-400' : 'text-gray-800'}`;
    dateNumber.textContent = day;
    dayCell.appendChild(dateNumber);
    
    // 이벤트 컨테이너
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events-container';
    
    // 해당 날짜의 일정 찾기
    const dayEvents = getEventsForDate(date);
    
    // 일정을 도트로 표시 (최대 6개 도트)
    const maxVisibleDots = 6;
    const visibleEvents = dayEvents.slice(0, maxVisibleDots);
    
    if (dayEvents.length > 0) {
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'calendar-dots-container flex flex-wrap justify-center gap-1 mt-2';
        
        visibleEvents.forEach(event => {
            const dot = document.createElement('div');
            dot.className = `calendar-event-dot w-2 h-2 rounded-full bg-${event.projects?.color || 'blue'}-500`;
            dot.title = event.title; // 도트에 마우스를 올렸을 때 제목 표시
            dotsContainer.appendChild(dot);
        });
        
        // 더 많은 일정이 있을 경우 추가 도트 표시
        if (dayEvents.length > maxVisibleDots) {
            const remainingCount = dayEvents.length - maxVisibleDots;
            for (let i = 0; i < Math.min(remainingCount, 3); i++) {
                const dot = document.createElement('div');
                dot.className = 'calendar-event-dot w-2 h-2 rounded-full bg-gray-400';
                dotsContainer.appendChild(dot);
            }
        }
        
        eventsContainer.appendChild(dotsContainer);
    }
    
    dayCell.appendChild(eventsContainer);
    
    // 날짜 클릭 이벤트
    dayCell.addEventListener('click', () => {
        selectDate(date);
        showDateEventPopup(dayCell, date);
    });
    
    return dayCell;
}

// 주간 뷰용 날짜 셀 생성
function createWeekDayCell(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const dateStr = formatDateYMD(date);
    const dayName = getDayName(date, true);
    
    // 오늘 날짜 확인
    const today = new Date();
    const isToday = date.getFullYear() === today.getFullYear() && 
                  date.getMonth() === today.getMonth() && 
                  date.getDate() === today.getDate();
    
    // 주간 뷰 셀 요소 생성
    const dayCell = document.createElement('div');
    dayCell.className = `week-day ${isToday ? 'today' : ''}`;
    dayCell.setAttribute('data-date', dateStr);
    
    // 날짜 헤더
    const dayHeader = document.createElement('div');
    dayHeader.className = 'week-day-header';
    
    const dateElement = document.createElement('div');
    dateElement.className = 'week-date';
    dateElement.textContent = day;
    
    // 주간 뷰에서는 요일명을 개별 셀에 표시하지 않음 (헤더에 이미 있음)
    dayHeader.appendChild(dateElement);
    dayCell.appendChild(dayHeader);
    
    // 이벤트 컨테이너
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events-container';
    
    // 해당 날짜의 일정을 도트로 표시
    const dayEvents = getEventsForDate(date);
    
    if (dayEvents.length > 0) {
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'calendar-dots-container flex flex-wrap justify-center gap-1 mt-2';
        
        const maxVisibleDots = 8; // 주간 뷰에서는 더 많은 도트 표시 가능
        const visibleEvents = dayEvents.slice(0, maxVisibleDots);
        
        visibleEvents.forEach(event => {
            const dot = document.createElement('div');
            dot.className = `calendar-event-dot w-2 h-2 rounded-full bg-${event.projects?.color || 'blue'}-500`;
            dot.title = event.title;
            dotsContainer.appendChild(dot);
        });
        
        // 더 많은 일정이 있을 경우 추가 도트 표시
        if (dayEvents.length > maxVisibleDots) {
            const remainingCount = dayEvents.length - maxVisibleDots;
            for (let i = 0; i < Math.min(remainingCount, 2); i++) {
                const dot = document.createElement('div');
                dot.className = 'calendar-event-dot w-2 h-2 rounded-full bg-gray-400';
                dotsContainer.appendChild(dot);
            }
        }
        
        eventsContainer.appendChild(dotsContainer);
    }
    
    dayCell.appendChild(eventsContainer);
    
    // 날짜 클릭 이벤트
    dayCell.addEventListener('click', () => {
        selectDate(date);
        showDateEventPopup(dayCell, date);
    });
    
    return dayCell;
}

// 특정 날짜의 일정 가져오기
function getEventsForDate(date) {
    const dateStr = formatDateYMD(date);
    
    // 예제 데이터를 이용한 이벤트 찾기
    return currentTasks.filter(task => {
        if (!task.start_date && !task.due_date) return false;
        
        const startDate = task.start_date ? new Date(task.start_date) : null;
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        
        const formattedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        // 시작일과 마감일 사이에 있는 경우
        if (startDate && dueDate) {
            const formattedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const formattedDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            return formattedDate >= formattedStartDate && formattedDate <= formattedDueDate;
        }
        
        // 시작일만 있는 경우
        if (startDate && !dueDate) {
            const formattedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            return formattedDate.getTime() === formattedStartDate.getTime();
        }
        
        // 마감일만 있는 경우
        if (!startDate && dueDate) {
            const formattedDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            return formattedDate.getTime() === formattedDueDate.getTime();
        }
        
        return false;
    });
}

// 일정 요소 생성
function createEventElement(event) {
    const eventElement = document.createElement('div');
    eventElement.className = `calendar-event event-${event.projects?.color || 'blue'}`;
    eventElement.textContent = event.title;
    
    // 일정 클릭 이벤트
    eventElement.addEventListener('click', (e) => {
        e.stopPropagation(); // 부모 요소 클릭 이벤트 전파 방지
        showEventDetail(event);
    });
    
    return eventElement;
}

// 날짜 선택
function selectDate(date) {
    calendarViewState.selectedDate = date;
    
    // 기존 선택된 날짜의 하이라이트 제거
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelectorAll('.week-day.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 새로 선택된 날짜 하이라이트
    const dateStr = formatDateYMD(date);
    const selectedCell = document.querySelector(`[data-date="${dateStr}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }
}

// 날짜 이벤트 팝업 표시
function showDateEventPopup(cellElement, date) {
    const popup = document.getElementById('dateEventPopup');
    const popupDate = document.getElementById('popupDate');
    const eventsList = document.getElementById('dateEventsList');
    
    // 날짜 표시 설정
    const dayName = getDayName(date);
    popupDate.textContent = `${formatDateDisplay(date)} ${dayName}`;
    
    // 이벤트 목록 표시
    eventsList.innerHTML = '';
    
    const events = getEventsForDate(date);
    
    if (events.length === 0) {
        eventsList.innerHTML = '<p class="text-gray-500 text-center py-8">이 날짜에 등록된 할 일이 없습니다.</p>';
    } else {
        events.forEach(event => {
            const eventItem = document.createElement('div');
            eventItem.className = 'bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer';
            
            // 상단: 제목과 상태
            const headerDiv = document.createElement('div');
            headerDiv.className = 'flex items-start justify-between mb-3';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'flex-1';
            
            const title = document.createElement('h4');
            title.className = 'font-semibold text-gray-900 text-sm mb-1';
            title.textContent = event.title;
            
            // 프로젝트 라벨
            if (event.projects) {
                const projectLabel = document.createElement('div');
                projectLabel.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${event.projects.color}-100 text-${event.projects.color}-700 mb-2`;
                projectLabel.textContent = event.projects.name;
                titleDiv.appendChild(projectLabel);
            }
            
            titleDiv.appendChild(title);
            
            // 상태 뱃지
            const statusBadge = document.createElement('span');
            const statusTexts = {
                'pending': '진행중',
                'in_progress': '완료',
                'completed': '완료'
            };
            const statusColors = {
                'pending': 'bg-blue-100 text-blue-700',
                'in_progress': 'bg-green-100 text-green-700',
                'completed': 'bg-green-100 text-green-700'
            };
            statusBadge.className = `px-2 py-1 rounded-full text-xs font-medium ${statusColors[event.status] || 'bg-blue-100 text-blue-700'}`;
            statusBadge.textContent = statusTexts[event.status] || '진행중';
            
            headerDiv.appendChild(titleDiv);
            headerDiv.appendChild(statusBadge);
            eventItem.appendChild(headerDiv);
            
            // 설명 (있는 경우)
            if (event.description) {
                const description = document.createElement('p');
                description.className = 'text-gray-600 text-sm mb-3 leading-relaxed';
                description.textContent = event.description;
                eventItem.appendChild(description);
            }
            
            // 하단: 시간 정보
            if (event.start_date || event.due_date) {
                const timeInfo = document.createElement('div');
                timeInfo.className = 'flex items-center text-xs text-gray-500';
                
                const timeIcon = document.createElement('svg');
                timeIcon.className = 'w-3 h-3 mr-1';
                timeIcon.innerHTML = '<path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>';
                timeIcon.setAttribute('viewBox', '0 0 24 24');
                
                const timeText = document.createElement('span');
                if (event.start_date && event.due_date) {
                    timeText.textContent = `시작: ${formatDateKorean(new Date(event.start_date))} • 마감: ${formatDateKorean(new Date(event.due_date))}`;
                } else if (event.start_date) {
                    timeText.textContent = `시작: ${formatDateKorean(new Date(event.start_date))}`;
                } else if (event.due_date) {
                    timeText.textContent = `마감: ${formatDateKorean(new Date(event.due_date))}`;
                }
                
                timeInfo.appendChild(timeIcon);
                timeInfo.appendChild(timeText);
                eventItem.appendChild(timeInfo);
            }
            
            // 이벤트 클릭 처리
            eventItem.addEventListener('click', () => {
                showEventDetail(event);
            });
            
            eventsList.appendChild(eventItem);
        });
    }
    
    // 팝업은 이제 화면 중앙에 표시되므로 위치 설정 불필요
    
    // 팝업 표시
    popup.classList.remove('hidden');
    
    // 팝업 닫기 버튼 이벤트
    document.getElementById('closePopupBtn').onclick = () => {
        popup.classList.add('hidden');
    };
    
    // 새 일정 추가 버튼 이벤트
    document.getElementById('addDateEventBtn').onclick = () => {
        // 새 할 일 모달 열기 (시작일에 선택한 날짜 설정)
        openNewTaskModalWithDate(date);
        popup.classList.add('hidden');
    };
    
    // 배경 클릭 시 팝업 닫기
    const handleBackgroundClick = (e) => {
        if (e.target === popup) {
            popup.classList.add('hidden');
            document.removeEventListener('click', handleBackgroundClick);
        }
    };
    
    // 현재 클릭 이벤트가 처리된 후에 이벤트 리스너 추가
    setTimeout(() => {
        popup.addEventListener('click', handleBackgroundClick);
    }, 0);
}

// 일정 상세 모달 표시
function showEventDetail(event) {
    const modal = document.getElementById('eventDetailModal');
    
    // 일정 정보 설정
    document.getElementById('eventDetailTitle').textContent = event.title;
    
    const projectElement = document.getElementById('eventDetailProject');
    if (event.projects) {
        projectElement.innerHTML = `
            <div class="w-3 h-3 rounded-full bg-${event.projects.color}-500 mr-2"></div>
            <span class="text-sm">${event.projects.name}</span>
        `;
    } else {
        projectElement.innerHTML = '<span class="text-sm text-gray-500">프로젝트 없음</span>';
    }
    
    // 상태 표시
    const statusElement = document.getElementById('eventDetailStatus');
    const statusTexts = {
        'pending': '대기 중',
        'in_progress': '진행 중',
        'completed': '완료'
    };
    const statusClasses = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'in_progress': 'bg-blue-100 text-blue-800',
        'completed': 'bg-green-100 text-green-800'
    };
    statusElement.textContent = statusTexts[event.status] || '대기 중';
    statusElement.className = `px-2 py-1 text-xs rounded-full ${statusClasses[event.status] || 'bg-yellow-100 text-yellow-800'}`;
    
    // 우선순위 표시
    const priorityElement = document.getElementById('eventDetailPriority');
    const priorityTexts = {
        'high': '높음',
        'medium': '보통',
        'low': '낮음'
    };
    const priorityClasses = {
        'high': 'bg-red-100 text-red-800',
        'medium': 'bg-yellow-100 text-yellow-800',
        'low': 'bg-green-100 text-green-800'
    };
    priorityElement.textContent = priorityTexts[event.priority] || '보통';
    priorityElement.className = `px-2 py-1 text-xs rounded-full ${priorityClasses[event.priority] || 'bg-yellow-100 text-yellow-800'}`;
    
    // 날짜 정보
    document.getElementById('eventDetailStartDate').textContent = event.start_date ? formatDateKorean(new Date(event.start_date)) : '-';
    document.getElementById('eventDetailDueDate').textContent = event.due_date ? formatDateKorean(new Date(event.due_date)) : '-';
    
    // 설명
    document.getElementById('eventDetailDescription').textContent = event.description || '설명 없음';
    
    // 편집 버튼 이벤트
    document.getElementById('editEventBtn').onclick = () => {
        // 할 일 편집 모달 열기
        openTaskDetail(event.id);
        modal.classList.add('hidden');
    };
    
    // 상세 보기 버튼 이벤트
    document.getElementById('openTaskDetailBtn').onclick = () => {
        // 할 일 상세 보기 모달 열기
        openTaskDetail(event.id);
        modal.classList.add('hidden');
    };
    
    // 닫기 버튼 이벤트
    document.getElementById('closeEventDetailBtn').onclick = () => {
        modal.classList.add('hidden');
    };
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 모달 바깥 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

// 선택한 날짜로 새 할 일 모달 열기
function openNewTaskModalWithDate(date) {
    // 새 할 일 모달 열기
    openModal('newTaskModal');
    
    // 시작일에 선택한 날짜 설정
    setTimeout(() => {
        const formattedDate = formatDateYMD(date);
        document.getElementById('taskStartDate').value = formattedDate;
        document.getElementById('taskStartDateDisplay').value = formatDateYMD(date);
        
        // 캘린더 상태 업데이트
        if (calendarState.start) {
            calendarState.start.date = date;
            calendarState.start.year = date.getFullYear();
            calendarState.start.month = date.getMonth();
        }
    }, 100);
}