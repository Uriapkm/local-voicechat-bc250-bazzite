/**
 * BC-250 AI Companion - Lógica del Frontend
 * Gestiona la interfaz de usuario, comunicación con el backend y funcionalidades de voz
 */

// Configuración global
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
    
    // Acciones de memoria
    const migrateMemoryBtn = document.getElementById('migrate-memory-btn');
    const exportMemoryBtn = document.getElementById('export-memory-btn');
    const clearMemoryBtn = document.getElementById('clear-memory-btn');
    
    if (migrateMemoryBtn) migrateMemoryBtn.addEventListener('click', migrateMemory);
    if (exportMemoryBtn) exportMemoryBtn.addEventListener('click', exportMemory);
    if (clearMemoryBtn) clearMemoryBtn.addEventListener('click', clearMemory);
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

function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
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

// Funciones de gestión de memoria
async function migrateMemory() {
    const models = await fetch(`${API_BASE_URL}/api/models`).then(r => r.json()).then(d => d.models || []);
    if (models.length < 2) {
        showToast('Necesitas al menos 2 modelos para migrar memoria', 'warning');
        return;
    }
    
    const sourceModel = prompt(`Modelos disponibles: ${models.map(m => m.name).join(', ')}\n\nIntroduce el modelo de ORIGEN:`);
    if (!sourceModel) return;
    
    const targetModel = prompt(`Introduce el modelo de DESTINO:`);
    if (!targetModel) return;
    
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
