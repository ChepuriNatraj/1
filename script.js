class TaskManager {
    constructor() {
        this.tasks = [];
        this.completedTasks = [];
        this.draggedTask = null;
        this.taskIdCounter = 1;
        
        this.initializeElements();
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
            totalTasks: document.getElementById('total-tasks'),
            completedCount: document.getElementById('completed-count'),
            productivityScore: document.getElementById('productivity-score'),
            focusAreas: document.getElementById('focus-areas'),
            completedTasks: document.getElementById('completed-tasks'),
            modal: document.getElementById('task-modal'),
            modalBody: document.getElementById('modal-body'),
            closeModal: document.querySelector('.close'),
            tabButtons: document.querySelectorAll('.tab-button'),
            resourceLinks: document.querySelectorAll('.resource-link'),
            resourceFrame: document.getElementById('resource-frame'),
            resourceStatus: document.getElementById('resource-status'),
            deadlinePopup: document.getElementById('deadline-popup'),
            deadlinePopupBody: document.getElementById('deadline-popup-body'),
            deadlineClose: document.getElementById('deadline-close'),
            deadlineSnooze: document.getElementById('deadline-snooze'),
            deadlineDismiss: document.getElementById('deadline-dismiss'),
            taskZones: {
                'urgent-important': document.getElementById('urgent-important-zone'),
                'not-urgent-important': document.getElementById('not-urgent-important-zone'),
                'urgent-not-important': document.getElementById('urgent-not-important-zone'),
                'not-urgent-not-important': document.getElementById('not-urgent-not-important-zone')
            }
        };
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

        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // Resource link handlers (embedded and external)
        this.elements.resourceLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (link.dataset.url) {
                    // External URL - open in new tab
                    try {
                        window.open('file:///' + link.dataset.url.replace(/\\/g, '/'), '_blank');
                    } catch (err) {
                        this.showNotification('Unable to open external resource.', 'error');
                    }
                } else {
                    // Local file - embed in iframe
                    const file = link.dataset.file;
                    if (file === 'Deadlines.html') {
                        this.loadResource(file);
                    }
                }
            });
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
        });
    }

    addTask() {
        const title = this.elements.newTaskInput.value.trim();
        const description = this.elements.taskDescription.value.trim();

        if (!title) {
            this.showNotification('Please enter a task title', 'error');
            return;
        }

        const task = {
            id: this.taskIdCounter++,
            title,
            description,
            dueDate: this.elements.dueDateInput?.value || null,
            importance: this.elements.importanceSelect?.value || 'important',
            quadrant: this.deriveQuadrant(this.elements.dueDateInput?.value, this.elements.importanceSelect?.value),
            createdAt: new Date().toISOString(),
            priority: this.calculatePriority('urgent-important')
        };

        this.tasks.push(task);
        this.renderTask(task);
        this.clearInputs();
        this.saveData();
        this.updateStats();
        this.showNotification('Task added successfully!', 'success');
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

        // Add click event for task details
        taskElement.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions')) {
                this.showTaskDetails(task);
            }
        });

        this.elements.taskZones[task.quadrant].appendChild(taskElement);
        this.updateQuadrantCount(task.quadrant);
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
        }
    }

    showTaskDetails(task) {
        const quadrantName = this.getQuadrantName(task.quadrant);
        const createdDate = new Date(task.createdAt).toLocaleDateString();
        
        this.elements.modalBody.innerHTML = `
            <p><strong>Title:</strong> ${task.title}</p>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            <p><strong>Category:</strong> ${quadrantName}</p>
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
        } else if (tabName === 'resources') {
            // Ensure iframe sizing recalculates (some browsers need a redraw)
            if (this.elements.resourceFrame) {
                setTimeout(() => {
                    this.elements.resourceFrame.style.display = 'block';
                }, 0);
            }
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
                const quadrantName = this.getQuadrantName(task.quadrant);
                taskElement.innerHTML = `
                    <div class="completed-task-header">
                        <span class="quadrant-badge ${task.quadrant}">${quadrantName.split('(')[0].trim()}</span>
                        <span class="completed-task-date">${new Date(task.completedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="completed-task-title">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                `;
                container.appendChild(taskElement);
            });
    }

    loadResource(fileName) {
        if (!this.elements.resourceFrame) return;
        // Provide feedback
        if (this.elements.resourceStatus) {
            this.elements.resourceStatus.textContent = 'Loading ' + fileName + ' ...';
        }

        // Basic existence heuristic: try fetch (works for same-folder files when served via http). If running via file://, fetch may be blocked; fallback to setting src directly.
        const setFrame = () => {
            this.elements.resourceFrame.src = fileName;
            if (this.elements.resourceStatus) {
                this.elements.resourceStatus.textContent = 'Showing: ' + fileName;
            }
        };

        try {
            if (location.protocol.startsWith('http')) {
                fetch(fileName, { method: 'HEAD' })
                    .then(resp => {
                        if (!resp.ok) throw new Error();
                        setFrame();
                    })
                    .catch(() => {
                        setFrame();
                    });
            } else {
                // file:// context
                setFrame();
            }
        } catch (e) {
            setFrame();
        }
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
        const completedPercentage = totalTasks > 0 ? Math.round((this.completedTasks.length / totalTasks) * 100) : 0;
        
        this.elements.productivityScore.textContent = `${completedPercentage}%`;

        // Calculate focus areas
        const quadrantCounts = this.getQuadrantCounts();
        const maxQuadrant = Object.entries(quadrantCounts)
            .reduce((max, [quadrant, count]) => count > max.count ? {quadrant, count} : max, {count: 0});

        if (maxQuadrant.count > 0) {
            this.elements.focusAreas.textContent = `Most tasks in: ${this.getQuadrantName(maxQuadrant.quadrant)}`;
        } else {
            this.elements.focusAreas.textContent = 'No focus area data yet';
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

    getQuadrantName(quadrant) {
        const names = {
            'urgent-important': 'Do First (Urgent + Important)',
            'not-urgent-important': 'Schedule (Important)',
            'urgent-not-important': 'Delegate (Urgent)',
            'not-urgent-not-important': 'Eliminate (Neither)'
        };
        return names[quadrant] || 'Unknown';
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
    }

    loadData() {
        const data = JSON.parse(localStorage.getItem('eisenhowerMatrixData'));
        if (data) {
            this.tasks = data.tasks || [];
            this.completedTasks = data.completedTasks || [];
            this.taskIdCounter = data.taskIdCounter || 1;

            // Render existing tasks
            this.tasks.forEach(task => this.renderTask(task));
        }
    }
}

// Initialize the application
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});
