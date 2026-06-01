// ==================== CONFIGURACIÓN FIREBASE (SEGURA) ====================
// ⚠️ IMPORTANTE: Las credenciales se cargan desde variables de entorno
// NUNCA hardcodees credenciales en el código

let firebaseConfig = null;
let db = null;

async function initializeFirebaseSecurely() {
  try {
    // Usar variables de entorno - NO hardcodees aquí
    firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID
    };

    // Validar que existan variables de entorno
    if (!firebaseConfig.apiKey) {
      throw new Error('Firebase no está configurado - Usa variables de entorno');
    }

    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    
    console.log('✅ Firebase inicializado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    return false;
  }
}

// ==================== VARIABLES GLOBALES ====================
let productos = [];
let tasaCambio = 3.5;
let usuarioActual = null;
let currentInventoryOwner = null;
let currentPermission = "edit";
let unsubscribeInventory = null;
let adminObservingUser = null;

// EmailJS - Desde variables de entorno
const EMAILJS_CONFIG = {
  serviceId: process.env.VITE_EMAILJS_SERVICE_ID,
  templateId: process.env.VITE_EMAILJS_TEMPLATE_ID,
  publicKey: process.env.VITE_EMAILJS_PUBLIC_KEY
};

// ==================== DOM ELEMENTS ====================
const authMessage = document.getElementById('authMessage');
const recoveryMessage = document.getElementById('recoveryMessage');
const regMessage = document.getElementById('regMessage');
const appMessage = document.getElementById('appMessage');
const appSection = document.getElementById('appSection');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const recoverySection = document.getElementById('recoverySection');
const loggedUserSpan = document.getElementById('loggedUser');
const addProductArea = document.getElementById('addProductArea');
const productInputs = document.getElementById('productInputs');
const inventorySection = document.getElementById('inventorySection');
const summarySection = document.getElementById('summarySection');
const inventoryList = document.getElementById('inventoryList');
const summaryList = document.getElementById('summaryList');
const totalSolesSpan = document.getElementById('totalSoles');
const totalUsdSpan = document.getElementById('totalUsd');
const inventoryTitle = document.getElementById('inventoryTitle');
const shareSectionDiv = document.getElementById('shareSection');
const collaboratorsListP = document.getElementById('collaboratorsList');
const inventorySelectorGroup = document.getElementById('inventorySelectorGroup');
const inventorySelect = document.getElementById('inventorySelect');
const leaveSharedBtn = document.getElementById('leaveSharedBtn');
const adminPanelDiv = document.getElementById('adminPanel');
const userListAdminDiv = document.getElementById('userListAdmin');
const notificationsPanel = document.getElementById('notificationsPanel');
const notificationsList = document.getElementById('notificationsList');
const notificationBadge = document.getElementById('notificationBadge');
const notificationsBtn = document.getElementById('notificationsBtn');
const movementHistoryDiv = document.getElementById('movementHistory');

// Inputs
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const recoveryEmailInput = document.getElementById('recoveryEmail');
const recoveryCodeInput = document.getElementById('recoveryCode');
const newPasswordInput = document.getElementById('newPassword');
const resetArea = document.getElementById('resetArea');
const newPasswordArea = document.getElementById('newPasswordArea');
const verifyBtnArea = document.getElementById('verifyBtnArea');
const productCountInput = document.getElementById('productCount');
const exchangeRateInput = document.getElementById('exchangeRate');

// Botones
const loginBtn = document.getElementById('loginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const confirmRegisterBtn = document.getElementById('confirmRegisterBtn');
const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const cancelRecoveryBtn = document.getElementById('cancelRecoveryBtn');
const sendRecoveryBtn = document.getElementById('sendRecoveryBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const startAddBtn = document.getElementById('startAddBtn');
const saveProductsBtn = document.getElementById('saveProductsBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const showInventoryBtn = document.getElementById('showInventoryBtn');
const showSummaryBtn = document.getElementById('showSummaryBtn');
const addCollaboratorBtn = document.getElementById('addCollaboratorBtn');
const manageCollaboratorsBtn = document.getElementById('manageCollaboratorsBtn');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');

// Modal
const modalOverlay = document.getElementById('masterPasswordModal');
const mainContent = document.getElementById('mainContent');
const footer = document.getElementById('footer');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const masterPasswordInput = document.getElementById('masterPasswordInput');
const submitMasterPasswordBtn = document.getElementById('submitMasterPasswordBtn');
const masterPasswordError = document.getElementById('masterPasswordError');

// ==================== RATE LIMITING ====================
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.attempts = {};
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(key) {
    const now = Date.now();
    if (!this.attempts[key]) {
      this.attempts[key] = [];
    }

    // Limpiar intentos antiguos
    this.attempts[key] = this.attempts[key].filter(timestamp => now - timestamp < this.windowMs);

    if (this.attempts[key].length >= this.maxAttempts) {
      return true;
    }

    this.attempts[key].push(now);
    return false;
  }

  reset(key) {
    delete this.attempts[key];
  }
}

const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);
const registroLimiter = new RateLimiter(3, 60 * 60 * 1000);
const recoveryLimiter = new RateLimiter(3, 24 * 60 * 60 * 1000);

// ==================== VALIDACIÓN & SANITIZACIÓN ====================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function validarEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validarUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_\-]{3,20}$/;
  return usernameRegex.test(username);
}

function validarPassword(password) {
  return password.length >= 6 && password.length <= 128;
}

// ==================== HASH SEGURO ====================
async function hashPassword(password) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Crypto API no disponible');
  }
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashStr = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltStr}:${hashStr}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return newHash === hash;
  } catch (e) {
    return false;
  }
}

// ==================== GENERADORES SEGUROS ====================
function generateSecureToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRecoveryCode() {
  const array = crypto.getRandomValues(new Uint8Array(3));
  return Array.from(array).map(b => b % 10).join('').padStart(6, '0');
}

function generateUniqueId() {
  return `${Date.now()}-${generateSecureToken().substring(0, 16)}`;
}

// ==================== FUNCIONES DE UTILIDAD ====================
function mostrarMensaje(element, texto, color = '#dc2626') {
  if (!element) return;
  element.textContent = escapeHtml(texto);
  element.style.color = color;
  setTimeout(() => {
    if (element.textContent === escapeHtml(texto)) element.textContent = '';
  }, 5000);
}

// ==================== MASTER PASSWORD ====================
async function setMasterPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mínimo 6 caracteres');
  }
  if (newPassword.length > 128) {
    throw new Error('Máximo 128 caracteres');
  }
  
  const hash = await hashPassword(newPassword);
  await db.collection("config_sistema").doc("clave_maestra").set({ 
    hash: hash,
    updatedAt: new Date().toISOString()
  });
  return true;
}

async function verifyMasterPassword(password) {
  try {
    const doc = await db.collection("config_sistema").doc("clave_maestra").get();
    if (!doc.exists) return false;
    return await verifyPassword(password, doc.data().hash);
  } catch (e) {
    return false;
  }
}

async function handleMasterPasswordFlow() {
  await ensureAdminUser();
  const doc = await db.collection("config_sistema").doc("clave_maestra").get();
  
  if (!doc.exists) {
    const tempPassword = generateSecureToken().substring(0, 12);
    await setMasterPassword(tempPassword);
    console.warn('⚠️ CONTRASEÑA MAESTRA TEMPORAL:', tempPassword);
  }

  submitMasterPasswordBtn.onclick = async () => {
    const pass = masterPasswordInput.value;
    if (!pass) return;
    
    if (await verifyMasterPassword(pass)) {
      modalOverlay.style.display = 'none';
      mainContent.style.display = 'block';
      if (footer) footer.style.display = 'block';
      masterPasswordInput.value = '';
      initApp();
    } else {
      masterPasswordError.textContent = 'Contraseña incorrecta.';
    }
  };
}

// ==================== AUTENTICACIÓN ====================
async function iniciarSesion() {
  const nombreRaw = usernameInput.value.trim();
  const nombre = nombreRaw.toLowerCase();
  const contrasena = passwordInput.value.trim();

  if (loginLimiter.isLimited(nombre)) {
    return mostrarMensaje(authMessage, 'Demasiados intentos. Intenta en 15 minutos.');
  }

  if (!nombre || !contrasena) {
    return mostrarMensaje(authMessage, 'Ingresa usuario y contraseña.');
  }

  if (!validarUsername(nombre)) {
    return mostrarMensaje(authMessage, 'Usuario inválido');
  }

  try {
    let usuario = null;
    let userId = null;

    let userDoc = await db.collection("usuarios").doc(nombre).get();
    if (userDoc.exists) {
      usuario = userDoc.data();
      userId = userDoc.id;
    } else {
      const snapshot = await db.collection("usuarios").where("email", "==", nombre.toLowerCase()).get();
      if (!snapshot.empty) {
        usuario = snapshot.docs[0].data();
        userId = snapshot.docs[0].id;
      }
    }

    if (!usuario) {
      loginLimiter.reset(nombre);
      return mostrarMensaje(authMessage, 'Usuario no existe.');
    }

    const passwordValid = await verifyPassword(contrasena, usuario.passwordHash);
    if (!passwordValid) {
      return mostrarMensaje(authMessage, 'Contraseña incorrecta.');
    }

    loginLimiter.reset(nombre);
    usuarioActual = userId;
    currentInventoryOwner = null;
    currentPermission = "edit";
    
    usernameInput.value = '';
    passwordInput.value = '';
    
    await mostrarApp(usuarioActual);
    mostrarMensaje(appMessage, `¡Bienvenido, ${escapeHtml(usuarioActual)}!`, '#16a34a');
  } catch (error) {
    console.error('Error en login:', error);
    mostrarMensaje(authMessage, 'Error en el sistema. Intenta más tarde.');
  }
}

async function registrarUsuario() {
  const nombreRaw = regUsername.value.trim();
  const nombre = nombreRaw.toLowerCase();
  const email = regEmail.value.trim().toLowerCase();
  const contrasena = regPassword.value.trim();

  if (registroLimiter.isLimited('registro')) {
    return mostrarMensaje(regMessage, 'Demasiados registros. Intenta mañana.');
  }

  if (!nombre || !email || !contrasena) {
    return mostrarMensaje(regMessage, 'Completa todos los campos.');
  }

  if (!validarUsername(nombre)) {
    return mostrarMensaje(regMessage, 'Usuario: 3-20 caracteres (letras, números, _, -)');
  }

  if (nombre === 'admin') {
    return mostrarMensaje(regMessage, 'Nombre "admin" está reservado.');
  }

  if (!validarPassword(contrasena)) {
    return mostrarMensaje(regMessage, 'Contraseña: 6-128 caracteres.');
  }

  if (!validarEmail(email)) {
    return mostrarMensaje(regMessage, 'Correo inválido.');
  }

  try {
    const userDoc = await db.collection("usuarios").doc(nombre).get();
    if (userDoc.exists) {
      return mostrarMensaje(regMessage, 'El usuario ya existe.');
    }

    const emailCheck = await db.collection("usuarios").where("email", "==", email).get();
    if (!emailCheck.empty) {
      return mostrarMensaje(regMessage, 'El correo ya está registrado.');
    }

    const passwordHash = await hashPassword(contrasena);
    await db.collection("usuarios").doc(nombre).set({
      nombre,
      email,
      passwordHash,
      resetCodeHash: '',
      resetExpires: 0,
      createdAt: new Date().toISOString()
    });

    await savePersonalInventory(nombre, []);
    
    regUsername.value = '';
    regEmail.value = '';
    regPassword.value = '';
    
    mostrarMensaje(regMessage, '✅ Registro exitoso. Inicia sesión.', '#16a34a');
    setTimeout(() => mostrarLoginForm(), 2000);
  } catch (error) {
    console.error('Error en registro:', error);
    mostrarMensaje(regMessage, 'Error al guardar');
  }
}

// ==================== RECUPERACIÓN SEGURA ====================
sendRecoveryBtn.addEventListener('click', async () => {
  const email = recoveryEmailInput.value.trim().toLowerCase();

  if (recoveryLimiter.isLimited(email)) {
    return mostrarMensaje(recoveryMessage, 'Demasiados intentos. Intenta mañana.');
  }

  if (!validarEmail(email)) {
    return mostrarMensaje(recoveryMessage, 'Correo inválido.');
  }

  try {
    const snapshot = await db.collection("usuarios").where("email", "==", email).get();
    if (snapshot.empty) {
      return mostrarMensaje(recoveryMessage, 'Si existe, recibirás un código.', '#16a34a');
    }

    const docRef = snapshot.docs[0].ref;
    const usuario = snapshot.docs[0].data();
    const codigo = generateRecoveryCode();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const codeHash = await hashPassword(codigo);

    await docRef.update({ resetCodeHash: codeHash, resetExpires: expiresAt });

    resetArea.classList.remove('hidden');
    newPasswordArea.classList.remove('hidden');
    verifyBtnArea.classList.remove('hidden');

    const enviado = await sendRecoveryEmail(email, usuario.nombre, codigo);
    if (enviado) {
      mostrarMensaje(recoveryMessage, `📧 Código enviado a ${escapeHtml(email)}.`, '#16a34a');
    }
  } catch (error) {
    console.error('Error en recuperación:', error);
    mostrarMensaje(recoveryMessage, 'Error del sistema.');
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const email = recoveryEmailInput.value.trim().toLowerCase();
  const codigo = recoveryCodeInput.value.trim();
  const nuevaPass = newPasswordInput.value.trim();

  if (!codigo || !nuevaPass) {
    return mostrarMensaje(recoveryMessage, 'Completa código y nueva contraseña.');
  }

  if (!validarPassword(nuevaPass)) {
    return mostrarMensaje(recoveryMessage, 'Contraseña: 6-128 caracteres.');
  }

  try {
    const snapshot = await db.collection("usuarios").where("email", "==", email).get();
    if (snapshot.empty) {
      return mostrarMensaje(recoveryMessage, 'Correo no registrado.');
    }

    const docRef = snapshot.docs[0].ref;
    const usuario = snapshot.docs[0].data();
    const now = Date.now();

    if (now > usuario.resetExpires) {
      await docRef.update({ resetCodeHash: '', resetExpires: 0 });
      return mostrarMensaje(recoveryMessage, 'Código expirado.');
    }

    const codeValid = await verifyPassword(codigo, usuario.resetCodeHash);
    if (!codeValid) {
      return mostrarMensaje(recoveryMessage, 'Código incorrecto.');
    }

    const newHash = await hashPassword(nuevaPass);
    await docRef.update({ passwordHash: newHash, resetCodeHash: '', resetExpires: 0 });

    mostrarMensaje(recoveryMessage, '✅ Contraseña actualizada.', '#16a34a');
    recoveryEmailInput.value = '';
    recoveryCodeInput.value = '';
    newPasswordInput.value = '';
    
    setTimeout(() => mostrarLoginForm(), 2000);
  } catch (error) {
    console.error('Error verificando código:', error);
    mostrarMensaje(recoveryMessage, 'Error del sistema.');
  }
});

// ==================== EMAIL ====================
function initEmailJS() {
  if (!EMAILJS_CONFIG.publicKey) {
    console.warn('⚠️ EmailJS no configurado');
    return false;
  }

  if (window.emailjs) {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
    return true;
  }
  return false;
}

async function sendRecoveryEmail(email, username, code) {
  if (!initEmailJS()) return false;

  try {
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        to_email: escapeHtml(email),
        username: escapeHtml(username),
        reset_code: code
      }
    );
    return true;
  } catch (e) {
    console.error('Error enviando email:', e);
    return false;
  }
}

// ==================== INVENTARIO ====================
async function savePersonalInventory(username, inventory) {
  if (!username || username.length > 20) throw new Error('Username inválido');
  await db.collection("inventarios").doc(username).set({
    productos: inventory,
    updatedAt: new Date().toISOString()
  });
}

async function registrarMovimiento(owner, tipo, producto, detalle) {
  const tiposValidos = ['agregar', 'modificar', 'eliminar'];
  if (!tiposValidos.includes(tipo)) throw new Error('Tipo inválido');

  await db.collection("movimientos").add({
    owner: escapeHtml(owner),
    id: generateUniqueId(),
    fecha: new Date().toISOString(),
    tipo,
    producto: escapeHtml(producto),
    detalle: escapeHtml(detalle)
  });
}

async function ensureAdminUser() {
  const adminDoc = await db.collection("usuarios").doc("admin").get();
  if (!adminDoc.exists) {
    const hash = await hashPassword('admin123');
    await db.collection("usuarios").doc("admin").set({
      nombre: 'admin',
      email: 'admin@inventario.pe',
      passwordHash: hash,
      resetCodeHash: '',
      resetExpires: 0,
      createdAt: new Date().toISOString()
    });
    await savePersonalInventory('admin', []);
  }
}

// ==================== VISTAS ====================
function mostrarLoginForm() {
  loginSection.classList.remove('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.add('hidden');
}

function mostrarRegisterForm() {
  loginSection.classList.add('hidden');
  registerSection.classList.remove('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.add('hidden');
}

function mostrarRecoveryForm() {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

async function mostrarApp(nombre) {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.remove('hidden');
  loggedUserSpan.textContent = escapeHtml(nombre);
}

async function cargarTasaCambio() {
  try {
    const doc = await db.collection("config_sistema").doc("tasa_cambio").get();
    tasaCambio = doc.exists ? doc.data().valor : 3.5;
    if (exchangeRateInput) exchangeRateInput.value = tasaCambio.toFixed(2);
  } catch (e) {
    console.error('Error cargando tasa:', e);
  }
}

// ==================== EVENTOS ====================
loginBtn.addEventListener('click', iniciarSesion);
showRegisterBtn.addEventListener('click', mostrarRegisterForm);
confirmRegisterBtn.addEventListener('click', registrarUsuario);
cancelRegisterBtn.addEventListener('click', mostrarLoginForm);
forgotPasswordBtn.addEventListener('click', mostrarRecoveryForm);
cancelRecoveryBtn.addEventListener('click', mostrarLoginForm);

// ==================== INICIALIZACIÓN ====================
async function initApp() {
  initEmailJS();
  mostrarLoginForm();
  await cargarTasaCambio();
}

window.addEventListener('DOMContentLoaded', async () => {
  const initialized = await initializeFirebaseSecurely();
  if (initialized) {
    handleMasterPasswordFlow();
  } else {
    modalTitle.textContent = '❌ Error de Configuración';
    modalMessage.textContent = 'Contacta al administrador';
  }
});
