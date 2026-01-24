// MeowSpeechKit-A Frontend Application - 简体中文版

// Constants for timing calculations
const MS_PER_WORD = 400; // Average speaking rate: 150 words/min = 400ms/word
const MIN_PHRASE_DURATION_MS = 300; // Minimum duration per phrase
const SECONDS_TO_MS_THRESHOLD = 100; // If duration < 100, assume it's in seconds
const PAUSE_DURATION_MS = 200; // Natural pause between phrases

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
        this.currentLineY = 50; // Default to center (50%)
        this.controlsVisible = true; // Controls start visible with hint
        this.targetDuration = null;
        this.editingSegmentIndex = null;
        this.isRehearsalTiming = false;
        
        // Rehearsal mode properties
        this.isRehearsalMode = false;
        this.rehearsalTimings = [];
        this.lastSegmentStartTime = 0;
        this.rehearsalElapsedBase = 0;
        
        // Auto-save properties
        this.autoSaveInterval = null;
        this.hasUnsavedChanges = false;
        this.lastSaveTime = null;
        this.isSaving = false;
        
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
        
        // Rehearsal button
        document.getElementById('rehearsal-btn').addEventListener('click', () => this.showRehearsalModal());
        
        // Teleprompter controls
        document.getElementById('font-size').addEventListener('input', (e) => this.updateFontSize(e.target.value));
        document.getElementById('speed').addEventListener('input', (e) => this.updateSpeed(e.target.value));
        document.getElementById('candidate-lines').addEventListener('input', (e) => this.updateCandidateLines(e.target.value));
        document.getElementById('current-line-y').addEventListener('input', (e) => this.updateCurrentLineY(e.target.value));
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('next-word-btn').addEventListener('click', () => this.handleRehearsalNextWord());
        document.getElementById('exit-btn').addEventListener('click', () => this.exitTeleprompter());
        
        // Modal events
        document.getElementById('error-modal-close').addEventListener('click', () => this.closeErrorModal());
        document.getElementById('duration-modal-cancel').addEventListener('click', () => this.closeDurationModal());
        document.getElementById('duration-modal-save').addEventListener('click', () => this.saveDuration());
        
        // Rehearsal modal events
        document.getElementById('rehearsal-modal-cancel').addEventListener('click', () => this.closeRehearsalModal());
        document.getElementById('rehearsal-modal-start').addEventListener('click', () => this.startRehearsalMode());
        document.getElementById('rehearsal-save-btn').addEventListener('click', () => this.saveRehearsalTiming());
        document.getElementById('rehearsal-discard-btn').addEventListener('click', () => this.discardRehearsalTiming());
        
        // Track changes for auto-save
        document.getElementById('script-title').addEventListener('input', () => this.markUnsaved());
        document.getElementById('script-content').addEventListener('input', () => this.markUnsaved());
        document.getElementById('target-duration').addEventListener('input', () => this.markUnsaved());
        
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
                errorEl.textContent = data.error || '登录失败，请重试';
            }
        } catch (error) {
            errorEl.textContent = '登录失败，请重试';
        }
    }
    
    async handleRegister() {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorEl = document.getElementById('register-error');
        
        if (password !== confirm) {
            errorEl.textContent = '两次输入的密码不一致';
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
                errorEl.textContent = data.error || '注册失败，请重试';
            }
        } catch (error) {
            errorEl.textContent = '注册失败，请重试';
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
        this.stopAutoSave();
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('projects-section').classList.add('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
    }
    
    async showProjectsSection() {
        // Save any pending changes before leaving
        if (this.hasUnsavedChanges && this.currentProject) {
            await this.saveCurrentProject(true);
        }
        this.stopAutoSave();
        
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('projects-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
        
        document.getElementById('projects-user-info').textContent = `欢迎，${this.currentUser}`;
        
        await this.loadProjects();
        await this.updateProjectsRateLimitInfo();
    }
    
    async loadProjects() {
        const listEl = document.getElementById('projects-list');
        listEl.innerHTML = '<p class="placeholder-text">正在加载项目...</p>';
        
        try {
            const response = await fetch('/api/scripts');
            const projects = await response.json();
            
            if (projects.length === 0) {
                listEl.innerHTML = '<p class="placeholder-text">暂无项目，请创建您的第一个项目！</p>';
            } else {
                listEl.innerHTML = projects.map(p => `
                    <div class="project-item" data-id="${p.id}">
                        <div class="project-info">
                            <h3>${this.escapeHtml(p.title)}</h3>
                            <p>创建时间：${new Date(p.createdAt).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <div class="project-actions">
                            <button class="btn btn-primary btn-small project-open-btn" data-project-id="${p.id}">打开</button>
                            <button class="btn btn-danger btn-small project-delete-btn" data-project-id="${p.id}">删除</button>
                        </div>
                    </div>
                `).join('');
                
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
            listEl.innerHTML = '<p class="placeholder-text">加载项目失败</p>';
        }
    }
    
    async updateProjectsRateLimitInfo() {
        try {
            const response = await fetch('/api/rate-limit');
            const data = await response.json();
            
            document.getElementById('projects-rate-limit-info').textContent = 
                `AI调用次数：${data.used}/${data.limit}（剩余 ${data.remaining} 次）`;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
        }
    }
    
    createNewProject() {
        this.currentProject = { id: null, title: '新项目', content: '', segments: [], targetDuration: null, isRehearsalTiming: false };
        this.segments = [];
        this.targetDuration = null;
        this.isRehearsalTiming = false;
        this.hasUnsavedChanges = false;
        this.showMainSection();
        
        document.getElementById('script-title').value = '';
        document.getElementById('script-content').value = '';
        document.getElementById('target-duration').value = '';
        document.getElementById('segments-preview').innerHTML = '<p class="placeholder-text">请先进行 AI 分词以查看分段</p>';
        document.getElementById('play-btn').disabled = true;
        document.getElementById('rehearsal-btn').disabled = true;
        document.getElementById('total-duration-info').classList.add('hidden');
        this.updateSaveStatus();
    }
    
    async openProject(id) {
        try {
            const response = await fetch(`/api/scripts/${id}`);
            const project = await response.json();
            
            this.currentProject = project;
            this.segments = project.segments || [];
            this.targetDuration = project.targetDuration || null;
            this.isRehearsalTiming = project.isRehearsalTiming || false;
            this.hasUnsavedChanges = false;
            this.showMainSection();
            
            document.getElementById('script-title').value = project.title || '';
            document.getElementById('script-content').value = project.content || '';
            document.getElementById('target-duration').value = project.targetDuration || '';
            
            if (this.segments.length > 0) {
                this.displaySegments();
                this.calculateAndDisplayTotalDuration();
                document.getElementById('play-btn').disabled = false;
                document.getElementById('rehearsal-btn').disabled = false;
            }
            this.updateSaveStatus();
        } catch (error) {
            console.error('Failed to open project:', error);
            alert('打开项目失败');
        }
    }
    
    async deleteProject(id) {
        if (!confirm('确定要删除这个项目吗？')) return;
        
        try {
            const response = await fetch(`/api/scripts/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await this.loadProjects();
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    }
    
    async saveCurrentProject(isAutoSave = false) {
        if (this.isSaving) return;
        
        const title = document.getElementById('script-title').value || '未命名项目';
        const content = document.getElementById('script-content').value;
        const targetDuration = parseInt(document.getElementById('target-duration').value) || null;
        
        this.isSaving = true;
        this.updateSaveStatus('saving');
        
        try {
            const response = await fetch('/api/scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: this.currentProject?.id,
                    title,
                    content,
                    segments: this.segments,
                    targetDuration,
                    isRehearsalTiming: this.isRehearsalTiming
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject = { ...this.currentProject, id: data.id, title, content, segments: this.segments, targetDuration, isRehearsalTiming: this.isRehearsalTiming };
                document.getElementById('current-project-name').textContent = `项目：${title}`;
                this.hasUnsavedChanges = false;
                this.lastSaveTime = new Date();
                this.updateSaveStatus('saved');
                if (!isAutoSave) {
                    alert('项目保存成功！');
                }
            }
        } catch (error) {
            console.error('Failed to save project:', error);
            this.updateSaveStatus('unsaved');
            if (!isAutoSave) {
                alert('保存项目失败');
            }
        } finally {
            this.isSaving = false;
        }
    }
    
    async showMainSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('projects-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
        
        document.getElementById('user-info').textContent = `欢迎，${this.currentUser}`;
        document.getElementById('current-project-name').textContent = `项目：${this.currentProject?.title || '新项目'}`;
        
        // Start auto-save interval
        this.startAutoSave();
        
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
                if (model.id === data.defaultModel) option.selected = true;
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
                `AI调用次数：${data.used}/${data.limit}（剩余 ${data.remaining} 次）`;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
        }
    }
    
    async processText() {
        const content = document.getElementById('script-content').value.trim();
        const targetDuration = document.getElementById('target-duration').value;
        const modelId = document.getElementById('model-select').value;
        
        if (!content) {
            alert('请输入演讲稿内容');
            return;
        }
        
        this.targetDuration = parseInt(targetDuration) || null;
        
        const statusEl = document.getElementById('processing-status');
        const progressFill = statusEl.querySelector('.progress-fill');
        const processingText = document.getElementById('processing-text');
        
        statusEl.classList.remove('hidden');
        progressFill.style.width = '10%';
        processingText.textContent = '正在连接 AI...';
        document.getElementById('process-btn').disabled = true;
        
        try {
            const response = await fetch('/api/process-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: content, modelId, targetDuration: this.targetDuration })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let progress = 10;
            let bufferedLine = '';
            const handleDataLine = (line) => {
                if (!line.startsWith('data: ')) return;
                try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.progress) {
                        fullContent += data.content;
                        progress = Math.min(progress + 2, 90);
                        progressFill.style.width = `${progress}%`;
                        processingText.textContent = '正在使用 AI 处理...';
                    }
                    
                    if (data.done) {
                        progressFill.style.width = '100%';
                        processingText.textContent = '处理完成！';
                        // Use the final content from server, or accumulated content as fallback
                        const jsonContent = data.content || fullContent;
                        console.log('Received complete content from LLM, length:', jsonContent.length);
                        this.parseAndDisplaySegments(jsonContent);
                        setTimeout(() => statusEl.classList.add('hidden'), 1500);
                    }
                    
                    if (data.error) throw new Error(data.error);
                } catch (e) {
                    if (e.message !== 'Unexpected end of JSON input') console.error('Parse error:', e);
                }
            };
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                bufferedLine += chunk;
                const lines = bufferedLine.split('\n');
                bufferedLine = lines.pop() || '';
                
                for (const line of lines) {
                    handleDataLine(line);
                }
            }
            
            const trimmedBuffer = bufferedLine.trim();
            if (trimmedBuffer) {
                handleDataLine(trimmedBuffer);
            }
        } catch (error) {
            console.error('Processing error:', error);
            processingText.textContent = `错误：${error.message}`;
            progressFill.style.width = '0%';
            this.showErrorModal(error.message);
            this.localSegmentation(content, this.targetDuration);
            setTimeout(() => statusEl.classList.add('hidden'), 3000);
        } finally {
            document.getElementById('process-btn').disabled = false;
            await this.updateRateLimitInfo();
        }
    }
    
    showErrorModal(message) {
        document.getElementById('error-modal-message').textContent = `处理时发生错误：${message}。建议尝试更换其他 AI 模型。`;
        document.getElementById('error-modal').classList.remove('hidden');
    }
    
    closeErrorModal() {
        document.getElementById('error-modal').classList.add('hidden');
    }
    
    parseAndDisplaySegments(content) {
        let parsedSegments = [];
        try {
            let jsonStr = content.trim();
            
            // Try to extract JSON from markdown code blocks
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            } else {
                // Try to find JSON object with segments
                // Use a more robust approach: find first { and match braces properly
                const firstBrace = jsonStr.indexOf('{');
                if (firstBrace >= 0 && jsonStr.includes('"segments"')) {
                    let braceCount = 0;
                    let inString = false;
                    let escapeNext = false;
                    let endIndex = -1;
                    
                    for (let i = firstBrace; i < jsonStr.length; i++) {
                        const char = jsonStr[i];
                        
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        
                        if (char === '\\') {
                            escapeNext = true;
                            continue;
                        }
                        
                        if (char === '"') {
                            inString = !inString;
                            continue;
                        }
                        
                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIndex = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (endIndex > 0) {
                        jsonStr = jsonStr.substring(firstBrace, endIndex);
                    }
                }
            }
            
            const parsed = JSON.parse(jsonStr);
            parsedSegments = parsed.segments || [];
            
            // If we successfully parsed but got no segments, log a warning
            if (parsedSegments.length === 0) {
                console.warn('Parsed JSON but found no segments');
            }
        } catch (error) {
            console.warn('Failed to parse JSON segments, attempting regex extraction:', error);
            console.warn('Content length received:', content.length, 'Preview:', content.substring(0, 100) + '...');
            
            // Try regex extraction from malformed JSON
            parsedSegments = this.extractSegmentsFromText(content);
            
            // Only fallback to local segmentation if we have no content from LLM
            if (parsedSegments.length === 0) {
                console.error('No segments extracted from LLM response, using local segmentation');
                const sourceContent = document.getElementById('script-content').value.trim();
                this.localSegmentation(sourceContent);
                return;
            } else {
                console.log(`Extracted ${parsedSegments.length} segments using regex fallback`);
            }
        }
        
        this.segments = parsedSegments.map(seg => ({
            text: seg.text,
            duration: seg.duration < SECONDS_TO_MS_THRESHOLD ? seg.duration * 1000 : seg.duration,
            hasPause: !!seg.text.match(/[.!?。！？,，;；:：]$/)
        }));
        
        this.segments = this.segments.map(seg => ({
            ...seg,
            duration: seg.hasPause ? seg.duration + PAUSE_DURATION_MS : seg.duration
        }));
        
        // AI-generated timing is not rehearsal timing
        this.isRehearsalTiming = false;
        this.markUnsaved();
        
        this.displaySegments();
        this.calculateAndDisplayTotalDuration();
    }
    
    extractSegmentsFromText(content) {
        const segments = [];
        const buildSegmentRegex = (quote, textPattern, order) => {
            const textField = `${quote}text${quote}\\s*:\\s*${textPattern}`;
            const durationField = `${quote}duration${quote}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`;
            const pattern = order === 'textFirst'
                ? `${textField}[^}]*?${durationField}`
                : `${durationField}[^}]*?${textField}`;
            return new RegExp(pattern, 'g');
        };
        const segmentRegexes = [];
        [
            { quote: '"', textPattern: '"((?:\\\\.|[^"\\\\])*)"' },
            { quote: "'", textPattern: "'((?:\\\\.|[^'\\\\])*)'" }
        ].forEach(({ quote, textPattern }) => {
            segmentRegexes.push(
                { regex: buildSegmentRegex(quote, textPattern, 'textFirst'), textIndex: 1, durationIndex: 2 },
                { regex: buildSegmentRegex(quote, textPattern, 'durationFirst'), textIndex: 2, durationIndex: 1 }
            );
        });
        const decodeEscapes = (value) => {
            let result = '';
            for (let i = 0; i < value.length; i++) {
                const ch = value[i];
                if (ch !== '\\' || i === value.length - 1) {
                    result += ch;
                    continue;
                }
                const next = value[++i];
                switch (next) {
                    case 'n':
                        result += '\n';
                        break;
                    case 'r':
                        result += '\r';
                        break;
                    case 't':
                        result += '\t';
                        break;
                    case 'b':
                        result += '\b';
                        break;
                    case 'f':
                        result += '\f';
                        break;
                    case '"':
                        result += '"';
                        break;
                    case "'":
                        result += "'";
                        break;
                    case '\\':
                        result += '\\';
                        break;
                    case 'u': {
                        const hex = value.slice(i + 1, i + 5);
                        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                            result += String.fromCharCode(parseInt(hex, 16));
                            i += 4;
                        } else {
                            result += '\\u';
                        }
                        break;
                    }
                    default:
                        result += next;
                        break;
                }
            }
            return result;
        };
        
        const addMatch = (match, textIndex, durationIndex) => {
            let text = match[textIndex];
            try {
                text = decodeEscapes(text);
            } catch (error) {
                // Keep raw text if escape sequences are malformed.
            }
            const duration = parseFloat(match[durationIndex]);
            if (!Number.isNaN(duration)) {
                segments.push({ text, duration });
            }
        };
        
        segmentRegexes.forEach(({ regex, textIndex, durationIndex }) => {
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(content)) !== null) {
                if (match[0].length === 0) {
                    // Avoid infinite loops on zero-length matches.
                    regex.lastIndex++;
                    continue;
                }
                addMatch(match, textIndex, durationIndex);
            }
        });
        
        return segments;
    }
    
    localSegmentation(text, targetDuration) {
        const words = text.split(/\s+/).filter(w => w.trim());
        this.segments = [];
        
        const totalWords = words.length;
        const targetMs = targetDuration ? targetDuration * 1000 : null;
        const msPerWord = targetMs ? (targetMs / totalWords) : MS_PER_WORD;
        
        let currentPhrase = [];
        let phraseWordLimit = 2;
        
        for (let i = 0; i < words.length; i++) {
            currentPhrase.push(words[i]);
            const endsWithPunctuation = words[i].match(/[.!?。！？,，;；:：]$/);
            const shouldEnd = currentPhrase.length >= phraseWordLimit || i === words.length - 1 || endsWithPunctuation;
            
            if (shouldEnd && currentPhrase.length > 0) {
                const phraseText = currentPhrase.join(' ');
                let duration = Math.round(currentPhrase.length * msPerWord);
                if (endsWithPunctuation) duration += PAUSE_DURATION_MS;
                
                this.segments.push({
                    text: phraseText,
                    duration: Math.max(MIN_PHRASE_DURATION_MS, duration),
                    hasPause: !!endsWithPunctuation
                });
                
                currentPhrase = [];
                phraseWordLimit = phraseWordLimit === 2 ? 3 : 2;
            }
        }
        
        this.displaySegments();
        this.calculateAndDisplayTotalDuration();
    }
    
    calculateAndDisplayTotalDuration() {
        const totalMs = this.segments.reduce((sum, seg) => sum + seg.duration, 0);
        const totalSeconds = Math.round(totalMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        document.getElementById('total-duration-text').textContent = `分词后总时长：${minutes}分${seconds}秒`;
        
        // Show timing source
        const timingSourceEl = document.getElementById('timing-source');
        if (this.isRehearsalTiming) {
            timingSourceEl.textContent = '（使用排练计时）';
            // Reset speed to 1.0 for rehearsal timing - don't auto-scale
            document.getElementById('speed').value = 1.0;
            document.getElementById('speed-value').textContent = '1.0x';
            this.playbackSpeed = 1.0;
            document.getElementById('speed-suggestion').textContent = 
                this.targetDuration ? `目标时长 ${this.targetDuration} 秒（排练计时不自动调整速度）` : '';
        } else if (this.targetDuration) {
            timingSourceEl.textContent = '（使用 AI 分词时间）';
            const targetMs = this.targetDuration * 1000;
            const suggestedSpeed = Math.round((totalMs / targetMs) * 100) / 100;
            const clampedSpeed = Math.max(0.5, Math.min(2.0, suggestedSpeed));
            
            document.getElementById('speed-suggestion').textContent = 
                `建议播放速度：${clampedSpeed.toFixed(1)}x（匹配目标时长 ${this.targetDuration} 秒）`;
            
            document.getElementById('speed').value = clampedSpeed;
            document.getElementById('speed-value').textContent = `${clampedSpeed.toFixed(1)}x`;
            this.playbackSpeed = clampedSpeed;
        } else {
            timingSourceEl.textContent = '（使用 AI 分词时间）';
            document.getElementById('speed-suggestion').textContent = '';
        }
        
        document.getElementById('total-duration-info').classList.remove('hidden');
    }
    
    displaySegments() {
        const previewEl = document.getElementById('segments-preview');
        
        if (this.segments.length === 0) {
            previewEl.innerHTML = '<p class="placeholder-text">未生成分段</p>';
            document.getElementById('play-btn').disabled = true;
            document.getElementById('rehearsal-btn').disabled = true;
            return;
        }
        
        previewEl.innerHTML = this.segments.map((segment, index) => `
            <div class="segment-item" data-index="${index}" style="animation-delay: ${index * 0.05}s">
                <p class="segment-text">${this.escapeHtml(segment.text)}</p>
                <span class="segment-duration">${segment.duration}ms${segment.hasPause ? ' (含停顿)' : ''}</span>
            </div>
        `).join('');
        
        previewEl.querySelectorAll('.segment-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.openDurationModal(index);
            });
        });
        
        document.getElementById('play-btn').disabled = false;
        document.getElementById('rehearsal-btn').disabled = false;
    }
    
    openDurationModal(index) {
        this.editingSegmentIndex = index;
        const segment = this.segments[index];
        document.getElementById('duration-modal-text').textContent = `"${segment.text}"`;
        document.getElementById('duration-input').value = segment.duration;
        document.getElementById('duration-modal').classList.remove('hidden');
    }
    
    closeDurationModal() {
        document.getElementById('duration-modal').classList.add('hidden');
        this.editingSegmentIndex = null;
    }
    
    saveDuration() {
        if (this.editingSegmentIndex === null) return;
        const newDuration = parseInt(document.getElementById('duration-input').value);
        if (newDuration && newDuration >= 100) {
            this.segments[this.editingSegmentIndex].duration = newDuration;
            this.markUnsaved();
            this.displaySegments();
            this.calculateAndDisplayTotalDuration();
        }
        this.closeDurationModal();
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
        
        const teleprompterEl = document.getElementById('teleprompter-section');
        if (teleprompterEl.requestFullscreen) {
            teleprompterEl.requestFullscreen().catch(err => console.log('Fullscreen not available:', err));
        }
        
        // Set up click handler for toggling controls (ignore clicks on controls themselves)
        const displayEl = document.getElementById('teleprompter-display');
        this.teleprompterClickHandler = (e) => {
            // Don't toggle if clicking on controls
            if (!e.target.closest('.teleprompter-controls')) {
                this.toggleControls();
            }
        };
        displayEl.addEventListener('click', this.teleprompterClickHandler);
        
        this.currentSegmentIndex = 0;
        this.elapsedMs = 0;
        this.countdownSeconds = 10;
        this.isPlaying = true;
        this.isPaused = false;
        this.controlsVisible = true;
        
        document.getElementById('pause-btn').textContent = '暂停';
        this.renderTeleprompterContent();
        this.startCountdown();
    }
    
    renderTeleprompterContent() {
        const contentEl = document.getElementById('teleprompter-content');
        const n = this.candidateLines;
        let html = '';
        
        for (let i = 0; i < n; i++) {
            html += `<div class="teleprompter-line spacer" style="font-size: ${this.fontSize}px; opacity: 0;">&nbsp;</div>`;
        }
        
        for (let i = 0; i < this.segments.length; i++) {
            const diff = Math.abs(i - this.currentSegmentIndex);
            let className = 'teleprompter-line';
            
            if (i === this.currentSegmentIndex) className += ' current';
            else if (diff <= n) className += ` adjacent-${diff}`;
            else className += ' hidden-line';
            
            html += `<div class="${className}" style="font-size: ${this.fontSize}px">${this.escapeHtml(this.segments[i].text)}</div>`;
        }
        
        for (let i = 0; i < n; i++) {
            html += `<div class="teleprompter-line spacer" style="font-size: ${this.fontSize}px; opacity: 0;">&nbsp;</div>`;
        }
        
        contentEl.innerHTML = html;
        this.updateTeleprompterPosition();
    }
    
    updateTeleprompterPosition() {
        const contentEl = document.getElementById('teleprompter-content');
        const displayEl = document.getElementById('teleprompter-display');
        
        if (!contentEl || !displayEl) return;
        
        // Get the current line element
        const currentLine = contentEl.querySelector('.teleprompter-line.current');
        if (!currentLine) return;
        
        // Calculate the target Y position based on full screen height (100vh)
        // Use window.innerHeight to get the actual viewport height
        const screenHeight = window.innerHeight;
        const targetY = (this.currentLineY / 100) * screenHeight;
        
        // Get the current line's position relative to its container
        const currentLineTop = currentLine.offsetTop;
        
        // Calculate the transform needed to position the current line at targetY
        const translateY = targetY - currentLineTop;
        
        contentEl.style.transform = `translateY(${translateY}px)`;
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
                clearInterval(this.timerInterval);
                this.startPlayback();
            }
        }, 1000 / this.playbackSpeed);
    }
    
    startPlayback() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'running';
        this.updateTimer();
        this.scheduleNextSegment();
        
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
        const duration = segment.duration / this.playbackSpeed;
        
        this.playbackInterval = setTimeout(() => {
            if (this.isPaused) {
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
        pauseBtn.textContent = this.isPaused ? '继续' : '暂停';
        pauseBtn.classList.toggle('btn-success', this.isPaused);
        pauseBtn.classList.toggle('btn-warning', !this.isPaused);
    }
    
    finishPlayback() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        const timerEl = document.getElementById('timer-value');
        timerEl.classList.add('finished');
        
        // Auto-exit fullscreen after 5 seconds
        setTimeout(() => this.exitTeleprompter(), 5000);
    }
    
    exitTeleprompter() {
        // If in rehearsal mode, ask for confirmation
        if (this.isRehearsalMode && this.rehearsalTimings.length > 0) {
            if (!confirm('确定要退出排练计时吗？已录制的时间将被丢弃。')) {
                return;
            }
        }
        
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        // Remove click handler
        if (this.teleprompterClickHandler) {
            const displayEl = document.getElementById('teleprompter-display');
            displayEl.removeEventListener('click', this.teleprompterClickHandler);
            this.teleprompterClickHandler = null;
        }
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
        }
        
        document.getElementById('teleprompter-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        
        // Reset rehearsal mode
        if (this.isRehearsalMode) {
            this.isRehearsalMode = false;
            this.rehearsalTimings = [];
            document.getElementById('pause-btn').classList.remove('hidden');
            document.getElementById('next-word-btn').classList.add('hidden');
            document.getElementById('rehearsal-status').classList.add('hidden');
        }
        
        document.getElementById('pause-btn').textContent = '暂停';
        document.getElementById('pause-btn').classList.remove('btn-success');
        document.getElementById('pause-btn').classList.add('btn-warning');
    }
    
    updateFontSize(value) {
        this.fontSize = parseInt(value);
        document.getElementById('font-size-value').textContent = `${value}px`;
        if (this.isPlaying) this.renderTeleprompterContent();
    }
    
    updateSpeed(value) {
        this.playbackSpeed = parseFloat(value);
        document.getElementById('speed-value').textContent = `${value}x`;
    }
    
    updateCandidateLines(value) {
        this.candidateLines = parseInt(value);
        document.getElementById('candidate-lines-value').textContent = value;
        if (this.isPlaying) this.renderTeleprompterContent();
    }
    
    updateCurrentLineY(value) {
        this.currentLineY = parseInt(value);
        const displayEl = document.getElementById('current-line-y-value');
        
        // Update display text based on position
        if (value === '50') {
            displayEl.textContent = '居中';
        } else if (value === '0') {
            displayEl.textContent = '顶部';
        } else if (value === '100') {
            displayEl.textContent = '底部';
        } else {
            displayEl.textContent = `${value}%`;
        }
        
        if (this.isPlaying) this.updateTeleprompterPosition();
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        const teleprompterEl = document.getElementById('teleprompter-section');
        teleprompterEl.classList.toggle('dark-mode', this.isDarkMode);
        
        const toggleBtn = document.getElementById('dark-mode-toggle');
        toggleBtn.textContent = this.isDarkMode ? '开' : '关';
        toggleBtn.classList.toggle('active', this.isDarkMode);
    }
    
    toggleControls() {
        this.controlsVisible = !this.controlsVisible;
        const controlsEl = document.getElementById('teleprompter-controls');
        const hintEl = document.getElementById('controls-hint');
        
        if (this.controlsVisible) {
            controlsEl.classList.remove('hidden');
            if (hintEl) hintEl.classList.add('hidden');
        } else {
            controlsEl.classList.add('hidden');
            if (hintEl) hintEl.classList.remove('hidden');
        }
    }
    
    handleKeyboard(e) {
        if (!document.getElementById('teleprompter-section').classList.contains('hidden')) {
            switch (e.key) {
                case ' ':
                case 'Space':
                    e.preventDefault();
                    if (!this.isRehearsalMode) {
                        this.togglePause();
                    }
                    break;
                case 'Escape':
                    this.exitTeleprompter();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (this.isRehearsalMode) {
                        this.handleRehearsalPrevWord();
                    } else if (this.currentSegmentIndex > 0) {
                        this.currentSegmentIndex--;
                        this.renderTeleprompterContent();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (this.isRehearsalMode) {
                        this.handleRehearsalNextWord();
                    } else if (this.currentSegmentIndex < this.segments.length - 1) {
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
    
    // ============= Auto-save methods =============
    
    startAutoSave() {
        // Clear any existing interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Auto-save every 30 seconds if there are unsaved changes
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges && this.currentProject) {
                this.saveCurrentProject(true);
            }
        }, 30000);
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    markUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateSaveStatus('unsaved');
    }
    
    updateSaveStatus(status) {
        const statusEl = document.getElementById('save-status');
        const statusTextEl = document.getElementById('save-status-text');
        
        statusEl.classList.remove('saved', 'saving', 'unsaved');
        
        if (status === 'saved') {
            statusEl.classList.add('saved');
            const timeStr = this.lastSaveTime ? this.formatTime(this.lastSaveTime) : '';
            statusTextEl.textContent = `已保存${timeStr ? ' - ' + timeStr : ''}`;
        } else if (status === 'saving') {
            statusEl.classList.add('saving');
            statusTextEl.textContent = '保存中...';
        } else {
            statusEl.classList.add('unsaved');
            const timeStr = this.lastSaveTime ? this.formatTime(this.lastSaveTime) : '';
            statusTextEl.textContent = `有未保存的更改${timeStr ? '（上次保存：' + timeStr + '）' : ''}`;
        }
    }
    
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    // ============= Rehearsal mode methods =============
    
    showRehearsalModal() {
        if (this.segments.length === 0) {
            alert('请先进行 AI 分词');
            return;
        }
        document.getElementById('rehearsal-modal').classList.remove('hidden');
    }
    
    closeRehearsalModal() {
        document.getElementById('rehearsal-modal').classList.add('hidden');
    }
    
    startRehearsalMode() {
        this.closeRehearsalModal();
        
        if (this.segments.length === 0) return;
        
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.remove('hidden');
        
        const teleprompterEl = document.getElementById('teleprompter-section');
        if (teleprompterEl.requestFullscreen) {
            teleprompterEl.requestFullscreen().catch(err => console.log('Fullscreen not available:', err));
        }
        
        // Initialize rehearsal mode
        this.isRehearsalMode = true;
        this.rehearsalTimings = [];
        this.lastSegmentStartTime = 0;
        this.rehearsalElapsedBase = 0;
        this.currentSegmentIndex = 0;
        this.elapsedMs = 0;
        this.countdownSeconds = 10;
        this.isPlaying = true;
        this.isPaused = false;
        
        // Show rehearsal UI elements
        document.getElementById('pause-btn').classList.add('hidden');
        document.getElementById('next-word-btn').classList.remove('hidden');
        document.getElementById('rehearsal-status').classList.remove('hidden');
        document.getElementById('rehearsal-status-text').textContent = '排练倒数中...';
        
        this.renderTeleprompterContent();
        this.startRehearsalCountdown();
    }
    
    startRehearsalCountdown() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'countdown';
        
        this.timerInterval = setInterval(() => {
            if (this.countdownSeconds > 0) {
                timerEl.textContent = this.countdownSeconds;
                this.countdownSeconds--;
            } else {
                clearInterval(this.timerInterval);
                this.startRehearsalRecording();
            }
        }, 1000);
    }
    
    startRehearsalRecording() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'running';
        
        document.getElementById('rehearsal-status-text').textContent = 
            `排练录制中 (${this.currentSegmentIndex + 1}/${this.segments.length})`;
        
        this.lastSegmentStartTime = Date.now();
        this.elapsedMs = 0;
        this.rehearsalElapsedBase = 0; // Track accumulated time from completed segments
        
        // Start timer
        this.timerInterval = setInterval(() => {
            this.elapsedMs = Date.now() - this.lastSegmentStartTime + this.rehearsalElapsedBase;
            this.updateTimer();
        }, 100);
    }
    
    handleRehearsalNextWord() {
        if (!this.isRehearsalMode || this.countdownSeconds > 0) return;
        
        // Record the duration for the current segment
        const currentTime = Date.now();
        const segmentDuration = currentTime - this.lastSegmentStartTime;
        
        // Store the timing
        this.rehearsalTimings[this.currentSegmentIndex] = segmentDuration;
        
        // Update accumulated base time
        this.rehearsalElapsedBase += segmentDuration;
        
        // Move to next segment
        if (this.currentSegmentIndex < this.segments.length - 1) {
            this.currentSegmentIndex++;
            this.lastSegmentStartTime = currentTime;
            this.renderTeleprompterContent();
            document.getElementById('rehearsal-status-text').textContent = 
                `排练录制中 (${this.currentSegmentIndex + 1}/${this.segments.length})`;
        } else {
            // Recording complete
            this.finishRehearsalRecording();
        }
    }
    
    handleRehearsalPrevWord() {
        if (!this.isRehearsalMode || this.countdownSeconds > 0) return;
        
        if (this.currentSegmentIndex > 0) {
            // Clear the timing for the current segment (we're going back)
            this.rehearsalTimings[this.currentSegmentIndex] = undefined;
            this.currentSegmentIndex--;
            this.lastSegmentStartTime = Date.now();
            // Also clear the timing for the segment we're going back to and recalculate base
            const prevTiming = this.rehearsalTimings[this.currentSegmentIndex];
            if (prevTiming !== undefined && prevTiming > 0) {
                this.rehearsalElapsedBase -= prevTiming;
            }
            this.rehearsalTimings[this.currentSegmentIndex] = undefined;
            this.renderTeleprompterContent();
            document.getElementById('rehearsal-status-text').textContent = 
                `排练录制中 (${this.currentSegmentIndex + 1}/${this.segments.length})`;
        }
    }
    
    finishRehearsalRecording() {
        clearInterval(this.timerInterval);
        this.isPlaying = false;
        
        // Calculate total time (filter out undefined values)
        const totalMs = this.rehearsalTimings.reduce((sum, t) => sum + (t || 0), 0);
        const totalSeconds = Math.round(totalMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        document.getElementById('rehearsal-total-time').textContent = 
            `总录制时长：${minutes}分${seconds}秒`;
        
        // Hide rehearsal status and show complete modal
        document.getElementById('rehearsal-status').classList.add('hidden');
        document.getElementById('rehearsal-complete-modal').classList.remove('hidden');
    }
    
    saveRehearsalTiming() {
        // Apply recorded timings to segments (only valid positive values)
        for (let i = 0; i < this.rehearsalTimings.length; i++) {
            if (this.rehearsalTimings[i] !== undefined && this.rehearsalTimings[i] > 0) {
                this.segments[i].duration = Math.max(MIN_PHRASE_DURATION_MS, this.rehearsalTimings[i]);
            }
        }
        
        // Mark as rehearsal timing
        this.isRehearsalTiming = true;
        this.markUnsaved();
        
        this.closeRehearsalCompleteModal();
        this.exitTeleprompterAfterRehearsal();
        
        // Update display
        this.displaySegments();
        this.calculateAndDisplayTotalDuration();
    }
    
    discardRehearsalTiming() {
        this.closeRehearsalCompleteModal();
        this.exitTeleprompterAfterRehearsal();
    }
    
    closeRehearsalCompleteModal() {
        document.getElementById('rehearsal-complete-modal').classList.add('hidden');
    }
    
    exitTeleprompterAfterRehearsal() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        this.isRehearsalMode = false;
        this.rehearsalTimings = [];
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
        }
        
        document.getElementById('teleprompter-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        
        // Reset UI elements
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('next-word-btn').classList.add('hidden');
        document.getElementById('rehearsal-status').classList.add('hidden');
        document.getElementById('pause-btn').textContent = '暂停';
        document.getElementById('pause-btn').classList.remove('btn-success');
        document.getElementById('pause-btn').classList.add('btn-warning');
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MeowSpeechKit();
});
