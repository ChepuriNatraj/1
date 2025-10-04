// GitHub-based synchronization system
class TaskSync {
    constructor() {
        this.githubOwner = 'ChepuriNatraj';
        this.githubRepo = '1';
        this.dataFile = 'tasks.json';
        this.branch = 'main';
        this.apiBase = 'https://api.github.com';
        
        // Get GitHub token from user (we'll add UI for this)
        this.githubToken = localStorage.getItem('github_token');
        this.lastSyncTime = localStorage.getItem('last_sync_time') || '0';
        this.syncEnabled = !!this.githubToken;
        
        this.setupEventListeners();

        if (this.syncEnabled) {
            this.syncData();
        } else {
            this.updateSyncStatus('offline');
        }
    }

    setupEventListeners() {
        // Auto-sync every 30 seconds if enabled
        if (this.syncEnabled) {
            setInterval(() => this.syncData(), 30000);
        }
        
        // Sync on page focus (when user switches back to app)
        window.addEventListener('focus', () => {
            if (this.syncEnabled) {
                this.syncData();
            }
        });
    }

    async setupGitHubSync() {
        const token = prompt(`To sync tasks across devices, enter your GitHub Personal Access Token:
        
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token with 'repo' permissions
3. Paste it here:

(This will be stored locally and used to sync your tasks)`);
        
        if (token) {
            this.githubToken = token;
            localStorage.setItem('github_token', token);
            this.syncEnabled = true;
            
            // Initial sync
            await this.syncData();
            return true;
        }
        return false;
    }

    async syncData() {
        if (!this.syncEnabled) return;
        if (!this.githubToken) {
            this.syncEnabled = false;
            this.updateSyncStatus('offline');
            return;
        }

        try {
            this.updateSyncStatus('syncing');
            const localData = this.getLocalData();
            const remoteData = await this.getRemoteData();
            
            // Simple merge strategy: use the most recent timestamp
            let mergedData = localData;
            let shouldUpdate = false;
            
            if (remoteData) {
                const remoteTime = new Date(remoteData.lastModified || '1970-01-01').getTime();
                const localTime = new Date(localData.lastModified || '1970-01-01').getTime();
                
                if (remoteTime > localTime) {
                    // Remote is newer, use remote data
                    mergedData = remoteData;
                    shouldUpdate = true;
                    this.updateLocalTasks(remoteData);
                } else if (localTime > remoteTime) {
                    // Local is newer, push to remote
                    await this.pushDataToRemote(localData);
                }
            } else {
                // No remote data, push local data
                await this.pushDataToRemote(localData);
            }
            
            this.lastSyncTime = Date.now().toString();
            localStorage.setItem('last_sync_time', this.lastSyncTime);
            
            this.updateSyncStatus('synced');
            
            if (shouldUpdate) {
                // Notify user about updated tasks
                taskManager.showNotification('Tasks synced from other device', 'success');
            }
            
        } catch (error) {
            console.error('Sync failed:', error);
            this.updateSyncStatus('error');
        }
    }

    async getRemoteData() {
        const url = `${this.apiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${this.dataFile}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.status === 404) {
                return null; // File doesn't exist yet
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const fileData = await response.json();
            const content = atob(fileData.content.replace(/\s/g, ''));
            return JSON.parse(content);
            
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    async pushDataToRemote(data) {
        const url = `${this.apiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${this.dataFile}`;
        
        // Get current file SHA if it exists
        let sha = null;
        try {
            const existingFile = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (existingFile.ok) {
                const fileData = await existingFile.json();
                sha = fileData.sha;
            }
        } catch (error) {
            // File doesn't exist, that's fine
        }
        
        // Prepare data with timestamp
        const dataWithTimestamp = {
            ...data,
            lastModified: new Date().toISOString()
        };
        
        const payload = {
            message: `Update tasks - ${new Date().toLocaleString()}`,
            content: btoa(JSON.stringify(dataWithTimestamp, null, 2)),
            branch: this.branch
        };
        
        if (sha) {
            payload.sha = sha;
        }
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to push data: ${response.status}`);
        }
    }

    getLocalData() {
        const data = JSON.parse(localStorage.getItem('eisenhowerMatrixData') || '{}');
        return {
            tasks: data.tasks || [],
            completedTasks: data.completedTasks || [],
            taskIdCounter: data.taskIdCounter || 1,
            lastModified: localStorage.getItem('last_local_update') || new Date().toISOString()
        };
    }

    updateLocalTasks(remoteData) {
        // Update taskManager with remote data
        if (window.taskManager) {
            taskManager.tasks = remoteData.tasks || [];
            taskManager.completedTasks = remoteData.completedTasks || [];
            taskManager.taskIdCounter = remoteData.taskIdCounter || 1;
            
            // Clear current display
            Object.values(taskManager.elements.taskZones).forEach(zone => {
                zone.innerHTML = '';
            });
            
            // Re-render all tasks
            taskManager.tasks.forEach(task => taskManager.renderTask(task));
            taskManager.updateStats();
        }
        
        // Update localStorage
        localStorage.setItem('eisenhowerMatrixData', JSON.stringify({
            tasks: remoteData.tasks || [],
            completedTasks: remoteData.completedTasks || [],
            taskIdCounter: remoteData.taskIdCounter || 1
        }));
    }

    updateSyncStatus(status) {
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            const icons = {
                syncing: '🔄',
                synced: '✅',
                error: '❌',
                offline: '📱'
            };
            
            const messages = {
                syncing: 'Syncing...',
                synced: 'Synced',
                error: 'Sync failed',
                offline: 'Offline'
            };
            
            statusElement.innerHTML = `${icons[status]} ${messages[status]}`;
            statusElement.className = `sync-status ${status}`;
        }
    }

    // Method to be called when local data changes
    onDataChange() {
        localStorage.setItem('last_local_update', new Date().toISOString());
        
        // Debounced sync (wait 2 seconds after last change)
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            if (this.syncEnabled) {
                this.syncData();
            }
        }, 2000);
    }
}

// Initialize sync system
const taskSync = new TaskSync();