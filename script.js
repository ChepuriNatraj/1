class TaskManager {
    constructor() {
        this.tasks = [];
        this.completedTasks = [];
        this.draggedTask = null;
        this.taskIdCounter = 1;
        
        this.initializeElements();
        this.filters = { search: '', quadrant: 'all' };
        this.insights = [];
        this.initializeEmptyStates();
    this.renderInsights();
        this.bindEvents();
        this.loadData();
        this.updateStats();
        this.startDeadlineChecker();
    }

    initializeElements() {
        this.elements = {
            newTaskInput: document.getElementById('new-task'),
            taskDescription: document.getElementById('task-description'),
            addTaskBtn: document.getElementById('add-task'),
            clearAllBtn: document.getElementById('clear-all'),
            dueDateInput: document.getElementById('due-date'),
            importanceSelect: document.getElementById('importance'),
            recalcBtn: document.getElementById('recalc-urgency'),
            taskSearch: document.getElementById('task-search'),
            quadrantFilter: document.getElementById('quadrant-filter'),
            resetFilter: document.getElementById('reset-filter'),
            totalTasks: document.getElementById('total-tasks'),
            completedCount: document.getElementById('completed-count'),
            productivityScore: document.getElementById('productivity-score'),
            focusAreas: document.getElementById('focus-areas'),
            activeQuadrant: document.getElementById('active-quadrant'),
            progressRingPath: document.getElementById('progress-ring'),
            completedTasks: document.getElementById('completed-tasks'),
            modal: document.getElementById('task-modal'),
            modalBody: document.getElementById('modal-body'),
            closeModal: document.querySelector('.close'),
            tabButtons: document.querySelectorAll('.tab-button'),
            deadlinePopup: document.getElementById('deadline-popup'),
            deadlinePopupBody: document.getElementById('deadline-popup-body'),
            deadlineClose: document.getElementById('deadline-close'),
            deadlineSnooze: document.getElementById('deadline-snooze'),
            deadlineDismiss: document.getElementById('deadline-dismiss'),
            insightLog: document.getElementById('insight-log'),
            taskZones: {
                'urgent-important': document.getElementById('urgent-important-zone'),
                'not-urgent-important': document.getElementById('not-urgent-important-zone'),
                'urgent-not-important': document.getElementById('urgent-not-important-zone'),
                'not-urgent-not-important': document.getElementById('not-urgent-not-important-zone')
            },
            distributionBars: document.querySelectorAll('#analytics-distribution .distribution-bar span')
        };
    }

    initializeEmptyStates() {
        Object.entries(this.elements.taskZones).forEach(([quadrant, zone]) => {
            if (!zone) return;
            zone.dataset.emptyState = `No tasks in ${this.getQuadrantShortName(quadrant)}`;
            zone.classList.add('empty');
        });
        this.updateEmptyStates(false);
    }

    bindEvents() {
        // Task input events
        this.elements.addTaskBtn.addEventListener('click', () => this.addTask());
        this.elements.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAllTasks());
        if (this.elements.recalcBtn) {
            this.elements.recalcBtn.addEventListener('click', () => this.recalculateUrgency());
        }

        if (this.elements.taskSearch) {
            this.elements.taskSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.trim().toLowerCase();
                this.applyFilters();
            });
        }

        if (this.elements.quadrantFilter) {
            this.elements.quadrantFilter.addEventListener('change', (e) => {
                this.filters.quadrant = e.target.value;
                this.applyFilters();
            });
        }

        if (this.elements.resetFilter) {
            this.elements.resetFilter.addEventListener('click', () => {
                this.filters = { search: '', quadrant: 'all' };
                if (this.elements.taskSearch) this.elements.taskSearch.value = '';
                if (this.elements.quadrantFilter) this.elements.quadrantFilter.value = 'all';
                this.applyFilters();
            });
        }

        // Sync setup button
        const setupSyncBtn = document.getElementById('setup-sync-btn');
        if (setupSyncBtn) {
            setupSyncBtn.addEventListener('click', () => this.setupSync());
        }

        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // Modal events
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });

        // Deadline popup events
        if (this.elements.deadlineClose) {
            this.elements.deadlineClose.addEventListener('click', () => this.hideDeadlinePopup());
        }
        if (this.elements.deadlineSnooze) {
            this.elements.deadlineSnooze.addEventListener('click', () => this.snoozeDeadlineAlert());
        }
        if (this.elements.deadlineDismiss) {
            this.elements.deadlineDismiss.addEventListener('click', () => this.dismissDeadlineAlert());
        }

        // Drag and drop events for task zones
        Object.values(this.elements.taskZones).forEach(zone => {
            zone.addEventListener('dragover', (e) => this.handleDragOver(e));
            zone.addEventListener('drop', (e) => this.handleDrop(e));
            zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            
            // Touch events for mobile support
            zone.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            zone.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            zone.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        });
    }

    addTask() {
        const title = this.elements.newTaskInput.value.trim();
        const description = this.elements.taskDescription.value.trim();

        if (!title) {
            this.showNotification('Please enter a task title', 'error');
            return;
        }

        const quadrant = this.deriveQuadrant(this.elements.dueDateInput?.value, this.elements.importanceSelect?.value);

        const task = {
            id: this.taskIdCounter++,
            title,
            description,
            quadrant,
            dueDate: this.elements.dueDateInput?.value || null,
            importance: this.elements.importanceSelect?.value || 'important',
            createdAt: new Date().toISOString(),
            priority: this.calculatePriority(quadrant)
        };

        this.tasks.push(task);
        this.renderTask(task);
        this.clearInputs();
        this.saveData();
        this.updateStats();
        this.showNotification('Task added successfully!', 'success');
        this.logInsight(`Added task "${title}" to ${this.getQuadrantShortName(quadrant)}`);
    }

    renderTask(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.draggable = true;
        taskElement.dataset.taskId = task.id;

        taskElement.innerHTML = `
            <div class="task-title">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            <div class="task-actions">
                <button class="complete-btn" onclick="taskManager.completeTask(${task.id})">✓</button>
                <button class="edit-btn" onclick="taskManager.editTask(${task.id})">✎</button>
                <button class="delete-btn" onclick="taskManager.deleteTask(${task.id})">✕</button>
            </div>
        `;

        // Add drag events
        taskElement.addEventListener('dragstart', (e) => this.handleDragStart(e, task));
        taskElement.addEventListener('dragend', (e) => this.handleDragEnd(e));

        // Add touch events for mobile
        taskElement.addEventListener('touchstart', (e) => this.handleTaskTouchStart(e, task), { passive: false });
        taskElement.addEventListener('touchmove', (e) => this.handleTaskTouchMove(e), { passive: false });
        taskElement.addEventListener('touchend', (e) => this.handleTaskTouchEnd(e), { passive: false });

        // Add click event for task details
        taskElement.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions')) {
                this.showTaskDetails(task);
            }
        });

        this.elements.taskZones[task.quadrant].appendChild(taskElement);
        this.updateQuadrantCount(task.quadrant);
        this.applyFilterToElement(taskElement, task);
        this.updateEmptyStates(this.isFilterActive());
    }

    applyFilters() {
        Object.values(this.elements.taskZones).forEach(zone => {
            if (!zone) return;
            zone.querySelectorAll('.task-item').forEach(element => this.applyFilterToElement(element));
        });
        this.updateEmptyStates(this.isFilterActive());
    }

    applyFilterToElement(element, task = null) {
        if (!element) return;
        const taskId = parseInt(element.dataset.taskId, 10);
        const taskData = task || this.tasks.find(t => t.id === taskId);
        if (!taskData) {
            element.classList.remove('hidden-by-filter');
            return;
        }

        const haystack = `${taskData.title} ${taskData.description || ''}`.toLowerCase();
        const matchesSearch = !this.filters.search || haystack.includes(this.filters.search);
        const matchesQuadrant = this.filters.quadrant === 'all' || taskData.quadrant === this.filters.quadrant;
        const visible = matchesSearch && matchesQuadrant;

        element.classList.toggle('hidden-by-filter', !visible);
    }

    updateEmptyStates(isFiltered = false) {
        Object.entries(this.elements.taskZones).forEach(([quadrant, zone]) => {
            if (!zone) return;
            const visibleItems = Array.from(zone.querySelectorAll('.task-item')).filter(item => !item.classList.contains('hidden-by-filter'));
            const hasVisible = visibleItems.length > 0;
            zone.classList.toggle('empty', !hasVisible);
            if (!hasVisible) {
                zone.dataset.emptyState = isFiltered ? 'No matching tasks' : `No tasks in ${this.getQuadrantShortName(quadrant)}`;
            } else {
                zone.dataset.emptyState = '';
            }
        });
    }

    isFilterActive() {
        return Boolean((this.filters.search && this.filters.search.length > 0) || (this.filters.quadrant && this.filters.quadrant !== 'all'));
    }

    logInsight(message) {
        if (!message) return;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.insights.unshift(`[${timestamp}] ${message}`);
        if (this.insights.length > 8) {
            this.insights = this.insights.slice(0, 8);
        }
        this.renderInsights();
    }

    renderInsights() {
        if (!this.elements.insightLog) return;
        if (!this.insights.length) {
            this.elements.insightLog.innerHTML = '<li>No insights yet. Actions you take will appear here.</li>';
            return;
        }
        this.elements.insightLog.innerHTML = this.insights.map(item => `<li>${item}</li>`).join('');
    }

    handleDragStart(e, task) {
        this.draggedTask = task;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
        // Remove drag-over class from all quadrants
        document.querySelectorAll('.quadrant').forEach(q => q.classList.remove('drag-over'));
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.target.closest('.quadrant').classList.add('drag-over');
    }

    handleDragLeave(e) {
        if (!e.target.closest('.quadrant').contains(e.relatedTarget)) {
            e.target.closest('.quadrant').classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const quadrant = e.target.closest('.task-zone');
        const quadrantType = quadrant.id.replace('-zone', '');
        
        if (this.draggedTask && this.draggedTask.quadrant !== quadrantType) {
            this.moveTask(this.draggedTask.id, quadrantType);
        }
        
        e.target.closest('.quadrant').classList.remove('drag-over');
    }

    moveTask(taskId, newQuadrant) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const oldQuadrant = task.quadrant;
        task.quadrant = newQuadrant;
        task.priority = this.calculatePriority(newQuadrant);

        // Remove from old position
        const oldElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (oldElement) oldElement.remove();

        // Add to new position
        this.renderTask(task);
        
        this.updateQuadrantCount(oldQuadrant);
        this.updateQuadrantCount(newQuadrant);
        this.saveData();
        this.updateStats();
        
        this.showNotification(`Task moved to ${this.getQuadrantName(newQuadrant)}`, 'success');
        this.logInsight(`Moved task "${task.title}" to ${this.getQuadrantShortName(newQuadrant)}`);
        this.applyFilters();
    }

    completeTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = this.tasks[taskIndex];
        task.completedAt = new Date().toISOString();
        
        this.completedTasks.push(task);
        this.tasks.splice(taskIndex, 1);

        // Remove from DOM
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) taskElement.remove();

        this.updateQuadrantCount(task.quadrant);
        this.renderCompletedTasks();
        this.saveData();
        this.updateStats();
        this.showNotification('Task completed! 🎉', 'success');
        this.logInsight(`Completed task "${task.title}"`);
        this.applyFilters();
    }

    deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = this.tasks[taskIndex];
        this.tasks.splice(taskIndex, 1);

        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) taskElement.remove();

        this.updateQuadrantCount(task.quadrant);
        this.saveData();
        this.updateStats();
        this.showNotification('Task deleted', 'info');
        this.logInsight(`Deleted task "${task.title}"`);
        this.applyFilters();
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle && newTitle.trim()) {
            task.title = newTitle.trim();
            
            const newDescription = prompt('Edit task description:', task.description || '');
            task.description = newDescription ? newDescription.trim() : '';

            // Re-render task
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) taskElement.remove();
            this.renderTask(task);

            this.saveData();
            this.showNotification('Task updated!', 'success');
            this.logInsight(`Updated task "${task.title}"`);
        }
    }

    showTaskDetails(task) {
        const quadrantInfo = this.getQuadrantInfo(task.quadrant);
        const createdDate = new Date(task.createdAt).toLocaleDateString();
        
        this.elements.modalBody.innerHTML = `
            <p><strong>Title:</strong> ${task.title}</p>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            <p><strong>Category:</strong> ${quadrantInfo.display}</p>
            ${task.dueDate ? `<p><strong>Time Limit:</strong> ${new Date(task.dueDate).toLocaleString()}</p>` : ''}
            <p><strong>Importance:</strong> ${task.importance === 'not-important' ? 'Not Important' : 'Important'}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p><strong>Created:</strong> ${createdDate}</p>
        `;
        
        this.elements.modal.style.display = 'block';
    }

    closeModal() {
        this.elements.modal.style.display = 'none';
    }

    switchTab(tabName) {
        // Update tab buttons
        this.elements.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        if (tabName === 'completed') {
            this.renderCompletedTasks();
        } else if (tabName === 'analytics') {
            this.updateAnalytics();
        }
    }

    renderCompletedTasks() {
        const container = this.elements.completedTasks;
        container.innerHTML = '';

        if (this.completedTasks.length === 0) {
            container.innerHTML = '<p>No completed tasks yet. Start completing some tasks!</p>';
            return;
        }

        this.completedTasks
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'completed-task ' + task.quadrant;
                const quadrantInfo = this.getQuadrantInfo(task.quadrant);
                taskElement.innerHTML = `
                    <div class="completed-task-header">
                        <span class="quadrant-badge ${task.quadrant}">${quadrantInfo.short}</span>
                        <span class="completed-task-date">${new Date(task.completedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="completed-task-title">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                `;
                container.appendChild(taskElement);
            });
    }

    // Removed local file loader & external open for simplified UI

    startDeadlineChecker() {
        // Check for urgent deadlines every 30 seconds
        this.deadlineInterval = setInterval(() => {
            this.checkUrgentDeadlines();
        }, 30000);
        
        // Also check immediately
        setTimeout(() => this.checkUrgentDeadlines(), 2000);
    }

    checkUrgentDeadlines() {
        const urgentTasks = this.tasks.filter(task => {
            if (task.quadrant !== 'urgent-important' || !task.dueDate) return false;
            
            const due = new Date(task.dueDate).getTime();
            const now = Date.now();
            const diffHours = (due - now) / 3600000;
            
            // Show alert if due within 2 hours and not snoozed recently
            return diffHours <= 2 && diffHours > -1 && !this.isTaskSnoozed(task.id);
        });

        if (urgentTasks.length > 0 && !this.elements.deadlinePopup.classList.contains('visible')) {
            this.showDeadlineAlert(urgentTasks);
        }
    }

    showDeadlineAlert(urgentTasks) {
        if (!this.elements.deadlinePopup || !this.elements.deadlinePopupBody) return;

        let content = '';
        urgentTasks.forEach(task => {
            const due = new Date(task.dueDate);
            const now = new Date();
            const diffMs = due.getTime() - now.getTime();
            const diffHours = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor((diffMs % 3600000) / 60000);
            
            let timeText = '';
            if (diffMs < 0) {
                timeText = 'OVERDUE!';
            } else if (diffHours < 1) {
                timeText = `Due in ${diffMins} minutes`;
            } else {
                timeText = `Due in ${diffHours}h ${diffMins}m`;
            }

            content += `
                <div class="deadline-task-item" data-task-id="${task.id}">
                    <div class="deadline-task-title">${task.title}</div>
                    <div class="deadline-task-time">${timeText}</div>
                </div>
            `;
        });

        this.elements.deadlinePopupBody.innerHTML = content;
        this.elements.deadlinePopup.classList.remove('hidden');
        this.elements.deadlinePopup.classList.add('visible');
    }

    hideDeadlinePopup() {
        if (this.elements.deadlinePopup) {
            this.elements.deadlinePopup.classList.add('hidden');
            this.elements.deadlinePopup.classList.remove('visible');
        }
    }

    snoozeDeadlineAlert() {
        // Snooze all currently visible tasks for 15 minutes
        const taskElements = this.elements.deadlinePopupBody.querySelectorAll('.deadline-task-item');
        taskElements.forEach(el => {
            const taskId = parseInt(el.dataset.taskId);
            this.snoozeTask(taskId, 15); // 15 minutes
        });
        
        this.hideDeadlinePopup();
        this.showNotification('Deadline alerts snoozed for 15 minutes', 'info');
    }

    dismissDeadlineAlert() {
        this.hideDeadlinePopup();
    }

    snoozeTask(taskId, minutes) {
        if (!this.snoozedTasks) this.snoozedTasks = {};
        const snoozeUntil = Date.now() + (minutes * 60 * 1000);
        this.snoozedTasks[taskId] = snoozeUntil;
        
        // Clean up expired snoozes
        this.cleanupSnoozes();
    }

    isTaskSnoozed(taskId) {
        if (!this.snoozedTasks) return false;
        const snoozeTime = this.snoozedTasks[taskId];
        if (!snoozeTime) return false;
        
        if (Date.now() > snoozeTime) {
            delete this.snoozedTasks[taskId];
            return false;
        }
        return true;
    }

    cleanupSnoozes() {
        if (!this.snoozedTasks) return;
        const now = Date.now();
        Object.keys(this.snoozedTasks).forEach(taskId => {
            if (now > this.snoozedTasks[taskId]) {
                delete this.snoozedTasks[taskId];
            }
        });
    }

    updateAnalytics() {
        const totalTasks = this.tasks.length + this.completedTasks.length;
        const completionRatio = totalTasks > 0 ? Math.round((this.completedTasks.length / totalTasks) * 100) : 0;

        if (this.elements.productivityScore) {
            this.elements.productivityScore.textContent = `${completionRatio}%`;
        }
        this.updateProgressRing(completionRatio);

        const quadrantCounts = this.getQuadrantCounts();
        const maxQuadrant = Object.entries(quadrantCounts)
            .reduce((max, [quadrant, count]) => (count > max.count ? { quadrant, count } : max), { quadrant: null, count: 0 });

        if (this.elements.focusAreas) {
            this.elements.focusAreas.textContent = maxQuadrant.count > 0
                ? `Primary focus: ${this.getQuadrantDisplayName(maxQuadrant.quadrant)}`
                : 'No focus area data yet';
        }

        this.updateActiveQuadrant(quadrantCounts, maxQuadrant);
        this.updateDistribution(quadrantCounts);
    }

    updateProgressRing(percent) {
        if (!this.elements.progressRingPath) return;
        const normalized = Math.max(0, Math.min(100, percent));
        this.elements.progressRingPath.style.strokeDasharray = `${normalized}, 100`;
    }

    updateDistribution(quadrantCounts) {
        if (!this.elements.distributionBars || !this.elements.distributionBars.length) return;
        const total = Object.values(quadrantCounts).reduce((sum, count) => sum + count, 0);
        this.elements.distributionBars.forEach(bar => {
            const quadrant = bar.dataset.quadrant;
            const count = quadrantCounts[quadrant] || 0;
            const percent = total ? Math.round((count / total) * 100) : 0;
            bar.style.width = `${percent}%`;
            bar.textContent = percent ? `${percent}%` : '0%';
        });
    }

    updateActiveQuadrant(quadrantCounts, maxQuadrant = null) {
        if (!this.elements.activeQuadrant) return;
        const resolved = maxQuadrant || Object.entries(quadrantCounts)
            .reduce((max, [quadrant, count]) => (count > max.count ? { quadrant, count } : max), { quadrant: null, count: 0 });
        if (resolved.count > 0 && resolved.quadrant) {
            this.elements.activeQuadrant.textContent = this.getQuadrantShortName(resolved.quadrant);
        } else {
            this.elements.activeQuadrant.textContent = '—';
        }
    }

    getQuadrantCounts() {
        const counts = {
            'urgent-important': 0,
            'not-urgent-important': 0,
            'urgent-not-important': 0,
            'not-urgent-not-important': 0
        };

        this.tasks.forEach(task => {
            counts[task.quadrant]++;
        });

        return counts;
    }

    updateQuadrantCount(quadrant) {
        const count = this.tasks.filter(t => t.quadrant === quadrant).length;
        const quadrantElement = document.querySelector(`[data-quadrant="${quadrant}"] .task-count`);
        if (quadrantElement) {
            quadrantElement.textContent = count;
        }
    }

    updateStats() {
        this.elements.totalTasks.textContent = this.tasks.length;
        this.elements.completedCount.textContent = this.completedTasks.length;

        // Update all quadrant counts
        Object.keys(this.elements.taskZones).forEach(quadrant => {
            this.updateQuadrantCount(quadrant);
        });

        this.updateAnalytics();
    }

    calculatePriority(quadrant) {
        const priorities = {
            'urgent-important': 'Critical',
            'not-urgent-important': 'High',
            'urgent-not-important': 'Medium',
            'not-urgent-not-important': 'Low'
        };
        return priorities[quadrant] || 'Medium';
    }

    getQuadrantInfo(quadrant) {
        const mapping = {
            'urgent-important': { display: 'Do First (Urgent + Important)', short: 'Do First' },
            'not-urgent-important': { display: 'Schedule (Not Urgent + Important)', short: 'Schedule' },
            'urgent-not-important': { display: 'Delegate (Urgent + Not Important)', short: 'Delegate' },
            'not-urgent-not-important': { display: 'Eliminate (Not Urgent + Not Important)', short: 'Eliminate' }
        };
        return mapping[quadrant] || { display: 'Unknown Quadrant', short: 'Unknown' };
    }

    getQuadrantDisplayName(quadrant) {
        return this.getQuadrantInfo(quadrant).display;
    }

    getQuadrantShortName(quadrant) {
        return this.getQuadrantInfo(quadrant).short;
    }

    clearInputs() {
        this.elements.newTaskInput.value = '';
        this.elements.taskDescription.value = '';
    if (this.elements.dueDateInput) this.elements.dueDateInput.value = '';
    if (this.elements.importanceSelect) this.elements.importanceSelect.value = 'important';
    }

    clearAllTasks() {
        if (!confirm('Are you sure you want to clear all tasks? This cannot be undone.')) return;

        this.tasks = [];
        Object.values(this.elements.taskZones).forEach(zone => {
            zone.innerHTML = '';
        });

        this.saveData();
        this.updateStats();
        this.showNotification('All tasks cleared', 'info');
        this.logInsight('Cleared all tasks');
        this.applyFilters();
    }

    deriveQuadrant(dueDateValue, importanceValue) {
        // Determine urgency: if due within 24h => urgent; within 72h => moderately urgent; else not urgent.
        let urgent = true;
        if (dueDateValue) {
            const due = new Date(dueDateValue).getTime();
            const now = Date.now();
            const diffHrs = (due - now) / 3600000;
            if (diffHrs > 72) urgent = false; else urgent = true;
        } else {
            // No due date -> treat as not urgent
            urgent = false;
        }
        const important = importanceValue !== 'not-important';
        if (urgent && important) return 'urgent-important';
        if (!urgent && important) return 'not-urgent-important';
        if (urgent && !important) return 'urgent-not-important';
        return 'not-urgent-not-important';
    }

    recalculateUrgency() {
        this.tasks.forEach(task => {
            const newQuadrant = this.deriveQuadrant(task.dueDate, task.importance);
            if (newQuadrant !== task.quadrant) {
                task.quadrant = newQuadrant;
            }
        });
        // Re-render all tasks
        Object.values(this.elements.taskZones).forEach(zone => zone.innerHTML = '');
        this.tasks.forEach(task => this.renderTask(task));
        this.updateStats();
        this.saveData();
        this.showNotification('Urgency recalculated based on current time limits.', 'info');
        this.logInsight('Recalculated task urgency');
        this.applyFilters();
    }

    showNotification(message, type = 'info') {
        // Create a simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 8px;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    saveData() {
        const data = {
            tasks: this.tasks,
            completedTasks: this.completedTasks,
            taskIdCounter: this.taskIdCounter
        };
        localStorage.setItem('eisenhowerMatrixData', JSON.stringify(data));
        
        // Trigger sync if available
        if (window.taskSync) {
            taskSync.onDataChange();
        }
    }

    loadData() {
        const data = JSON.parse(localStorage.getItem('eisenhowerMatrixData'));
        if (data) {
            this.tasks = data.tasks || [];
            this.completedTasks = data.completedTasks || [];
            this.taskIdCounter = data.taskIdCounter || 1;

            // Render existing tasks
            this.tasks.forEach(task => this.renderTask(task));
            this.renderCompletedTasks();
            this.applyFilters();
            this.updateStats();
        }
    }

    // Touch event handlers for mobile support
    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchTarget = e.target.closest('.task-item');
        
        if (this.touchTarget) {
            this.touchTarget.classList.add('touch-active');
        }
    }

    handleTouchMove(e) {
        if (!this.touchTarget) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        
        // If significant movement, show visual feedback
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            this.touchTarget.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            this.touchTarget.classList.add('touch-dragging');
        }
    }

    handleTouchEnd(e) {
        if (!this.touchTarget) return;
        
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetZone = element?.closest('.task-zone');
        
        // Reset visual state
        this.touchTarget.style.transform = '';
        this.touchTarget.classList.remove('touch-active', 'touch-dragging');
        
        if (targetZone) {
            const targetQuadrant = targetZone.id.replace('-zone', '');
            const taskElement = this.touchTarget;
            const taskId = parseInt(taskElement.dataset.taskId);
            const task = this.tasks.find(t => t.id === taskId);
            
            if (task && task.quadrant !== targetQuadrant) {
                this.moveTask(task.id, targetQuadrant);
            }
        }
        
        this.touchTarget = null;
    }

    getQuadrantName(quadrant) {
        const names = {
            'urgent-important': 'Do First',
            'not-urgent-important': 'Schedule',
            'urgent-not-important': 'Delegate',
            'not-urgent-not-important': 'Eliminate'
        };
        return names[quadrant] || quadrant;
    }

    // Task-specific touch handlers
    handleTaskTouchStart(e, task) {
        if (e.target.closest('.task-actions')) return; // Don't interfere with buttons
        
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchTarget = e.currentTarget;
        this.touchTask = task;
        
        this.touchTarget.classList.add('touch-active');
    }

    handleTaskTouchMove(e) {
        if (!this.touchTarget || e.target.closest('.task-actions')) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        
        // If significant movement, show visual feedback
        if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
            this.touchTarget.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            this.touchTarget.classList.add('touch-dragging');
            
            // Highlight drop zones
            document.querySelectorAll('.task-zone').forEach(zone => {
                zone.classList.add('drop-hint');
            });
        }
    }

    handleTaskTouchEnd(e) {
        if (!this.touchTarget) return;
        
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetZone = element?.closest('.task-zone');
        
        // Reset visual state
        this.touchTarget.style.transform = '';
        this.touchTarget.classList.remove('touch-active', 'touch-dragging');
        
        // Remove drop hints
        document.querySelectorAll('.task-zone').forEach(zone => {
            zone.classList.remove('drop-hint');
        });
        
        if (targetZone && this.touchTask) {
            const targetQuadrant = targetZone.id.replace('-zone', '');
            
            if (this.touchTask.quadrant !== targetQuadrant) {
                this.moveTask(this.touchTask.id, targetQuadrant);
            }
        }
        
        this.touchTarget = null;
        this.touchTask = null;
    }

    async setupSync() {
        if (window.taskSync) {
            const success = await taskSync.setupGitHubSync();
            if (success) {
                document.getElementById('setup-sync-btn').textContent = '✅ Sync Enabled';
                document.getElementById('setup-sync-btn').disabled = true;
                this.showNotification('Cross-device sync enabled! Your tasks will now sync between devices.', 'success');
            }
        }
    }
}

// Initialize the application
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});
