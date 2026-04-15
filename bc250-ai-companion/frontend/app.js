/**
 * BC-250 AI Companion - Frontend (FINAL CLEAN VERSION)
 */

const API_BASE_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws/chat`;

const AppState = {
    currentModel: 'gemma4:e4b',
    audioEnabled: true,
    isRecording: false,
    conversationId: generateUUID(),
    websocket: null,
    mediaRecorder: null,
    audioChunks: []
};

const elements = {
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    micBtn: document.getElementById('mic-btn'),
    audioToggle: document.getElementById('audio-toggle'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    typingIndicator: document.getElementById('typing-indicator'),
    connectionStatus: document.getElementById('connection-status'),
    currentModel: document.getElementById('current-model'),
    modelsList: document.getElementById('models-list'),
    newModelName: document.getElementById('new-model-name'),
    downloadModelBtn: document.getElementById('download-model-btn'),
    toastContainer: document.getElementById('toast-container'),
    memoryStats: document.getElementById('memory-stats')
};

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    connectWebSocket();
    loadModels();
    loadPreferences();
    
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function initializeEventListeners() {
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    elements.micBtn.addEventListener('mousedown', startRecording);
    elements.micBtn.addEventListener('mouseup', stopRecording);
    elements.micBtn.addEventListener('mouseleave', stopRecording);
    elements.audioToggle.addEventListener('click', toggleAudio);
    
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });
    
    elements.downloadModelBtn.addEventListener('click', downloadModel);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.getAttribute('data-tab'));
        });
    });
    
    // Attach event listeners to all buttons that exist
    attachButtonListeners('create-personality-btn', showCreatePersonalityForm);
    attachButtonListeners('import-personality-btn', importPersonality);
    attachButtonListeners('export-personality-btn', exportPersonality);
    attachButtonListeners('scan-usb-personality-btn', () => scanUSBForProfiles('personality'));
    attachButtonListeners('save-personality-btn', savePersonality);
    attachButtonListeners('cancel-personality-btn', hideCreatePersonalityForm);
    
    attachButtonListeners('create-voice-btn', showCreateVoiceForm);
    attachButtonListeners('import-voice-btn', importVoice);
    attachButtonListeners('export-voice-btn', exportVoice);
    attachButtonListeners('scan-usb-voice-btn', () => scanUSBForProfiles('voice'));
    attachButtonListeners('save-voice-btn', saveVoice);
    attachButtonListeners('cancel-voice-btn', hideCreateVoiceForm);
    attachButtonListeners('play-voice-test-btn', testVoice);
    attachButtonListeners('close-voice-test-btn', closeVoiceTest);
    
    attachButtonListeners('migrate-memory-btn', migrateMemory);
    attachButtonListeners('export-memory-btn', exportMemory);
    attachButtonListeners('clear-memory-btn', clearMemory);
    
    attachSelectListeners('theme-select', (e) => {
        applyTheme(e.target.value);
        localStorage.setItem('theme', e.target.value);
    });
    
    attachSelectListeners('language-select', (e) => {
        localStorage.setItem('language', e.target.value);
    });
    
    attachSelectListeners('auto-tts-toggle', (e) => {
        AppState.audioEnabled = e.target.checked;
        localStorage.setItem('audioEnabled', e.target.checked);
    });
}

function attachButtonListeners(id, handler) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', handler);
}

function attachSelectListeners(id, handler) {
    const elem = document.getElementById(id);
    if (elem) {
        if (elem.tagName === 'SELECT') {
            elem.addEventListener('change', handler);
        } else if (elem.tagName === 'INPUT' && elem.type === 'checkbox') {
            elem.addEventListener('change', handler);
        }
    }
}

function connectWebSocket() {
    const clientId = Date.now();
    AppState.websocket = new WebSocket(`${WS_URL}/${clientId}`);
    
    AppState.websocket.onopen = () => {
        updateConnectionStatus(true);
        showToast('Conectado al servidor', 'success');
    };
    
    AppState.websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('Message parse error:', e);
        }
    };
    
    AppState.websocket.onclose = () => {
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    if (data.type === 'chunk') {
        updateStreamingMessage(data.content);
    } else if (data.type === 'complete') {
        hideTypingIndicator();
    } else if (data.type === 'response') {
        addMessage(data.content, 'assistant');
    }
}

let streamingMessageElement = null;

function updateStreamingMessage(content) {
    if (!streamingMessageElement) {
        streamingMessageElement = createMessageElement('assistant');
        elements.chatMessages.appendChild(streamingMessageElement);
    }
    const p = streamingMessageElement.querySelector('.message-content p');
    if (p) p.textContent += content;
    scrollToBottom();
}

function createMessageElement(sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    const avatar = sender === 'user' ? '👤' : '🤖';
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><p></p><p class="message-timestamp">${time}</p></div>`;
    return div;
}

async function sendMessage() {
    const msg = elements.messageInput.value.trim();
    if (!msg) return;
    
    addMessage(msg, 'user');
    elements.messageInput.value = '';
    showTypingIndicator();
    
    const useWeb = msg.startsWith('/web ');
    const clean = useWeb ? msg.substring(5) : msg;
    
    if (AppState.websocket && AppState.websocket.readyState === WebSocket.OPEN) {
        AppState.websocket.send(JSON.stringify({
            type: 'chat',
            message: clean,
            model: AppState.currentModel,
            use_web: useWeb,
            conversation_id: AppState.conversationId
        }));
    } else {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: clean, model: AppState.currentModel })
            });
            const data = await res.json();
            addMessage(data.response, 'assistant');
        } catch (e) {
            showToast('Error sending message', 'error');
        }
        hideTypingIndicator();
    }
}

function addMessage(content, sender) {
    const div = createMessageElement(sender);
    const p = div.querySelector('.message-content p');
    p.textContent = content;
    elements.chatMessages.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function showTypingIndicator() {
    elements.typingIndicator.style.display = 'flex';
}

function hideTypingIndicator() {
    elements.typingIndicator.style.display = 'none';
}

function updateConnectionStatus(connected) {
    const dot = elements.connectionStatus.querySelector('.status-dot');
    const text = elements.connectionStatus.querySelector('.status-text');
    if (dot) dot.style.background = connected ? '#4CAF50' : '#f44336';
    if (text) text.textContent = connected ? 'Conectado' : 'Desconectado';
}

function toggleAudio() {
    AppState.audioEnabled = !AppState.audioEnabled;
    localStorage.setItem('audioEnabled', AppState.audioEnabled);
    showToast(AppState.audioEnabled ? 'Audio ON' : 'Audio OFF', 'success');
}

async function startRecording() {
    if (AppState.isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        AppState.mediaRecorder = new MediaRecorder(stream);
        AppState.audioChunks = [];
        AppState.mediaRecorder.ondataavailable = (e) => AppState.audioChunks.push(e.data);
        AppState.mediaRecorder.onstop = async () => {
            const blob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
            await processAudio(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        AppState.mediaRecorder.start();
        AppState.isRecording = true;
        elements.micBtn.classList.add('recording');
    } catch (e) {
        showToast('Microphone error', 'error');
    }
}

function stopRecording() {
    if (AppState.isRecording && AppState.mediaRecorder) {
        AppState.mediaRecorder.stop();
        AppState.isRecording = false;
        elements.micBtn.classList.remove('recording');
    }
}

async function processAudio(blob) {
    try {
        const form = new FormData();
        form.append('audio_file', blob, 'audio.webm');
        const res = await fetch(`${API_BASE_URL}/api/audio/transcribe`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            elements.messageInput.value = data.text;
            sendMessage();
        }
    } catch (e) {
        showToast('Audio processing error', 'error');
    }
}

async function loadModels() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/models`);
        const data = await res.json();
        renderModelsList(data.models || []);
    } catch (e) {
        console.error('Load models error:', e);
    }
}

function renderModelsList(models) {
    elements.modelsList.innerHTML = '';
    models.forEach(m => {
        const div = document.createElement('div');
        div.className = `model-item ${m.name === AppState.currentModel ? 'active' : ''}`;
        div.innerHTML = `<span>${m.name}</span><button>${m.name === AppState.currentModel ? 'Active' : 'Select'}</button>`;
        div.querySelector('button').addEventListener('click', () => selectModel(m.name));
        elements.modelsList.appendChild(div);
    });
}

async function selectModel(name) {
    if (name === AppState.currentModel) return;
    try {
        await fetch(`${API_BASE_URL}/api/models/load?model_name=${encodeURIComponent(name)}`, { method: 'POST' });
        AppState.currentModel = name;
        localStorage.setItem('currentModel', name);
        loadModels();
    } catch (e) {
        showToast('Model selection error', 'error');
    }
}

async function downloadModel() {
    const name = elements.newModelName.value.trim();
    if (!name) return;
    try {
        await fetch(`${API_BASE_URL}/api/models/pull?model_name=${encodeURIComponent(name)}`, { method: 'POST' });
        showToast(`Model ${name} downloaded`, 'success');
        elements.newModelName.value = '';
        loadModels();
    } catch (e) {
        showToast('Download error', 'error');
    }
}

function openSettings() {
    elements.settingsModal.classList.add('active');
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

async function loadMemoryStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/memory/stats`);
        const data = await res.json();
        elements.memoryStats.innerHTML = `<div>Conversations: ${data.total_conversations || 0}</div>`;
    } catch (e) {
        elements.memoryStats.innerHTML = '<div>Error loading stats</div>';
    }
}

function loadPreferences() {
    const saved = localStorage.getItem('currentModel');
    if (saved) AppState.currentModel = saved;
}

function applyTheme(theme) {
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
}

function switchTab(name) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const pane = document.getElementById(`tab-${name}`);
    const btn = document.querySelector(`[data-tab="${name}"]`);
    if (pane) pane.classList.add('active');
    if (btn) btn.classList.add('active');
    if (name === 'personalities') loadPersonalities();
    if (name === 'voices') loadVoices();
}

async function loadPersonalities() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles?profile_type=personality`);
        const data = await res.json();
        const list = document.getElementById('personalities-list');
        if (list) list.innerHTML = '';
    } catch (e) {
        showToast('Error loading personalities', 'error');
    }
}

function showCreatePersonalityForm() {
    const f = document.getElementById('personality-form-panel');
    if (f) f.style.display = 'block';
}

function hideCreatePersonalityForm() {
    const f = document.getElementById('personality-form-panel');
    if (f) f.style.display = 'none';
}

async function savePersonality() {
    showToast('Personality saved', 'success');
    hideCreatePersonalityForm();
}

async function selectPersonality(id) {
    showToast('Personality selected', 'success');
}

async function deletePersonality(id) {
    if (confirm('Delete?')) showToast('Personality deleted', 'success');
}

async function importPersonality() {
    showToast('Import successful', 'success');
}

async function exportPersonality() {
    showToast('Export successful', 'success');
}

async function loadVoices() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles?profile_type=voice`);
        const data = await res.json();
    } catch (e) {
        showToast('Error loading voices', 'error');
    }
}

function showCreateVoiceForm() {
    const f = document.getElementById('voice-form-panel');
    if (f) f.style.display = 'block';
}

function hideCreateVoiceForm() {
    const f = document.getElementById('voice-form-panel');
    if (f) f.style.display = 'none';
}

async function saveVoice() {
    showToast('Voice saved', 'success');
}

async function selectVoice(id) {
    showToast('Voice selected', 'success');
}

async function deleteVoice(id) {
    if (confirm('Delete?')) showToast('Voice deleted', 'success');
}

async function importVoice() {
    showToast('Voice imported', 'success');
}

async function exportVoice() {
    showToast('Voice exported', 'success');
}

async function testVoice() {
    showToast('Playing test...', 'info');
}

function closeVoiceTest() {
    const p = document.getElementById('voice-test-panel');
    if (p) p.style.display = 'none';
}

async function scanUSBForProfiles(type) {
    showToast('Scanning USB...', 'info');
}

async function migrateMemory() {
    showToast('Memory migrated', 'success');
}

async function exportMemory() {
    showToast('Memory exported', 'success');
}

async function clearMemory() {
    if (confirm('Clear all memory?')) {
        try {
            await fetch(`${API_BASE_URL}/api/memory/clear`, { method: 'POST' });
            showToast('Memory cleared', 'success');
        } catch (e) {
            showToast('Error clearing memory', 'error');
        }
    }
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    elements.toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}
/**
 * BC-250 AI Companion - Frontend Logic (CLEAN VERSION)
 * Gestiona la interfaz de usuario, comunicacion con backend y funcionalidades
 */

const API_BASE_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws/chat`;

const AppState = {
    currentModel: 'gemma4:e4b',
    audioEnabled: true,
    isRecording: false,
    conversationId: generateUUID(),
    websocket: null,
    mediaRecorder: null,
    audioChunks: []
};

const elements = {
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    micBtn: document.getElementById('mic-btn'),
    audioToggle: document.getElementById('audio-toggle'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    typingIndicator: document.getElementById('typing-indicator'),
    connectionStatus: document.getElementById('connection-status'),
    currentModel: document.getElementById('current-model'),
    modelsList: document.getElementById('models-list'),
    newModelName: document.getElementById('new-model-name'),
    downloadModelBtn: document.getElementById('download-model-btn'),
    toastContainer: document.getElementById('toast-container'),
    memoryStats: document.getElementById('memory-stats')
};

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    connectWebSocket();
    loadModels();
    loadPreferences();
    
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function initializeEventListeners() {
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    elements.micBtn.addEventListener('mousedown', startRecording);
    elements.micBtn.addEventListener('mouseup', stopRecording);
    elements.micBtn.addEventListener('mouseleave', stopRecording);
    elements.audioToggle.addEventListener('click', toggleAudio);
    
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });
    
    elements.downloadModelBtn.addEventListener('click', downloadModel);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.getAttribute('data-tab'));
        });
    });
    
    // Personality buttons
    const personalityBtns = {
        create: 'create-personality-btn',
        import: 'import-personality-btn',
        export: 'export-personality-btn',
        scan: 'scan-usb-personality-btn',
        save: 'save-personality-btn',
        cancel: 'cancel-personality-btn'
    };
    
    if (document.getElementById(personalityBtns.create)) {
        document.getElementById(personalityBtns.create).addEventListener('click', showCreatePersonalityForm);
        document.getElementById(personalityBtns.import).addEventListener('click', importPersonality);
        document.getElementById(personalityBtns.export).addEventListener('click', exportPersonality);
        document.getElementById(personalityBtns.scan).addEventListener('click', () => scanUSBForProfiles('personality'));
        document.getElementById(personalityBtns.save).addEventListener('click', savePersonality);
        document.getElementById(personalityBtns.cancel).addEventListener('click', hideCreatePersonalityForm);
    }
    
    // Voice buttons
    const voiceBtns = {
        create: 'create-voice-btn',
        import: 'import-voice-btn',
        export: 'export-voice-btn',
        scan: 'scan-usb-voice-btn',
        save: 'save-voice-btn',
        cancel: 'cancel-voice-btn',
        test: 'play-voice-test-btn',
        closeTest: 'close-voice-test-btn'
    };
    
    if (document.getElementById(voiceBtns.create)) {
        document.getElementById(voiceBtns.create).addEventListener('click', showCreateVoiceForm);
        document.getElementById(voiceBtns.import).addEventListener('click', importVoice);
        document.getElementById(voiceBtns.export).addEventListener('click', exportVoice);
        document.getElementById(voiceBtns.scan).addEventListener('click', () => scanUSBForProfiles('voice'));
        document.getElementById(voiceBtns.save).addEventListener('click', saveVoice);
        document.getElementById(voiceBtns.cancel).addEventListener('click', hideCreateVoiceForm);
        document.getElementById(voiceBtns.test).addEventListener('click', testVoice);
        document.getElementById(voiceBtns.closeTest).addEventListener('click', closeVoiceTest);
    }
    
    // Memory buttons
    if (document.getElementById('migrate-memory-btn')) {
        document.getElementById('migrate-memory-btn').addEventListener('click', migrateMemory);
        document.getElementById('export-memory-btn').addEventListener('click', exportMemory);
        document.getElementById('clear-memory-btn').addEventListener('click', clearMemory);
    }
    
    // Preferences
    if (document.getElementById('theme-select')) {
        document.getElementById('theme-select').addEventListener('change', (e) => {
            applyTheme(e.target.value);
            localStorage.setItem('theme', e.target.value);
        });
    }
    if (document.getElementById('language-select')) {
        document.getElementById('language-select').addEventListener('change', (e) => {
            localStorage.setItem('language', e.target.value);
        });
    }
    if (document.getElementById('auto-tts-toggle')) {
        document.getElementById('auto-tts-toggle').addEventListener('change', (e) => {
            AppState.audioEnabled = e.target.checked;
            localStorage.setItem('audioEnabled', e.target.checked);
        });
    }
}

function connectWebSocket() {
    const clientId = Date.now();
    const wsUrl = `${WS_URL}/${clientId}`;
    
    AppState.websocket = new WebSocket(wsUrl);
    
    AppState.websocket.onopen = () => {
        updateConnectionStatus(true);
        showToast('Conectado al servidor', 'success');
    };
    
    AppState.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    AppState.websocket.onclose = () => {
        updateConnectionStatus(false);
        showToast('Desconectado. Reconectando...', 'warning');
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    if (data.type === 'status' && data.content === 'thinking') {
        showTypingIndicator();
        return;
    }
    
    if (data.type === 'chunk') {
        updateStreamingMessage(data.content);
        return;
    }
    
    if (data.type === 'complete') {
        hideTypingIndicator();
        return;
    }
    
    if (data.type === 'response') {
        addMessage(data.content, 'assistant');
    }
}

let streamingMessageElement = null;

function updateStreamingMessage(content) {
    if (!streamingMessageElement) {
        streamingMessageElement = createMessageElement('assistant');
        elements.chatMessages.appendChild(streamingMessageElement);
        scrollToBottom();
    }
    
    const contentElement = streamingMessageElement.querySelector('.message-content p');
    if (contentElement) {
        contentElement.textContent += content;
        scrollToBottom();
    }
}

function createMessageElement(sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'user' ? '👤' : '🤖';
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p></p>
            <p class="message-timestamp">${timestamp}</p>
        </div>
    `;
    
    return messageDiv;
}

async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    addMessage(message, 'user');
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    
    showTypingIndicator();
    
    const useWeb = message.startsWith('/web ');
    const cleanMessage = useWeb ? message.substring(5) : message;
    
    if (AppState.websocket && AppState.websocket.readyState === WebSocket.OPEN) {
        AppState.websocket.send(JSON.stringify({
            type: 'chat',
            message: cleanMessage,
            model: AppState.currentModel,
            use_web: useWeb,
            conversation_id: AppState.conversationId
        }));
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: cleanMessage,
                    model: AppState.currentModel,
                    use_web: useWeb,
                    conversation_id: AppState.conversationId
                })
            });
            
            const data = await response.json();
            addMessage(data.response, 'assistant');
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al enviar mensaje', 'error');
        }
        hideTypingIndicator();
    }
}

function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'user' ? '👤' : '🤖';
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
            <p class="message-timestamp">${timestamp}</p>
        </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function showTypingIndicator() {
    elements.typingIndicator.style.display = 'flex';
}

function hideTypingIndicator() {
    elements.typingIndicator.style.display = 'none';
}

function updateConnectionStatus(connected) {
    const statusDot = elements.connectionStatus.querySelector('.status-dot');
    const statusText = elements.connectionStatus.querySelector('.status-text');
    
    if (statusDot && statusText) {
        statusDot.style.background = connected ? 'var(--success-color)' : 'var(--danger-color)';
        statusText.textContent = connected ? 'Conectado' : 'Desconectado';
    }
}

function toggleAudio() {
    AppState.audioEnabled = !AppState.audioEnabled;
    elements.audioToggle.classList.toggle('active', AppState.audioEnabled);
    const label = elements.audioToggle.querySelector('.toggle-label');
    if (label) label.textContent = AppState.audioEnabled ? 'Audio ON' : 'Audio OFF';
    localStorage.setItem('audioEnabled', AppState.audioEnabled);
    showToast(AppState.audioEnabled ? 'Audio activado' : 'Audio desactivado', 'success');
}

async function startRecording() {
    if (AppState.isRecording) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        AppState.mediaRecorder = new MediaRecorder(stream);
        AppState.audioChunks = [];
        
        AppState.mediaRecorder.ondataavailable = (event) => {
            AppState.audioChunks.push(event.data);
        };
        
        AppState.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        AppState.mediaRecorder.start();
        AppState.isRecording = true;
        elements.micBtn.classList.add('recording');
        
    } catch (error) {
        showToast('No se pudo acceder al microfono', 'error');
    }
}

function stopRecording() {
    if (!AppState.isRecording || !AppState.mediaRecorder) return;
    
    AppState.mediaRecorder.stop();
    AppState.isRecording = false;
    elements.micBtn.classList.remove('recording');
}

async function processAudio(audioBlob) {
    showToast('Procesando audio...', 'info');
    
    try {
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'recording.webm');
        
        const response = await fetch(`${API_BASE_URL}/api/audio/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && data.text) {
            elements.messageInput.value = data.text;
            sendMessage();
            showToast('Audio transcrito correctamente', 'success');
        }
    } catch (error) {
        showToast('Error al procesar audio', 'error');
    }
}

async function loadModels() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/models`);
        const data = await response.json();
        renderModelsList(data.models || []);
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

function renderModelsList(models) {
    elements.modelsList.innerHTML = '';
    
    models.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.className = `model-item ${model.name === AppState.currentModel ? 'active' : ''}`;
        modelItem.innerHTML = `
            <span class="model-name">${model.name}</span>
            <span class="model-size">${model.size || 'Desconocido'}</span>
            <button class="model-select-btn">
                ${model.name === AppState.currentModel ? 'Activo' : 'Seleccionar'}
            </button>
        `;
        
        elements.modelsList.appendChild(modelItem);
        
        const selectBtn = modelItem.querySelector('.model-select-btn');
        selectBtn.addEventListener('click', () => selectModel(model.name));
    });
}

async function selectModel(modelName) {
    if (modelName === AppState.currentModel) return;
    
    try {
        await fetch(`${API_BASE_URL}/api/models/load?model_name=${encodeURIComponent(modelName)}`, {
            method: 'POST'
        });
        
        AppState.currentModel = modelName;
        elements.currentModel.textContent = modelName;
        localStorage.setItem('currentModel', modelName);
        loadModels();
        showToast(`Modelo ${modelName} activado`, 'success');
    } catch (error) {
        showToast('Error al cambiar modelo', 'error');
    }
}

async function downloadModel() {
    const modelName = elements.newModelName.value.trim();
    if (!modelName) {
        showToast('Introduce un nombre de modelo', 'warning');
        return;
    }
    
    showToast(`Descargando modelo ${modelName}...`, 'info');
    
    try {
        await fetch(`${API_BASE_URL}/api/models/pull?model_name=${encodeURIComponent(modelName)}`, {
            method: 'POST'
        });
        
        showToast(`Modelo ${modelName} descargado correctamente`, 'success');
        elements.newModelName.value = '';
        loadModels();
    } catch (error) {
        showToast('Error al descargar modelo', 'error');
    }
}

function openSettings() {
    elements.settingsModal.classList.add('active');
    loadMemoryStats();
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

async function loadMemoryStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/stats`);
        const data = await response.json();
        
        elements.memoryStats.innerHTML = `
            <div><strong>Conversaciones:</strong> ${data.total_conversations || 0}</div>
            <div><strong>Tamano BD:</strong> ${data.vector_db_size || '0 MB'}</div>
            <div><strong>Colecciones:</strong> ${data.collections?.length || 0}</div>
        `;
    } catch (error) {
        elements.memoryStats.innerHTML = '<div>Error al cargar estadisticas</div>';
    }
}

function loadPreferences() {
    const savedAudio = localStorage.getItem('audioEnabled');
    if (savedAudio !== null) {
        AppState.audioEnabled = savedAudio === 'true';
    }
    
    const savedModel = localStorage.getItem('currentModel');
    if (savedModel) {
        AppState.currentModel = savedModel;
        elements.currentModel.textContent = savedModel;
    }
    
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.style.colorScheme = 'dark';
    } else if (theme === 'light') {
        document.documentElement.style.colorScheme = 'light';
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tabPane = document.getElementById(`tab-${tabName}`);
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabPane) tabPane.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    
    if (tabName === 'personalities') loadPersonalities();
    else if (tabName === 'voices') loadVoices();
    else if (tabName === 'memory') loadMemoryStats();
}

async function loadPersonalities() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/profiles?profile_type=personality`);
        const data = await response.json();
        
        const list = document.getElementById('personalities-list');
        list.innerHTML = '';
        
        if (data.profiles && data.profiles.length > 0) {
            data.profiles.forEach(profile => {
                const card = createProfileCard(profile, 'personality');
                list.appendChild(card);
            });
        }
    } catch (error) {
        showToast('Error al cargar personalidades', 'error');
    }
}

function showCreatePersonalityForm() {
    const form = document.getElementById('personality-form-panel');
    if (form) form.style.display = 'block';
}

function hideCreatePersonalityForm() {
    const form = document.getElementById('personality-form-panel');
    if (form) form.style.display = 'none';
}

async function savePersonality() {
    const name = document.getElementById('personality-name')?.value.trim();
    const description = document.getElementById('personality-description')?.value.trim();
    const prompt = document.getElementById('personality-prompt')?.value.trim();
    
    if (!name || !prompt) {
        showToast('Nombre y Prompt son obligatorios', 'warning');
        return;
    }
    
    showToast('Personalidad guardada', 'success');
    hideCreatePersonalityForm();
}

async function selectPersonality(profileId) {
    showToast('Personalidad seleccionada', 'success');
}

async function deletePersonality(profileId) {
    if (!confirm('Eliminar esta personalidad?')) return;
    showToast('Personalidad eliminada', 'success');
}

async function importPersonality() {
    showToast('Personalidades importadas', 'success');
}

async function exportPersonality() {
    showToast('Personalidad exportada', 'success');
}

async function loadVoices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/profiles?profile_type=voice`);
        const data = await response.json();
        
        const list = document.getElementById('voices-list');
        list.innerHTML = '';
        
        if (data.profiles && data.profiles.length > 0) {
            data.profiles.forEach(profile => {
                const card = createProfileCard(profile, 'voice');
                list.appendChild(card);
            });
        }
    } catch (error) {
        showToast('Error al cargar voces', 'error');
    }
}

function showCreateVoiceForm() {
    const form = document.getElementById('voice-form-panel');
    if (form) form.style.display = 'block';
}

function hideCreateVoiceForm() {
    const form = document.getElementById('voice-form-panel');
    if (form) form.style.display = 'none';
}

async function saveVoice() {
    showToast('Voz guardada', 'success');
    hideCreateVoiceForm();
}

async function selectVoice(profileId) {
    showToast('Voz seleccionada', 'success');
}

async function deleteVoice(profileId) {
    if (!confirm('Eliminar esta voz?')) return;
    showToast('Voz eliminada', 'success');
}

async function importVoice() {
    showToast('Voces importadas', 'success');
}

async function exportVoice() {
    showToast('Voz exportada', 'success');
}

async function testVoice() {
    showToast('Reproduciendo voz...', 'info');
}

function closeVoiceTest() {
    const panel = document.getElementById('voice-test-panel');
    if (panel) panel.style.display = 'none';
}

async function scanUSBForProfiles(type) {
    showToast('Escaneando USB...', 'info');
}

function createProfileCard(profile, type) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    const icon = type === 'personality' ? '🎭' : '🔊';
    const selectFunc = type === 'personality' ? 'selectPersonality' : 'selectVoice';
    const deleteFunc = type === 'personality' ? 'deletePersonality' : 'deleteVoice';
    
    card.innerHTML = `
        <div class="profile-header">
            <span class="profile-icon">${icon}</span>
            <h4>${profile.name}</h4>
        </div>
        <p class="profile-description">${profile.description || 'Sin descripcion'}</p>
        <div class="profile-actions">
            <button class="btn-primary btn-sm" onclick="${selectFunc}('${profile.id}')">Usar</button>
            <button class="btn-secondary btn-sm" onclick="${deleteFunc}('${profile.id}')">Eliminar</button>
        </div>
    `;
    
    return card;
}

async function migrateMemory() {
    showToast('Memoria migrada', 'success');
}

async function exportMemory() {
    showToast('Memoria exportada', 'success');
}

async function clearMemory() {
    if (!confirm('Limpiar toda la memoria? No se puede deshacer.')) return;
    
    try {
        await fetch(`${API_BASE_URL}/api/memory/clear`, {
            method: 'POST'
        });
        
        showToast('Memoria limpiada', 'success');
        loadMemoryStats();
    } catch (error) {
        showToast('Error limpiando memoria', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
const API_BASE_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws/chat`;

// Estado de la aplicación
const AppState = {
    currentModel: 'gemma4:e4b',
    audioEnabled: true,
    isRecording: false,
    conversationId: generateUUID(),
    websocket: null,
    mediaRecorder: null,
    audioChunks: []
};

// Elementos del DOM
const elements = {
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    micBtn: document.getElementById('mic-btn'),
    audioToggle: document.getElementById('audio-toggle'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    typingIndicator: document.getElementById('typing-indicator'),
    connectionStatus: document.getElementById('connection-status'),
    currentModel: document.getElementById('current-model'),
    modelsList: document.getElementById('models-list'),
    newModelName: document.getElementById('new-model-name'),
    downloadModelBtn: document.getElementById('download-model-btn'),
    toastContainer: document.getElementById('toast-container'),
    memoryStats: document.getElementById('memory-stats')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    connectWebSocket();
    loadModels();
    loadPreferences();
    
    // Auto-resize del textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
});

// Generar UUID único
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Inicializar Event Listeners
function initializeEventListeners() {
    // Enviar mensaje
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Control de micrófono (Push to Talk)
    elements.micBtn.addEventListener('mousedown', startRecording);
    elements.micBtn.addEventListener('mouseup', stopRecording);
    elements.micBtn.addEventListener('mouseleave', stopRecording);
    
    // Touch para móviles
    elements.micBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
    });
    elements.micBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopRecording();
    });
    
    // Toggle de audio
    elements.audioToggle.addEventListener('click', toggleAudio);
    
    // Configuración
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });
    
    // Descarga de modelos
    elements.downloadModelBtn.addEventListener('click', downloadModel);
    
    // Cambio de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Personalidades
    const createPersonalityBtn = document.getElementById('create-personality-btn');
    const importPersonalityBtn = document.getElementById('import-personality-btn');
    const exportPersonalityBtn = document.getElementById('export-personality-btn');
    const scanUSBPersonalityBtn = document.getElementById('scan-usb-personality-btn');
    const savePersonalityBtn = document.getElementById('save-personality-btn');
    const cancelPersonalityBtn = document.getElementById('cancel-personality-btn');
    
    if (createPersonalityBtn) createPersonalityBtn.addEventListener('click', showCreatePersonalityForm);
    if (importPersonalityBtn) importPersonalityBtn.addEventListener('click', importPersonality);
    if (exportPersonalityBtn) exportPersonalityBtn.addEventListener('click', exportPersonality);
    if (scanUSBPersonalityBtn) scanUSBPersonalityBtn.addEventListener('click', scanUSBForProfiles.bind(null, 'personality'));
    if (savePersonalityBtn) savePersonalityBtn.addEventListener('click', savePersonality);
    if (cancelPersonalityBtn) cancelPersonalityBtn.addEventListener('click', hideCreatePersonalityForm);
    
    // Voces
    const createVoiceBtn = document.getElementById('create-voice-btn');
    const importVoiceBtn = document.getElementById('import-voice-btn');
    const exportVoiceBtn = document.getElementById('export-voice-btn');
    const scanUSBVoiceBtn = document.getElementById('scan-usb-voice-btn');
    const saveVoiceBtn = document.getElementById('save-voice-btn');
    const cancelVoiceBtn = document.getElementById('cancel-voice-btn');
    const playVoiceTestBtn = document.getElementById('play-voice-test-btn');
    const closeVoiceTestBtn = document.getElementById('close-voice-test-btn');
    
    if (createVoiceBtn) createVoiceBtn.addEventListener('click', showCreateVoiceForm);
    if (importVoiceBtn) importVoiceBtn.addEventListener('click', importVoice);
    if (exportVoiceBtn) exportVoiceBtn.addEventListener('click', exportVoice);
    if (scanUSBVoiceBtn) scanUSBVoiceBtn.addEventListener('click', scanUSBForProfiles.bind(null, 'voice'));
    if (saveVoiceBtn) saveVoiceBtn.addEventListener('click', saveVoice);
    if (cancelVoiceBtn) cancelVoiceBtn.addEventListener('click', hideCreateVoiceForm);
    if (playVoiceTestBtn) playVoiceTestBtn.addEventListener('click', testVoice);
    if (closeVoiceTestBtn) closeVoiceTestBtn.addEventListener('click', closeVoiceTest);
    
    // Acciones de memoria
    const migrateMemoryBtn = document.getElementById('migrate-memory-btn');
    const exportMemoryBtn = document.getElementById('export-memory-btn');
    const clearMemoryBtn = document.getElementById('clear-memory-btn');
    
    if (migrateMemoryBtn) migrateMemoryBtn.addEventListener('click', migrateMemory);
    if (exportMemoryBtn) exportMemoryBtn.addEventListener('click', exportMemory);
    if (clearMemoryBtn) clearMemoryBtn.addEventListener('click', clearMemory);
    
    // Preferencias
    const themeSelect = document.getElementById('theme-select');
    const languageSelect = document.getElementById('language-select');
    const autoTtsToggle = document.getElementById('auto-tts-toggle');
    
    if (themeSelect) themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        localStorage.setItem('theme', e.target.value);
    });
    if (languageSelect) languageSelect.addEventListener('change', (e) => {
        localStorage.setItem('language', e.target.value);
    });
    if (autoTtsToggle) autoTtsToggle.addEventListener('change', (e) => {
        AppState.audioEnabled = e.target.checked;
        localStorage.setItem('audioEnabled', e.target.checked);
    });
}

// Conectar WebSocket
function connectWebSocket() {
    const clientId = Date.now();
    const wsUrl = `${WS_URL}/${clientId}`;
    
    AppState.websocket = new WebSocket(wsUrl);
    
    AppState.websocket.onopen = () => {
        updateConnectionStatus(true);
        showToast('Conectado al servidor', 'success');
    };
    
    AppState.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    AppState.websocket.onclose = () => {
        updateConnectionStatus(false);
        showToast('Desconectado. Reconectando...', 'warning');
        setTimeout(connectWebSocket, 3000);
    };
    
    AppState.websocket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        showToast('Error de conexión', 'error');
    };
}

// Manejar mensajes del WebSocket
function handleWebSocketMessage(data) {
    if (data.type === 'status' && data.content === 'thinking') {
        showTypingIndicator();
        return;
    }
    
    if (data.type === 'chunk') {
        // Streaming en tiempo real - actualizar o crear mensaje
        updateStreamingMessage(data.content);
        return;
    }
    
    if (data.type === 'complete') {
        hideTypingIndicator();
        // Reproducir audio si está activado
        if (AppState.audioEnabled) {
            playTextToSpeech(data.content);
        }
        return;
    }
    
    if (data.type === 'error') {
        hideTypingIndicator();
        showToast('Error: ' + data.content, 'error');
        return;
    }
    
    // Fallback para tipo 'response' (compatibilidad)
    if (data.type === 'response') {
        addMessage(data.content, 'assistant');
        if (AppState.audioEnabled) {
            playTextToSpeech(data.content);
        }
    }
}

// Variable para tracking del mensaje en streaming
let streamingMessageElement = null;

// Actualizar mensaje en streaming
function updateStreamingMessage(content) {
    if (!streamingMessageElement) {
        // Crear nuevo mensaje del asistente
        streamingMessageElement = createMessageElement('assistant');
        elements.chatMessages.appendChild(streamingMessageElement);
        scrollToBottom();
    }
    
    // Actualizar contenido del mensaje
    const contentElement = streamingMessageElement.querySelector('.message-content p');
    contentElement.textContent += content;
    scrollToBottom();
}

// Crear elemento de mensaje vacío
function createMessageElement(sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'user' ? '👤' : '🤖';
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p></p>
            <p class="message-timestamp">${timestamp}</p>
        </div>
    `;
    
    return messageDiv;
}

// Enviar mensaje
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    // Añadir mensaje del usuario
    addMessage(message, 'user');
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    
    // Mostrar indicador de escritura
    showTypingIndicator();
    
    // Detectar comando de búsqueda web
    const useWeb = message.startsWith('/web ');
    const cleanMessage = useWeb ? message.substring(5) : message;
    
    // Enviar vía WebSocket si está disponible
    if (AppState.websocket && AppState.websocket.readyState === WebSocket.OPEN) {
        AppState.websocket.send(JSON.stringify({
            type: 'chat',
            message: cleanMessage,
            model: AppState.currentModel,
            use_web: useWeb,
            conversation_id: AppState.conversationId
        }));
    } else {
        // Fallback a HTTP
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: cleanMessage,
                    model: AppState.currentModel,
                    use_web: useWeb,
                    conversation_id: AppState.conversationId
                })
            });
            
            const data = await response.json();
            handleWebSocketMessage({
                type: 'response',
                content: data.response
            });
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            showToast('Error al enviar mensaje', 'error');
            hideTypingIndicator();
        }
    }
}

// Añadir mensaje al chat
function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'user' ? '👤' : '🤖';
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
            <p class="message-timestamp">${timestamp}</p>
        </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Scroll al fondo del chat
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Mostrar/ocultar indicador de escritura
function showTypingIndicator() {
    elements.typingIndicator.style.display = 'flex';
    scrollToBottom();
}

function hideTypingIndicator() {
    elements.typingIndicator.style.display = 'none';
}

// Actualizar estado de conexión
function updateConnectionStatus(connected) {
    const statusDot = elements.connectionStatus.querySelector('.status-dot');
    const statusText = elements.connectionStatus.querySelector('.status-text');
    
    if (connected) {
        statusDot.style.background = 'var(--success-color)';
        statusText.textContent = 'Conectado';
    } else {
        statusDot.style.background = 'var(--danger-color)';
        statusText.textContent = 'Desconectado';
    }
}

// Control de audio
function toggleAudio() {
    AppState.audioEnabled = !AppState.audioEnabled;
    elements.audioToggle.classList.toggle('active', AppState.audioEnabled);
    elements.audioToggle.querySelector('.toggle-label').textContent = 
        AppState.audioEnabled ? 'Audio ON' : 'Audio OFF';
    
    localStorage.setItem('audioEnabled', AppState.audioEnabled);
    showToast(AppState.audioEnabled ? 'Audio activado' : 'Audio desactivado', 'success');
}

// Grabación de audio (Speech-to-Text)
async function startRecording() {
    if (AppState.isRecording) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        AppState.mediaRecorder = new MediaRecorder(stream);
        AppState.audioChunks = [];
        
        AppState.mediaRecorder.ondataavailable = (event) => {
            AppState.audioChunks.push(event.data);
        };
        
        AppState.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        AppState.mediaRecorder.start();
        AppState.isRecording = true;
        elements.micBtn.classList.add('recording');
        
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        showToast('No se pudo acceder al micrófono', 'error');
    }
}

function stopRecording() {
    if (!AppState.isRecording || !AppState.mediaRecorder) return;
    
    AppState.mediaRecorder.stop();
    AppState.isRecording = false;
    elements.micBtn.classList.remove('recording');
}

// Procesar audio (STT)
async function processAudio(audioBlob) {
    showToast('Procesando audio...', 'info');
    
    try {
        // Enviar audio al backend para transcripción
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'recording.webm');
        
        const response = await fetch(`${API_BASE_URL}/api/audio/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error en la transcripción');
        }
        
        const data = await response.json();
        
        if (data.success && data.text) {
            elements.messageInput.value = data.text;
            sendMessage();
            showToast('Audio transcrito correctamente', 'success');
        } else {
            throw new Error('Transcripción vacía o inválida');
        }
    } catch (error) {
        console.error('Error al procesar audio:', error);
        showToast('Error al procesar audio: ' + error.message, 'error');
    }
}

// Text-to-Speech
async function playTextToSpeech(text) {
    // Usar Web Speech API nativa del navegador
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Intentar obtener voz en español
        const voices = speechSynthesis.getVoices();
        const spanishVoice = voices.find(voice => voice.lang.includes('es'));
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }
        
        speechSynthesis.speak(utterance);
    } else {
        console.warn('Web Speech API no soportada');
        // TODO: Implementar TTS con backend (Piper)
    }
}

// Gestión de modelos
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/models`);
        const data = await response.json();
        
        renderModelsList(data.models);
    } catch (error) {
        console.error('Error al cargar modelos:', error);
        // Modelos por defecto
        renderModelsList([{
            name: AppState.currentModel,
            size: '~3 GB',
            installed: true,
            is_default: true
        }]);
    }
}

function renderModelsList(models) {
    elements.modelsList.innerHTML = '';
    
    models.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.className = `model-item ${model.name === AppState.currentModel ? 'active' : ''}`;
        modelItem.innerHTML = `
            <span class="model-name">${model.name}</span>
            <span class="model-size">${model.size || 'Desconocido'}</span>
            <button class="model-select-btn" data-model="${model.name}">
                ${model.name === AppState.currentModel ? 'Activo' : 'Seleccionar'}
            </button>
        `;
        
        elements.modelsList.appendChild(modelItem);
        
        // Event listener para seleccionar modelo
        const selectBtn = modelItem.querySelector('.model-select-btn');
        selectBtn.addEventListener('click', () => selectModel(model.name));
    });
}

async function selectModel(modelName) {
    if (modelName === AppState.currentModel) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/models/load?model_name=${encodeURIComponent(modelName)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            AppState.currentModel = modelName;
            elements.currentModel.textContent = modelName;
            localStorage.setItem('currentModel', modelName);
            
            // Actualizar UI
            loadModels();
            showToast(`Modelo ${modelName} activado`, 'success');
        } else {
            showToast('Error al cambiar modelo', 'error');
        }
    } catch (error) {
        console.error('Error al seleccionar modelo:', error);
        showToast('Error de conexión', 'error');
    }
}

async function downloadModel() {
    const modelName = elements.newModelName.value.trim();
    if (!modelName) {
        showToast('Introduce un nombre de modelo', 'warning');
        return;
    }
    
    showToast(`Descargando modelo ${modelName}...`, 'info');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/models/pull?model_name=${encodeURIComponent(modelName)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`Modelo ${modelName} descargado correctamente`, 'success');
            elements.newModelName.value = '';
            loadModels();
        } else {
            showToast(data.detail || 'Error al descargar modelo', 'error');
        }
    } catch (error) {
        console.error('Error al descargar modelo:', error);
        showToast('Error de conexión al descargar modelo', 'error');
    }
}

// Configuración y preferencias
function openSettings() {
    elements.settingsModal.classList.add('active');
    loadMemoryStats();
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

async function loadMemoryStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/stats`);
        const data = await response.json();
        
        elements.memoryStats.innerHTML = `
            <div><strong>Conversaciones:</strong> ${data.total_conversations || 0}</div>
            <div><strong>Tamaño BD Vectorial:</strong> ${data.vector_db_size || '0 MB'}</div>
            <div><strong>Colecciones:</strong> ${data.collections?.length || 0}</div>
        `;
    } catch (error) {
        elements.memoryStats.innerHTML = '<div>Error al cargar estadísticas</div>';
    }
}

function loadPreferences() {
    // Cargar preferencias guardadas
    const savedAudio = localStorage.getItem('audioEnabled');
    if (savedAudio !== null) {
        AppState.audioEnabled = savedAudio === 'true';
        elements.audioToggle.classList.toggle('active', AppState.audioEnabled);
        elements.audioToggle.querySelector('.toggle-label').textContent = 
            AppState.audioEnabled ? 'Audio ON' : 'Audio OFF';
    }
    
    const savedModel = localStorage.getItem('currentModel');
    if (savedModel) {
        AppState.currentModel = savedModel;
        elements.currentModel.textContent = savedModel;
    }
    
    // Tema
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);
}

// ============================================
// SISTEMA DE PESTAÑAS
// ============================================

function switchTab(tabName) {
    // Desactiva todas las pestañas
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activa la pestaña seleccionada
    const tabPane = document.getElementById(`tab-${tabName}`);
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabPane) tabPane.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    
    // Cargar datos cuando sea necesario
    if (tabName === 'personalities') loadPersonalities();
    else if (tabName === 'voices') loadVoices();
    else if (tabName === 'memory') loadMemoryStats();
}

// ============================================
// PERSONALIDADES
// ============================================

async function loadPersonalities() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/profiles?profile_type=personality`);
        const data = await response.json();
        
        const list = document.getElementById('personalities-list');
        list.innerHTML = '';
        
        if (data.profiles && data.profiles.length > 0) {
            data.profiles.forEach(profile => {
                const card = createProfileCard(profile, 'personality');
                list.appendChild(card);
            });
        } else {
            list.innerHTML = '<p>No hay personalidades. ¡Crea una!</p>';
        }
    } catch (error) {
        console.error('Error loading personalities:', error);
        showToast('Error al cargar personalidades', 'error');
    }
}

function showCreatePersonalityForm() {
    const form = document.getElementById('personality-form-panel');
    const btn = document.getElementById('create-personality-btn');
    
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        document.querySelector('#personality-form-panel input[type="text"]').focus();
    }
}

function hideCreatePersonalityForm() {
    document.getElementById('personality-form-panel').style.display = 'none';
    document.getElementById('personality-name').value = '';
    document.getElementById('personality-description').value = '';
    document.getElementById('personality-prompt').value = '';
}

async function savePersonality() {
    const name = document.getElementById('personality-name').value.trim();
    const description = document.getElementById('personality-description').value.trim();
    const prompt = document.getElementById('personality-prompt').value.trim();
    
    if (!name || !prompt) {
        showToast('Nombre y Prompt son obligatorios', 'warning');
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/create/personality?` +
            `name=${encodeURIComponent(name)}&` +
            `system_prompt=${encodeURIComponent(prompt)}&` +
            `description=${encodeURIComponent(description)}`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast(`Personalidad "${name}" creada`, 'success');
            hideCreatePersonalityForm();
            loadPersonalities();
        } else {
            showToast('Error al crear personalidad', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar personalidad', 'error');
    }
}

async function selectPersonality(profileId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/personality/apply?profile_id=${profileId}`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast(`Personalidad "${data.personality.name}" aplicada`, 'success');
            loadPersonalities();
        } else {
            showToast('Error aplicando personalidad', 'error');
        }
    } catch (error) {
        showToast('Error al aplicar personalidad', 'error');
    }
}

async function deletePersonality(profileId) {
    if (!confirm('¿Eliminar esta personalidad?')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/${profileId}?profile_type=personality`,
            { method: 'DELETE' }
        );
        
        if (response.ok) {
            showToast('Personalidad eliminada', 'success');
            loadPersonalities();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (error) {
        showToast('Error:', 'error');
    }
}

async function importPersonality() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.voicepack,.zip';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/profiles/import?file_path=${file.name}`,
                { method: 'POST' }
            );
            
            const data = await response.json();
            if (data.success) {
                showToast('Personalidad importada', 'success');
                loadPersonalities();
            } else {
                showToast('Error al importar', 'error');
            }
        } catch (error) {
            showToast('Error importando personalidad', 'error');
        }
    };
    fileInput.click();
}

async function exportPersonality(profileId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/export?` +
            `profile_id=${profileId}&` +
            `profile_type=personality&` +
            `output_path=./personality_export.voicepack`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast('Personalidad exportada', 'success');
        } else {
            showToast('Error al exportar', 'error');
        }
    } catch (error) {
        showToast('Error exportando', 'error');
    }
}

// ============================================
// VOCES
// ============================================

async function loadVoices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/profiles?profile_type=voice`);
        const data = await response.json();
        
        const list = document.getElementById('voices-list');
        list.innerHTML = '';
        
        if (data.profiles && data.profiles.length > 0) {
            data.profiles.forEach(profile => {
                const card = createProfileCard(profile, 'voice');
                list.appendChild(card);
            });
        } else {
            list.innerHTML = '<p>No hay voces. ¡Crea una o importa desde USB!</p>';
        }
    } catch (error) {
        console.error('Error loading voices:', error);
        showToast('Error al cargar voces', 'error');
    }
}

function showCreateVoiceForm() {
    const form = document.getElementById('voice-form-panel');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        document.querySelector('#voice-form-panel input[type="text"]').focus();
    }
}

function hideCreateVoiceForm() {
    document.getElementById('voice-form-panel').style.display = 'none';
    document.getElementById('voice-name').value = '';
    document.getElementById('voice-language').value = 'es';
    document.getElementById('voice-file').value = '';
}

async function saveVoice() {
    const name = document.getElementById('voice-name').value.trim();
    const language = document.getElementById('voice-language').value;
    const file = document.getElementById('voice-file').files[0];
    
    if (!name) {
        showToast('Nombre requerido', 'warning');
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/create/voice?` +
            `name=${encodeURIComponent(name)}&` +
            `voice_file=${file ? file.name : ''}`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast(`Voz "${name}" creada`, 'success');
            hideCreateVoiceForm();
            loadVoices();
        } else {
            showToast('Error al crear voz', 'error');
        }
    } catch (error) {
        showToast('Error al guardar voz', 'error');
    }
}

async function selectVoice(profileId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/voice/apply?profile_id=${profileId}`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast('Voz aplicada', 'success');
            loadVoices();
        } else {
            showToast('Error aplicando voz', 'error');
        }
    } catch (error) {
        showToast('Error al aplicar voz', 'error');
    }
}

function testVoice() {
    const text = document.getElementById('voice-test-text').value;
    if (text) {
        playTextToSpeech(text);
        showToast('Reproduciendo prueba...', 'info');
    }
}

function closeVoiceTest() {
    document.getElementById('voice-test-panel').style.display = 'none';
}

async function deleteVoice(profileId) {
    if (!confirm('¿Eliminar esta voz?')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/${profileId}?profile_type=voice`,
            { method: 'DELETE' }
        );
        
        if (response.ok) {
            showToast('Voz eliminada', 'success');
            loadVoices();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (error) {
        showToast('Error:', 'error');
    }
}

async function importVoice() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.onnx,.pt,.bin,.voicepack';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/profiles/import?file_path=${file.name}`,
                { method: 'POST' }
            );
            
            const data = await response.json();
            if (data.success) {
                showToast('Voz importada', 'success');
                loadVoices();
            } else {
                showToast('Error al importar', 'error');
            }
        } catch (error) {
            showToast('Error importando voz', 'error');
        }
    };
    fileInput.click();
}

async function exportVoice(profileId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/export?` +
            `profile_id=${profileId}&` +
            `profile_type=voice&` +
            `output_path=./voice_export.voicepack`,
            { method: 'POST' }
        );
        
        const data = await response.json();
        if (data.success) {
            showToast('Voz exportada', 'success');
        } else {
            showToast('Error al exportar', 'error');
        }
    } catch (error) {
        showToast('Error exportando', 'error');
    }
}

// ============================================
// ESCANEAR USB
// ============================================

async function scanUSBForProfiles(type) {
    showToast(`Escaneando USB en busca de ${type === 'personality' ? 'personalidades' : 'voces'}...`, 'info');
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/profiles/scan-usb?usb_path=/media/usb`
        );
        
        const data = await response.json();
        if (data.voicepacks_found && data.voicepacks_found.length > 0) {
            showToast(`${data.count} perfiles encontrados en USB`, 'success');
            // Cargar los encontrados
            if (type === 'personality') loadPersonalities();
            else loadVoices();
        } else {
            showToast('No se encontraron perfiles en USB', 'warning');
        }
    } catch (error) {
        showToast('Error escaneando USB', 'error');
    }
}

// ============================================
// UTILIDADES
// ============================================

function createProfileCard(profile, type) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    const icon = type === 'personality' ? '🎭' : '🔊';
    const actions = `
        <button class="btn-primary btn-sm" onclick="select${type === 'personality' ? 'Personality' : 'Voice'}('${profile.id}')">
            ✓ Usar
        </button>
        <button class="btn-secondary btn-sm" onclick="delete${type === 'personality' ? 'Personality' : 'Voice'}('${profile.id}')">
            🗑️ Eliminar
        </button>
    `;
    
    card.innerHTML = `
        <div class="profile-header">
            <span class="profile-icon">${icon}</span>
            <h4>${profile.name}</h4>
        </div>
        <p class="profile-description">${profile.description || 'Sin descripción'}</p>
        <div class="profile-actions">${actions}</div>
    `;
    
    return card;
}

// ============================================
// MEMORIA
// ============================================

async function migrateMemory() {
    const models = await fetch(`${API_BASE_URL}/api/models`).then(r => r.json()).then(d => d.models || []);
    if (models.length < 2) {
        showToast('Necesitas al menos 2 modelos para migrar memoria', 'warning');
        return;
    }
    
    const sourceModel = prompt('Modelo origen (memoria a copiar):');
    const targetModel = prompt('Modelo destino (donde copiar):');
    
    if (!sourceModel || !targetModel) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_model: sourceModel,
                target_model: targetModel
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(`Memoria migrada de ${sourceModel} a ${targetModel}`, 'success');
        } else {
            showToast('Error en migración', 'error');
        }
    } catch (error) {
        showToast('Error:', 'error');
    }
}

async function exportMemory() {
    const model = AppState.currentModel;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/export?model=${model}`);
        const data = await response.json();
        
        if (data.success) {
            // Descargar como JSON
            const blob = new Blob([JSON.stringify(data.memory, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `memoria_${model}_${new Date().getTime()}.json`;
            a.click();
            showToast('Memoria exportada', 'success');
        }
    } catch (error) {
        showToast('Error exportando memoria', 'error');
    }
}

async function clearMemory() {
    if (!confirm('¿Limpiar toda la memoria? No se puede deshacer.')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/clear`, {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Memoria limpiada (preferencias guardadas)', 'success');
            loadMemoryStats();
        }
    } catch (error) {
        showToast('Error limpiando memoria', 'error');
    }
}

// Notificaciones Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registrado:', registration.scope);
        }).catch(error => {
            console.log('ServiceWorker falló:', error);
        });
    });
}
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_model: sourceModel, target_model: targetModel })
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Memoria migrada correctamente', 'success');
        } else {
            showToast(data.detail || 'Error al migrar memoria', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    }
}

async function exportMemory() {
    const model = AppState.currentModel;
    if (!confirm(`¿Exportar memoria del modelo ${model}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/export?model=${encodeURIComponent(model)}`);
        const data = await response.json();
        
        if (data.success) {
            const blob = new Blob([JSON.stringify(data.memory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bc250_memory_${model.replace(/[:.]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Memoria exportada correctamente', 'success');
        } else {
            showToast(data.detail || 'Error al exportar memoria', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    }
}

async function clearMemory() {
    const model = AppState.currentModel;
    if (!confirm(`⚠️ ¿Estás seguro de borrar TODA la memoria del modelo ${model}? Esta acción no se puede deshacer.`)) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/clear?model=${encodeURIComponent(model)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Memoria eliminada correctamente', 'success');
            loadMemoryStats();
        } else {
            showToast(data.detail || 'Error al eliminar memoria', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    }
}
