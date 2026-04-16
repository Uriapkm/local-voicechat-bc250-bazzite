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

// Función de utilidad para escapar HTML y prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
    
    // Sincronizar el checkbox de TTS con el estado cargado
    const autoTtsCheckbox = document.getElementById('auto-tts-toggle');
    if (autoTtsCheckbox) {
        autoTtsCheckbox.checked = AppState.audioEnabled;
    }
    
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
        // Reproducir audio si está activado
        if (AppState.audioEnabled && data.content) {
            playResponseAudio(data.content);
        }
    } else if (data.type === 'response') {
        addMessage(data.content, 'assistant');
        // Reproducir audio si está activado (para respuestas no-streaming)
        if (AppState.audioEnabled && data.content) {
            playResponseAudio(data.content);
        }
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
        
        // Actualizar el indicador del modelo actual en la UI
        const currentModelElement = document.getElementById('current-model');
        if (currentModelElement) {
            currentModelElement.textContent = name;
        }
        
        loadModels();
        showToast(`Modelo cambiado a: ${name}`, 'success');
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
    const savedModel = localStorage.getItem('currentModel');
    if (savedModel) AppState.currentModel = savedModel;
    
    // Cargar preferencia de audio
    const savedAudio = localStorage.getItem('audioEnabled');
    if (savedAudio !== null) {
        AppState.audioEnabled = savedAudio === 'true';
    }
    
    // Actualizar el indicador del modelo actual en la UI
    const currentModelElement = document.getElementById('current-model');
    if (currentModelElement && AppState.currentModel) {
        currentModelElement.textContent = AppState.currentModel;
    }
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
        if (!list) return;
        
        list.innerHTML = '';
        
        if (!data.profiles || data.profiles.length === 0) {
            list.innerHTML = '<p class="empty-list">No hay personalidades guardadas</p>';
            return;
        }
        
        data.profiles.forEach(profile => {
            const div = document.createElement('div');
            div.className = 'profile-item';
            div.innerHTML = `
                <div class="profile-header">
                    <span class="profile-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-type-badge">Personalidad</span>
                </div>
                <p class="profile-description">${escapeHtml(profile.description || 'Sin descripción')}</p>
                <div class="profile-actions">
                    <button onclick="selectPersonality('${profile.id}')" class="btn-apply">Aplicar</button>
                    <button onclick="exportPersonality('${profile.id}')" class="btn-export">Exportar</button>
                    <button onclick="deletePersonality('${profile.id}')" class="btn-delete">Eliminar</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.error('Error loading personalities:', e);
        showToast('Error cargando personalidades', 'error');
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
    const nameInput = document.getElementById('personality-name');
    const descInput = document.getElementById('personality-description');
    const promptInput = document.getElementById('personality-prompt');
    const toneSelect = document.getElementById('personality-tone');
    const langSelect = document.getElementById('personality-language');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const system_prompt = promptInput ? promptInput.value.trim() : '';
    const tone = toneSelect ? toneSelect.value : 'friendly';
    const language = langSelect ? langSelect.value : 'es';
    
    if (!name) {
        showToast('El nombre es obligatorio', 'error');
        return;
    }
    
    if (!system_prompt) {
        showToast('El system prompt es obligatorio', 'error');
        return;
    }
    
    try {
        const params = new URLSearchParams();
        params.append('name', name);
        params.append('description', description);
        params.append('system_prompt', system_prompt);
        params.append('tone', tone);
        params.append('language', language);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/create/personality?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('Personalidad creada exitosamente', 'success');
            hideCreatePersonalityForm();
            loadPersonalities();
            
            // Limpiar formulario
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            if (promptInput) promptInput.value = '';
        } else {
            showToast('Error al crear personalidad', 'error');
        }
    } catch (e) {
        console.error('Error saving personality:', e);
        showToast('Error al guardar personalidad', 'error');
    }
}

async function selectPersonality(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles/personality/apply?profile_id=${encodeURIComponent(id)}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Personalidad "${data.personality?.name || id}" aplicada`, 'success');
            loadPersonalities();
        } else {
            showToast('Error al aplicar personalidad', 'error');
        }
    } catch (e) {
        console.error('Error selecting personality:', e);
        showToast('Error al seleccionar personalidad', 'error');
    }
}

async function deletePersonality(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta personalidad?')) {
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles/${encodeURIComponent(id)}?profile_type=personality`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('Personalidad eliminada', 'success');
            loadPersonalities();
        } else {
            showToast('Error al eliminar personalidad', 'error');
        }
    } catch (e) {
        console.error('Error deleting personality:', e);
        showToast('Error al eliminar personalidad', 'error');
    }
}

async function exportPersonality(id) {
    const outputPath = prompt('Ruta de salida para el archivo .voicepack:', `/tmp/${id}_personality.voicepack`);
    
    if (!outputPath) return;
    
    try {
        const params = new URLSearchParams();
        params.append('profile_id', id);
        params.append('profile_type', 'personality');
        params.append('output_path', outputPath);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/export?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Personalidad exportada a ${outputPath}`, 'success');
        } else {
            showToast('Error al exportar personalidad', 'error');
        }
    } catch (e) {
        console.error('Error exporting personality:', e);
        showToast('Error al exportar personalidad', 'error');
    }
}

async function importPersonality() {
    const filePath = prompt('Ruta del archivo .voicepack a importar:');
    
    if (!filePath) return;
    
    try {
        const params = new URLSearchParams();
        params.append('file_path', filePath);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/import?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Personalidad "${data.profile?.name}" importada exitosamente`, 'success');
            loadPersonalities();
        } else {
            showToast('Error al importar personalidad', 'error');
        }
    } catch (e) {
        console.error('Error importing personality:', e);
        showToast('Error al importar personalidad', 'error');
    }
}

async function loadVoices() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles?profile_type=voice`);
        const data = await res.json();
        const list = document.getElementById('voices-list');
        if (!list) return;
        
        // Obtener la voz actualmente seleccionada
        const currentVoiceId = localStorage.getItem('currentVoice');
        
        list.innerHTML = '';
        
        if (!data.profiles || data.profiles.length === 0) {
            list.innerHTML = '<p class="empty-list">No hay voces guardadas</p>';
            return;
        }
        
        data.profiles.forEach(profile => {
            const div = document.createElement('div');
            div.className = 'profile-item';
            // Marcar visualmente la voz seleccionada
            if (profile.id === currentVoiceId) {
                div.classList.add('selected');
            }
            div.innerHTML = `
                <div class="profile-header">
                    <span class="profile-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-type-badge">Voz TTS</span>
                </div>
                <p class="profile-description">${escapeHtml(profile.description || 'Sin descripción')}</p>
                <div class="profile-actions">
                    <button onclick="selectVoice('${profile.id}')" class="btn-apply">Aplicar</button>
                    <button onclick="testVoice('${profile.id}')" class="btn-test">Probar</button>
                    <button onclick="exportVoice('${profile.id}')" class="btn-export">Exportar</button>
                    <button onclick="deleteVoice('${profile.id}')" class="btn-delete">Eliminar</button>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Cargar información del motor TTS
        loadTTSEngineInfo();
    } catch (e) {
        console.error('Error loading voices:', e);
        showToast('Error cargando voces', 'error');
    }
}

async function loadTTSEngineInfo() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/system/status`);
        const data = await res.json();
        const infoPanel = document.getElementById('tts-engine-info');
        
        if (infoPanel) {
            infoPanel.innerHTML = `
                <div class="engine-status">
                    <strong>Estado TTS:</strong> 
                    <span class="status-${data.tts ? 'active' : 'inactive'}">
                        ${data.tts ? 'Disponible' : 'No disponible'}
                    </span>
                </div>
                ${data.tts_engines ? `<div class="engine-details">${JSON.stringify(data.tts_engines)}</div>` : ''}
            `;
        }
    } catch (e) {
        console.error('Error loading TTS engine info:', e);
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
    const nameInput = document.getElementById('voice-name');
    const descInput = document.getElementById('voice-description');
    const voiceFileInput = document.getElementById('voice-file');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const voice_file = voiceFileInput ? voiceFileInput.value.trim() : '';
    
    if (!name) {
        showToast('El nombre es obligatorio', 'error');
        return;
    }
    
    try {
        const params = new URLSearchParams();
        params.append('name', name);
        params.append('description', description);
        if (voice_file) {
            params.append('voice_file', voice_file);
        }
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/create/voice?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('Voz creada exitosamente', 'success');
            hideCreateVoiceForm();
            loadVoices();
            
            // Limpiar formulario
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            if (voiceFileInput) voiceFileInput.value = '';
        } else {
            showToast('Error al crear voz', 'error');
        }
    } catch (e) {
        console.error('Error saving voice:', e);
        showToast('Error al guardar voz', 'error');
    }
}

async function selectVoice(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles/voice/apply?profile_id=${encodeURIComponent(id)}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Guardar la voz seleccionada en localStorage
            localStorage.setItem('currentVoice', id);
            showToast('Voz aplicada al sistema TTS', 'success');
            loadVoices();
        } else {
            showToast('Error al aplicar voz', 'error');
        }
    } catch (e) {
        console.error('Error selecting voice:', e);
        showToast('Error al seleccionar voz', 'error');
    }
}

async function deleteVoice(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta voz?')) {
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/profiles/${encodeURIComponent(id)}?profile_type=voice`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('Voz eliminada', 'success');
            loadVoices();
        } else {
            showToast('Error al eliminar voz', 'error');
        }
    } catch (e) {
        console.error('Error deleting voice:', e);
        showToast('Error al eliminar voz', 'error');
    }
}

async function exportVoice(id) {
    const outputPath = prompt('Ruta de salida para el archivo .voicepack:', `/tmp/${id}_voice.voicepack`);
    
    if (!outputPath) return;
    
    try {
        const params = new URLSearchParams();
        params.append('profile_id', id);
        params.append('profile_type', 'voice');
        params.append('output_path', outputPath);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/export?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Voz exportada a ${outputPath}`, 'success');
        } else {
            showToast('Error al exportar voz', 'error');
        }
    } catch (e) {
        console.error('Error exporting voice:', e);
        showToast('Error al exportar voz', 'error');
    }
}

async function importVoice() {
    const filePath = prompt('Ruta del archivo .voicepack a importar:');
    
    if (!filePath) return;
    
    try {
        const params = new URLSearchParams();
        params.append('file_path', filePath);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/import?${params.toString()}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Voz "${data.profile?.name}" importada exitosamente`, 'success');
            loadVoices();
        } else {
            showToast('Error al importar voz', 'error');
        }
    } catch (e) {
        console.error('Error importing voice:', e);
        showToast('Error al importar voz', 'error');
    }
}

async function testVoice(id) {
    const textToTest = prompt('Texto para probar la voz:', 'Hola, esta es una prueba de síntesis de voz.');
    
    if (!textToTest) return;
    
    try {
        const params = new URLSearchParams();
        params.append('text', textToTest);
        if (id) {
            params.append('voice', id);
        }
        
        // Primero sintetizar el audio
        const res = await fetch(`${API_BASE_URL}/api/audio/synthesize?${params.toString()}`, {
            method: 'POST'
        });
        
        if (!res.ok) {
            throw new Error('Error en síntesis de audio');
        }
        
        // Obtener el blob de audio
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Reproducir el audio
        const audio = new Audio(audioUrl);
        audio.play();
        
        showToast('Reproduciendo prueba de voz...', 'info');
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
    } catch (e) {
        console.error('Error testing voice:', e);
        showToast('Error al probar la voz', 'error');
    }
}

/**
 * Reproduce la respuesta de audio del asistente
 * @param {string} text - Texto a convertir a voz
 */
async function playResponseAudio(text) {
    if (!AppState.audioEnabled || !text) return;
    
    try {
        // Obtener la voz actual si está configurada
        const currentVoice = localStorage.getItem('currentVoice');
        
        const params = new URLSearchParams();
        params.append('text', text);
        if (currentVoice) {
            params.append('voice', currentVoice);
        }
        
        // Sintetizar audio
        const res = await fetch(`${API_BASE_URL}/api/audio/synthesize?${params.toString()}`, {
            method: 'POST'
        });
        
        if (!res.ok) {
            console.warn('No se pudo sintetizar el audio');
            return;
        }
        
        // Obtener blob y reproducir
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.play();
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (e) => {
            console.error('Error reproduciendo audio:', e);
        };
    } catch (e) {
        console.error('Error en reproducción de audio:', e);
    }
}

function closeVoiceTest() {
    const p = document.getElementById('voice-test-panel');
    if (p) p.style.display = 'none';
}

async function scanUSBForProfiles(type) {
    const usbPath = prompt('Ruta del dispositivo USB a escanear:', '/media/usb');
    
    if (!usbPath) return;
    
    try {
        const params = new URLSearchParams();
        params.append('usb_path', usbPath);
        
        const res = await fetch(`${API_BASE_URL}/api/profiles/scan-usb?${params.toString()}`);
        const data = await res.json();
        
        if (data.voicepacks_found && data.voicepacks_found.length > 0) {
            let message = `Se encontraron ${data.count} archivo(s) .voicepack en ${usbPath}:\n\n`;
            data.voicepacks_found.forEach((file, i) => {
                message += `${i + 1}. ${file}\n`;
            });
            alert(message);
            showToast(`USB escaneado: ${data.count} voicepack(s) encontrado(s)`, 'success');
        } else {
            showToast(`No se encontraron archivos .voicepack en ${usbPath}`, 'info');
        }
    } catch (e) {
        console.error('Error scanning USB:', e);
        showToast('Error al escanear USB', 'error');
    }
}

async function migrateMemory() {
    const sourceModel = prompt('Modelo de origen (ej: gemma4:e4b):', AppState.currentModel);
    
    if (!sourceModel) return;
    
    const targetModel = prompt('Modelo de destino (ej: llama3.2):', '');
    
    if (!targetModel) {
        showToast('Modelo de destino es requerido', 'error');
        return;
    }
    
    if (sourceModel === targetModel) {
        showToast('Los modelos de origen y destino deben ser diferentes', 'error');
        return;
    }
    
    if (!confirm(`¿Migrar memoria de "${sourceModel}" a "${targetModel}"?`)) {
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/memory/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_model: sourceModel,
                target_model: targetModel
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast(`Memoria migrada de ${sourceModel} a ${targetModel}`, 'success');
        } else {
            showToast('Error al migrar memoria', 'error');
        }
    } catch (e) {
        console.error('Error migrating memory:', e);
        showToast('Error al migrar memoria', 'error');
    }
}

async function exportMemory() {
    const model = prompt('Modelo del cual exportar memoria (dejar vacío para el actual):', AppState.currentModel);
    
    try {
        const params = new URLSearchParams();
        if (model) {
            params.append('model', model.trim());
        }
        
        const res = await fetch(`${API_BASE_URL}/api/memory/export?${params.toString()}`);
        const data = await res.json();
        
        if (data.success && data.memory) {
            // Crear blob JSON y descargar
            const jsonString = JSON.stringify(data.memory, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `memory_${(model || AppState.currentModel).replace(/[:\/]/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast(`Memoria exportada exitosamente`, 'success');
        } else {
            showToast('Error al exportar memoria', 'error');
        }
    } catch (e) {
        console.error('Error exporting memory:', e);
        showToast('Error al exportar memoria', 'error');
    }
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

