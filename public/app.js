// MeowSpeechKit-A Frontend Application

// Constants for timing calculations
const MS_PER_WORD = 400; // Average speaking rate: 150 words/min = 400ms/word
const MIN_PHRASE_DURATION_MS = 300; // Minimum duration per phrase
const SECONDS_TO_MS_THRESHOLD = 100; // If duration < 100, assume it's in seconds

class MeowSpeechKit {
    constructor() {
        this.currentUser = null;
        this.currentProject = null;
        this.segments = [];
        this.currentSegmentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.timerInterval = null;
        this.playbackInterval = null;
        this.elapsedMs = 0;
        this.countdownSeconds = 10;
        this.playbackSpeed = 1.0;
        this.candidateLines = 2;
        this.fontSize = 48;
        this.isDarkMode = false;
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        await this.checkAuthStatus();
        await this.loadSystemPrompt();
    }
    
    bindEvents() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
        });
        
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
        
        // Logout buttons
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('projects-logout-btn').addEventListener('click', () => this.handleLogout());
        
        // Projects section
        document.getElementById('new-project-btn').addEventListener('click', () => this.createNewProject());
        document.getElementById('back-to-projects-btn').addEventListener('click', () => this.showProjectsSection());
        document.getElementById('save-project-btn').addEventListener('click', () => this.saveCurrentProject());
        
        // Process button
        document.getElementById('process-btn').addEventListener('click', () => this.processText());
        
        // Play button
        document.getElementById('play-btn').addEventListener('click', () => this.startTeleprompter());
        
        // Teleprompter controls
        document.getElementById('font-size').addEventListener('input', (e) => this.updateFontSize(e.target.value));
        document.getElementById('speed').addEventListener('input', (e) => this.updateSpeed(e.target.value));
        document.getElementById('candidate-lines').addEventListener('input', (e) => this.updateCandidateLines(e.target.value));
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('exit-btn').addEventListener('click', () => this.exitTeleprompter());
        
        // Keyboard shortcuts for teleprompter
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    }
    
    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.username;
                this.showProjectsSection();
            } else {
                errorEl.textContent = data.error;
            }
        } catch (error) {
            errorEl.textContent = 'Login failed. Please try again.';
        }
    }
    
    async handleRegister() {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorEl = document.getElementById('register-error');
        
        if (password !== confirm) {
            errorEl.textContent = 'Passwords do not match.';
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.username;
                this.showProjectsSection();
            } else {
                errorEl.textContent = data.error;
            }
        } catch (error) {
            errorEl.textContent = 'Registration failed. Please try again.';
        }
    }
    
    async handleLogout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.currentProject = null;
            this.showAuthSection();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data.username;
                this.showProjectsSection();
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            this.showAuthSection();
        }
    }
    
    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('projects-section').classList.add('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
    }
    
    async showProjectsSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('projects-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
        
        document.getElementById('projects-user-info').textContent = `Welcome, ${this.currentUser}`;
        
        await this.loadProjects();
        await this.updateProjectsRateLimitInfo();
    }
    
    async loadProjects() {
        const listEl = document.getElementById('projects-list');
        listEl.innerHTML = '<p class="placeholder-text">Loading projects...</p>';
        
        try {
            const response = await fetch('/api/scripts');
            const projects = await response.json();
            
            if (projects.length === 0) {
                listEl.innerHTML = '<p class="placeholder-text">No projects yet. Create your first project!</p>';
            } else {
                listEl.innerHTML = projects.map(p => `
                    <div class="project-item" data-id="${p.id}">
                        <div class="project-info">
                            <h3>${this.escapeHtml(p.title)}</h3>
                            <p>Created: ${new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="project-actions">
                            <button class="btn btn-primary btn-small project-open-btn" data-project-id="${p.id}">Open</button>
                            <button class="btn btn-danger btn-small project-delete-btn" data-project-id="${p.id}">Delete</button>
                        </div>
                    </div>
                `).join('');
                
                // Add event listeners using event delegation
                listEl.querySelectorAll('.project-open-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openProject(btn.dataset.projectId);
                    });
                });
                
                listEl.querySelectorAll('.project-delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteProject(btn.dataset.projectId);
                    });
                });
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
            listEl.innerHTML = '<p class="placeholder-text">Failed to load projects</p>';
        }
    }
    
    async updateProjectsRateLimitInfo() {
        try {
            const response = await fetch('/api/rate-limit');
            const data = await response.json();
            
            document.getElementById('projects-rate-limit-info').textContent = 
                `AI calls: ${data.used}/${data.limit} (${data.remaining} remaining)`;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
        }
    }
    
    createNewProject() {
        this.currentProject = {
            id: null,
            title: 'New Project',
            content: '',
            segments: []
        };
        this.segments = [];
        this.showMainSection();
        
        document.getElementById('script-title').value = '';
        document.getElementById('script-content').value = '';
        document.getElementById('segments-preview').innerHTML = '<p class="placeholder-text">Process your script to see segments here</p>';
        document.getElementById('play-btn').disabled = true;
    }
    
    async openProject(id) {
        try {
            const response = await fetch(`/api/scripts/${id}`);
            const project = await response.json();
            
            this.currentProject = project;
            this.segments = project.segments || [];
            this.showMainSection();
            
            document.getElementById('script-title').value = project.title;
            document.getElementById('script-content').value = project.content;
            
            if (this.segments.length > 0) {
                this.displaySegments();
                document.getElementById('play-btn').disabled = false;
            }
        } catch (error) {
            console.error('Failed to open project:', error);
            alert('Failed to open project');
        }
    }
    
    async deleteProject(id) {
        if (!confirm('Are you sure you want to delete this project?')) return;
        
        try {
            const response = await fetch(`/api/scripts/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await this.loadProjects();
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    }
    
    async saveCurrentProject() {
        const title = document.getElementById('script-title').value || 'Untitled';
        const content = document.getElementById('script-content').value;
        
        try {
            const response = await fetch('/api/scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: this.currentProject?.id,
                    title,
                    content,
                    segments: this.segments
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject = { ...this.currentProject, id: data.id, title, content };
                alert('Project saved successfully!');
            }
        } catch (error) {
            console.error('Failed to save project:', error);
            alert('Failed to save project');
        }
    }
    
    async showMainSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('projects-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
        
        document.getElementById('user-info').textContent = `Welcome, ${this.currentUser}`;
        document.getElementById('current-project-name').textContent = 
            `Project: ${this.currentProject?.title || 'New Project'}`;
        
        await this.loadModels();
        await this.updateRateLimitInfo();
    }
    
    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            
            const select = document.getElementById('model-select');
            select.innerHTML = '';
            
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                if (model.id === data.defaultModel) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }
    
    async loadSystemPrompt() {
        try {
            const response = await fetch('/api/system-prompt');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('system-prompt-display').textContent = data.systemPrompt;
            }
        } catch (error) {
            console.error('Failed to load system prompt:', error);
        }
    }
    
    async updateRateLimitInfo() {
        try {
            const response = await fetch('/api/rate-limit');
            const data = await response.json();
            
            document.getElementById('rate-limit-info').textContent = 
                `AI calls: ${data.used}/${data.limit} (${data.remaining} remaining)`;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
        }
    }
    
    async processText() {
        const content = document.getElementById('script-content').value.trim();
        const targetDuration = document.getElementById('target-duration').value;
        const modelId = document.getElementById('model-select').value;
        
        if (!content) {
            alert('Please enter some text to process.');
            return;
        }
        
        const statusEl = document.getElementById('processing-status');
        const progressFill = statusEl.querySelector('.progress-fill');
        const processingText = document.getElementById('processing-text');
        
        statusEl.classList.remove('hidden');
        progressFill.style.width = '10%';
        processingText.textContent = 'Connecting to AI...';
        
        document.getElementById('process-btn').disabled = true;
        
        try {
            const response = await fetch('/api/process-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: content, modelId, targetDuration: parseInt(targetDuration) || null })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let progress = 10;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.progress) {
                                fullContent += data.content;
                                progress = Math.min(progress + 2, 90);
                                progressFill.style.width = `${progress}%`;
                                processingText.textContent = 'Processing with AI...';
                            }
                            
                            if (data.done) {
                                progressFill.style.width = '100%';
                                processingText.textContent = 'Complete!';
                                
                                // Parse the content
                                const jsonContent = data.content || fullContent;
                                this.parseAndDisplaySegments(jsonContent);
                                
                                setTimeout(() => {
                                    statusEl.classList.add('hidden');
                                }, 1500);
                            }
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            if (e.message !== 'Unexpected end of JSON input') {
                                console.error('Parse error:', e);
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            processingText.textContent = `Error: ${error.message}`;
            progressFill.style.width = '0%';
            
            // Fallback: simple local segmentation
            this.localSegmentation(content, targetDuration);
            
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 3000);
        } finally {
            document.getElementById('process-btn').disabled = false;
            await this.updateRateLimitInfo();
        }
    }
    
    parseAndDisplaySegments(content) {
        try {
            // Try to extract JSON from the content
            let jsonStr = content;
            
            // Look for JSON object in the content
            const jsonMatch = content.match(/\{[\s\S]*"segments"[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            this.segments = parsed.segments || [];
            
            // Convert seconds to milliseconds if needed
            this.segments = this.segments.map(seg => ({
                text: seg.text,
                duration: seg.duration < SECONDS_TO_MS_THRESHOLD ? seg.duration * 1000 : seg.duration
            }));
            
            this.displaySegments();
        } catch (error) {
            console.error('Failed to parse segments:', error);
            // Fallback to local segmentation
            const content = document.getElementById('script-content').value.trim();
            this.localSegmentation(content);
        }
    }
    
    localSegmentation(text, targetDuration) {
        // Split into short phrases (2-3 words each)
        const words = text.split(/\s+/).filter(w => w.trim());
        this.segments = [];
        
        const totalWords = words.length;
        const targetMs = targetDuration ? targetDuration * 1000 : null;
        
        // Calculate milliseconds per word based on speaking rate
        const msPerWord = targetMs ? (targetMs / totalWords) : MS_PER_WORD;
        
        // Group words into phrases of 2-3 words
        let currentPhrase = [];
        let phraseWordLimit = 2; // Start with 2, alternate between 2 and 3
        
        for (let i = 0; i < words.length; i++) {
            currentPhrase.push(words[i]);
            
            // Check if we should end the phrase
            const shouldEnd = currentPhrase.length >= phraseWordLimit ||
                              i === words.length - 1 ||
                              words[i].match(/[.!?。！？,，;；:：]$/);
            
            if (shouldEnd && currentPhrase.length > 0) {
                const phraseText = currentPhrase.join(' ');
                const duration = Math.round(currentPhrase.length * msPerWord);
                
                this.segments.push({
                    text: phraseText,
                    duration: Math.max(MIN_PHRASE_DURATION_MS, duration)
                });
                
                currentPhrase = [];
                // Alternate between 2 and 3 word phrases
                phraseWordLimit = phraseWordLimit === 2 ? 3 : 2;
            }
        }
        
        this.displaySegments();
    }
    
    displaySegments() {
        const previewEl = document.getElementById('segments-preview');
        
        if (this.segments.length === 0) {
            previewEl.innerHTML = '<p class="placeholder-text">No segments generated</p>';
            document.getElementById('play-btn').disabled = true;
            return;
        }
        
        previewEl.innerHTML = this.segments.map((segment, index) => `
            <div class="segment-item" style="animation-delay: ${index * 0.05}s">
                <p class="segment-text">${this.escapeHtml(segment.text)}</p>
                <span class="segment-duration">${segment.duration}ms</span>
            </div>
        `).join('');
        
        document.getElementById('play-btn').disabled = false;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    startTeleprompter() {
        if (this.segments.length === 0) return;
        
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.remove('hidden');
        
        // Request fullscreen
        const teleprompterEl = document.getElementById('teleprompter-section');
        if (teleprompterEl.requestFullscreen) {
            teleprompterEl.requestFullscreen().catch(err => {
                console.log('Fullscreen not available:', err);
            });
        }
        
        this.currentSegmentIndex = 0;
        this.elapsedMs = 0;
        this.countdownSeconds = 10;
        this.isPlaying = true;
        this.isPaused = false;
        
        this.renderTeleprompterContent();
        this.startCountdown();
    }
    
    renderTeleprompterContent() {
        const contentEl = document.getElementById('teleprompter-content');
        const n = this.candidateLines;
        
        let html = '';
        
        // Add spacer divs to ensure first phrase is centered
        const spacerCount = n;
        for (let i = 0; i < spacerCount; i++) {
            html += `<div class="teleprompter-line spacer" style="font-size: ${this.fontSize}px; opacity: 0;">&nbsp;</div>`;
        }
        
        for (let i = 0; i < this.segments.length; i++) {
            const diff = Math.abs(i - this.currentSegmentIndex);
            let className = 'teleprompter-line';
            
            if (i === this.currentSegmentIndex) {
                className += ' current';
            } else if (diff <= n) {
                className += ` adjacent-${diff}`;
            } else {
                className += ' hidden-line';
            }
            
            html += `<div class="${className}" style="font-size: ${this.fontSize}px">${this.escapeHtml(this.segments[i].text)}</div>`;
        }
        
        // Add spacer divs at the end too
        for (let i = 0; i < spacerCount; i++) {
            html += `<div class="teleprompter-line spacer" style="font-size: ${this.fontSize}px; opacity: 0;">&nbsp;</div>`;
        }
        
        contentEl.innerHTML = html;
    }
    
    startCountdown() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'countdown';
        
        this.timerInterval = setInterval(() => {
            if (this.isPaused) return;
            
            if (this.countdownSeconds > 0) {
                timerEl.textContent = this.countdownSeconds;
                this.countdownSeconds--;
            } else {
                // Start actual playback
                clearInterval(this.timerInterval);
                this.startPlayback();
            }
        }, 1000 / this.playbackSpeed);
    }
    
    startPlayback() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'running';
        
        this.updateTimer();
        
        // Start segment timing
        this.scheduleNextSegment();
        
        // Start elapsed timer (update every 100ms for smoother display)
        this.timerInterval = setInterval(() => {
            if (this.isPaused) return;
            this.elapsedMs += 100;
            this.updateTimer();
        }, 100);
    }
    
    scheduleNextSegment() {
        if (!this.isPlaying || this.currentSegmentIndex >= this.segments.length) {
            this.finishPlayback();
            return;
        }
        
        const segment = this.segments[this.currentSegmentIndex];
        // Duration is in milliseconds, adjust for playback speed
        const duration = segment.duration / this.playbackSpeed;
        
        this.playbackInterval = setTimeout(() => {
            if (this.isPaused) {
                // Re-schedule when paused
                this.scheduleNextSegment();
                return;
            }
            
            this.currentSegmentIndex++;
            this.renderTeleprompterContent();
            this.scheduleNextSegment();
        }, duration);
    }
    
    updateTimer() {
        const timerEl = document.getElementById('timer-value');
        const totalSeconds = Math.floor(this.elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((this.elapsedMs % 1000) / 100);
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${ms}`;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        pauseBtn.classList.toggle('btn-success', this.isPaused);
        pauseBtn.classList.toggle('btn-warning', !this.isPaused);
    }
    
    finishPlayback() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        const timerEl = document.getElementById('timer-value');
        timerEl.classList.add('finished');
    }
    
    exitTeleprompter() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.log('Exit fullscreen error:', err);
            });
        }
        
        document.getElementById('teleprompter-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        
        // Reset controls
        document.getElementById('pause-btn').textContent = 'Pause';
        document.getElementById('pause-btn').classList.remove('btn-success');
        document.getElementById('pause-btn').classList.add('btn-warning');
    }
    
    updateFontSize(value) {
        this.fontSize = parseInt(value);
        document.getElementById('font-size-value').textContent = `${value}px`;
        
        if (this.isPlaying) {
            this.renderTeleprompterContent();
        }
    }
    
    updateSpeed(value) {
        this.playbackSpeed = parseFloat(value);
        document.getElementById('speed-value').textContent = `${value}x`;
    }
    
    updateCandidateLines(value) {
        this.candidateLines = parseInt(value);
        document.getElementById('candidate-lines-value').textContent = value;
        
        if (this.isPlaying) {
            this.renderTeleprompterContent();
        }
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        const teleprompterEl = document.getElementById('teleprompter-section');
        teleprompterEl.classList.toggle('dark-mode', this.isDarkMode);
        
        const toggleBtn = document.getElementById('dark-mode-toggle');
        toggleBtn.textContent = this.isDarkMode ? 'On' : 'Off';
        toggleBtn.classList.toggle('active', this.isDarkMode);
    }
    
    handleKeyboard(e) {
        if (!document.getElementById('teleprompter-section').classList.contains('hidden')) {
            switch (e.key) {
                case ' ':
                case 'Space':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case 'Escape':
                    this.exitTeleprompter();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (this.currentSegmentIndex > 0) {
                        this.currentSegmentIndex--;
                        this.renderTeleprompterContent();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (this.currentSegmentIndex < this.segments.length - 1) {
                        this.currentSegmentIndex++;
                        this.renderTeleprompterContent();
                    }
                    break;
                case 'd':
                case 'D':
                    this.toggleDarkMode();
                    break;
            }
        }
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MeowSpeechKit();
});
