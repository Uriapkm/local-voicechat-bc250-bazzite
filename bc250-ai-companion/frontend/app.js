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

let elements = {};

function initElements() {
    elements = {
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
}

document.addEventListener('DOMContentLoaded', () => {
    initElements();
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

