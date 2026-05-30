// ==================== CONFIGURACIÓN FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyAtjnSikSLRkJYH90qRi5BFwgnwacH_I8s",
  authDomain: "inventario-teinda-648aa.firebaseapp.com",
  projectId: "inventario-teinda-648aa",
  storageBucket: "inventario-teinda-648aa.firebasestorage.app",
  messagingSenderId: "22864280682",
  appId: "1:22864280682:web:e9252f456f4ad16443e693"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==================== VARIABLES GLOBALES ====================
let productos = [];
let tasaCambio = 3.5;
let usuarioActual = null;
let currentInventoryOwner = null;
let currentPermission = "edit";
let unsubscribeInventory = null;
let adminObservingUser = null;   // modo admin observador

// DOM elements
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

// EmailJS
const EMAILJS_SERVICE_ID = 'recuperacion';
const EMAILJS_TEMPLATE_ID = 'template_fy0hmst';
const EMAILJS_PUBLIC_KEY = 'izdpmjIVDCrGNcfGS';

// ==================== MODAL MAESTRA ====================
const modalOverlay = document.getElementById('masterPasswordModal');
const mainContent = document.getElementById('mainContent');
const footer = document.getElementById('footer');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const masterPasswordInput = document.getElementById('masterPasswordInput');
const submitMasterPasswordBtn = document.getElementById('submitMasterPasswordBtn');
const masterPasswordError = document.getElementById('masterPasswordError');

async function setMasterPassword(newPassword) {
  if (!newPassword || newPassword.length < 4) throw new Error('Mínimo 4 caracteres');
  const hash = await hashString(newPassword);
  await db.collection("config_sistema").doc("clave_maestra").set({ hash: hash });
  return true;
}

async function verifyMasterPassword(password) {
  const doc = await db.collection("config_sistema").doc("clave_maestra").get();
  if (!doc.exists) return false;
  const hash = await hashString(password);
  return hash === doc.data().hash;
}

async function handleMasterPasswordFlow() {
  await ensureAdminUser();
  const doc = await db.collection("config_sistema").doc("clave_maestra").get();
  if (!doc.exists) await setMasterPassword('admin123');
  modalTitle.textContent = '🔐 Acceso restringido';
  modalMessage.textContent = 'Ingresa la contraseña maestra para continuar';
  masterPasswordInput.placeholder = 'Contraseña maestra';
  submitMasterPasswordBtn.onclick = async () => {
    const pass = masterPasswordInput.value;
    if (await verifyMasterPassword(pass)) {
      modalOverlay.style.display = 'none';
      mainContent.style.display = 'block';
      if (footer) footer.style.display = 'block';
      initApp();
    } else {
      masterPasswordError.textContent = 'Contraseña incorrecta.';
    }
  };
}

// ==================== FUNCIONES GENERALES ====================
function mostrarMensaje(element, texto, color = '#dc2626') {
  if (!element) return;
  element.textContent = texto;
  element.style.color = color;
  setTimeout(() => {
    if (element.textContent === texto) element.textContent = '';
  }, 5000);
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateUniqueId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now() + '-' + Math.random().toString(36).substring(2) + '-' + performance.now();
}

async function hashString(texto) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('Crypto API no disponible');
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  return hashString(password);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ==================== HISTORIAL ====================
async function registrarMovimiento(owner, tipo, producto, detalle) {
  await db.collection("movimientos").add({
    owner, id: generateUniqueId(), fecha: new Date().toLocaleString(), tipo, producto, detalle
  });
}

async function mostrarHistorial(owner) {
  if (!movementHistoryDiv) return;
  const snapshot = await db.collection("movimientos").where("owner", "==", owner).get();
  if (snapshot.empty) {
    movementHistoryDiv.innerHTML = '<p>No hay movimientos registrados.</p>';
    return;
  }
  let listaMovs = [];
  snapshot.forEach(doc => listaMovs.push(doc.data()));
  listaMovs.sort((a,b) => b.id.localeCompare(a.id));
  let html = '';
  for (const mov of listaMovs) {
    html += `<div class="movement-item"><strong>${escapeHtml(mov.fecha)}</strong><br />${escapeHtml(mov.detalle)}</div>`;
  }
  movementHistoryDiv.innerHTML = html;
}

// ==================== USUARIOS E INVENTARIO ====================
async function ensureAdminUser() {
  const adminDoc = await db.collection("usuarios").doc("admin").get();
  if (!adminDoc.exists) {
    await db.collection("usuarios").doc("admin").set({
      nombre: 'admin', email: 'admin@inventario.pe', passwordHash: await hashPassword('admin123'), resetCodeHash: '', resetExpires: 0
    });
    await savePersonalInventory('admin', []);
  }
}

async function savePersonalInventory(username, inventory) {
  await db.collection("inventarios").doc(username).set({ productos: inventory });
}

function suscribirInventario(owner) {
  if (unsubscribeInventory) unsubscribeInventory();
  const docRef = db.collection("inventarios").doc(owner);
  unsubscribeInventory = docRef.onSnapshot((doc) => {
    if (doc.exists) {
      if (adminObservingUser === owner || (!adminObservingUser && (currentInventoryOwner === owner || owner === usuarioActual))) {
        productos = doc.data().productos || [];
        if (!inventorySection.classList.contains('hidden')) mostrarInventario();
        if (!summarySection.classList.contains('hidden')) mostrarResumen();
      }
    }
  });
}

async function loadPersonalInventory(username) {
  const doc = await db.collection("inventarios").doc(username).get();
  return doc.exists ? doc.data().productos : [];
}

// ==================== ADMIN OBSERVADOR ====================
async function adminViewInventory(username) {
  adminObservingUser = username;
  currentInventoryOwner = null;
  productos = await loadPersonalInventory(username);
  adminPanelDiv.style.display = 'none';
  shareSectionDiv.style.display = 'none';
  inventorySelectorGroup.style.display = 'none';
  inventorySection.classList.remove('hidden');
  summarySection.classList.add('hidden');
  addProductArea.classList.add('hidden');
  inventoryTitle.innerHTML = `👁️ Inventario de ${escapeHtml(username)} (solo observación) <button id="exitAdminViewBtn" class="secondary" style="margin-left: 10px;">⬅️ Volver al panel admin</button>`;
  suscribirInventario(username);
  await mostrarInventario();
  const exitBtn = document.getElementById('exitAdminViewBtn');
  if (exitBtn) exitBtn.onclick = () => exitAdminView();
}

function exitAdminView() {
  adminObservingUser = null;
  adminPanelDiv.style.display = 'block';
  shareSectionDiv.style.display = 'none';
  inventorySelectorGroup.style.display = 'none';
  cargarListaUsuariosAdmin();
  productos = [];
  inventorySection.classList.add('hidden');
  summarySection.classList.add('hidden');
  addProductArea.classList.add('hidden');
  inventoryTitle.innerHTML = 'Inventario';
  if (unsubscribeInventory) unsubscribeInventory();
  unsubscribeInventory = null;
  mostrarMensaje(appMessage, 'Has vuelto al panel de administración.', '#16a34a');
}

// ==================== COLABORACIÓN ====================
async function getCollaboratorPermission(owner, collaborator) {
  const doc = await db.collection("shared_config").doc(owner).get();
  if (doc.exists && doc.data()[collaborator]) return doc.data()[collaborator];
  return null;
}

async function setCollaboratorPermission(owner, collaborator, permission, notify = true) {
  const docRef = db.collection("shared_config").doc(owner);
  const doc = await docRef.get();
  let data = doc.exists ? doc.data() : {};
  const oldPerm = data[collaborator] || null;
  if (permission === null) {
    delete data[collaborator];
    if (Object.keys(data).length === 0) await docRef.delete();
    else await docRef.set(data);
    if (notify) {
      await addNotification(collaborator, `🔒 El usuario ${owner} ha revocado tu acceso.`, 'revoke');
      await addNotification(owner, `🔒 El colaborador ${collaborator} fue removido.`, 'revoke');
    }
  } else {
    data[collaborator] = permission;
    await docRef.set(data);
    if (notify && oldPerm && oldPerm !== permission) {
      const permText = permission === 'edit' ? 'edición' : 'solo lectura';
      await addNotification(collaborator, `✏️ ${owner} cambió tu permiso a "${permText}".`, 'perm_change');
      await addNotification(owner, `✏️ Permiso de ${collaborator} cambiado a "${permText}".`, 'perm_change');
    }
  }
  if (collaborator === usuarioActual && currentInventoryOwner === owner) {
    await refreshCurrentPermission();
    if (currentPermission !== 'edit') mostrarMensaje(appMessage, 'Tu permiso ha cambiado.', '#f59e0b');
    await mostrarInventario();
  }
}

async function getCollaboratorsWithPermissions(owner) {
  const doc = await db.collection("shared_config").doc(owner).get();
  if (!doc.exists) return [];
  return Object.entries(doc.data()).map(([user, perm]) => ({ user, perm }));
}

// ==================== INVITACIONES Y NOTIFICACIONES ====================
async function createInvitation(owner, collaborator, permission) {
  const snapshot = await db.collection("invitaciones")
                           .where("owner", "==", owner)
                           .where("collaborator", "==", collaborator)
                           .where("status", "==", "pending")
                           .get();
  if (!snapshot.empty) return false;
  await db.collection("invitaciones").add({
    id: generateUniqueId(), owner, collaborator, permission, status: 'pending', date: new Date().toLocaleString()
  });
  await addNotification(collaborator, `📨 Invitación de ${owner} (${permission === 'edit' ? 'edición' : 'solo lectura'}).`, 'invitation');
  return true;
}

async function acceptInvitation(id) {
  const snapshot = await db.collection("invitaciones").where("id", "==", id).get();
  if (snapshot.empty) return false;
  const docRef = snapshot.docs[0].ref;
  const inv = snapshot.docs[0].data();
  if (inv.status !== 'pending') return false;
  await setCollaboratorPermission(inv.owner, inv.collaborator, inv.permission, false);
  await docRef.update({ status: 'accepted' });
  await addNotification(inv.collaborator, `✅ Aceptaste invitación de ${inv.owner}.`, 'accept');
  if (usuarioActual === inv.collaborator) await actualizarSelectorInventarios();
  return true;
}

async function declineInvitation(id) {
  const snapshot = await db.collection("invitaciones").where("id", "==", id).get();
  if (snapshot.empty) return false;
  const docRef = snapshot.docs[0].ref;
  const inv = snapshot.docs[0].data();
  if (inv.status !== 'pending') return false;
  await docRef.update({ status: 'declined' });
  await addNotification(inv.collaborator, `❌ Rechazaste invitación de ${inv.owner}.`, 'decline');
  return true;
}

async function addNotification(username, message, type) {
  await db.collection("notificaciones").add({
    username, id: generateUniqueId(), message, type, date: new Date().toLocaleString(), read: false
  });
  if (usuarioActual === username) refreshNotificationBadge();
}

async function refreshNotificationBadge() {
  if (!usuarioActual) return;
  const snapshot = await db.collection("notificaciones")
                           .where("username", "==", usuarioActual)
                           .where("read", "==", false)
                           .get();
  const unread = snapshot.size;
  notificationBadge.textContent = unread;
  notificationBadge.style.display = unread === 0 ? 'none' : 'inline-block';
}

async function markAsRead(username, notifId) {
  const snapshot = await db.collection("notificaciones")
                           .where("username", "==", username)
                           .where("id", "==", notifId)
                           .get();
  if (!snapshot.empty) await snapshot.docs[0].ref.update({ read: true });
  refreshNotificationBadge();
  renderNotificationsPanel();
}

async function renderNotificationsPanel() {
  if (!usuarioActual) return;
  const snapNotif = await db.collection("notificaciones").where("username", "==", usuarioActual).get();
  let userNotif = [];
  snapNotif.forEach(d => userNotif.push(d.data()));
  userNotif.sort((a,b) => b.date.localeCompare(a.date));
  let html = '';
  const snapInv = await db.collection("invitaciones")
                          .where("collaborator", "==", usuarioActual)
                          .where("status", "==", "pending")
                          .get();
  snapInv.forEach(doc => {
    const inv = doc.data();
    html += `<div class="notification-item">
              <strong>📨 Invitación de ${escapeHtml(inv.owner)}</strong><br />
              Permiso: ${inv.permission === 'edit' ? 'Edición' : 'Solo lectura'}<br />
              <button class="accept-invite" data-id="${inv.id}">Aceptar</button>
              <button class="decline-invite" data-id="${inv.id}">Rechazar</button>
            </div>`;
  });
  for (const notif of userNotif) {
    const readClass = notif.read ? 'style="opacity:0.6;"' : '';
    html += `<div class="notification-item" ${readClass}>
              ${escapeHtml(notif.message)}<br /><small>${escapeHtml(notif.date)}</small>
              ${!notif.read ? `<button class="mark-read" data-id="${notif.id}">Marcar leída</button>` : ''}
            </div>`;
  }
  notificationsList.innerHTML = html;
  document.querySelectorAll('.accept-invite').forEach(btn => {
    btn.onclick = async () => { await acceptInvitation(btn.getAttribute('data-id')); await renderNotificationsPanel(); await refreshNotificationBadge(); await actualizarSelectorInventarios(); mostrarMensaje(appMessage, 'Invitación aceptada.', '#16a34a'); };
  });
  document.querySelectorAll('.decline-invite').forEach(btn => {
    btn.onclick = async () => { await declineInvitation(btn.getAttribute('data-id')); await renderNotificationsPanel(); await refreshNotificationBadge(); mostrarMensaje(appMessage, 'Invitación rechazada.', '#dc2626'); };
  });
  document.querySelectorAll('.mark-read').forEach(btn => {
    btn.onclick = async () => { await markAsRead(usuarioActual, btn.getAttribute('data-id')); };
  });
}

// ==================== TASA CAMBIO ====================
async function guardarTasaCambio() {
  const v = parseFloat(exchangeRateInput.value);
  if (!isNaN(v) && v > 0) { tasaCambio = v; await db.collection("config_sistema").doc("tasa_cambio").set({ valor: tasaCambio }); }
  else { tasaCambio = 3.5; exchangeRateInput.value = '3.50'; }
}
async function cargarTasaCambio() {
  const doc = await db.collection("config_sistema").doc("tasa_cambio").get();
  tasaCambio = doc.exists ? doc.data().valor : 3.5;
  exchangeRateInput.value = tasaCambio.toFixed(2);
}

// ==================== EMAILJS ====================
function initEmailJS() {
  if (window.emailjs && EMAILJS_PUBLIC_KEY && !EMAILJS_PUBLIC_KEY.includes('YOUR_')) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    console.log("EmailJS inicializado");
  }
}
async function sendRecoveryEmail(email, username, code, time) {
  if (!window.emailjs) return false;
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { to_email: email, username, reset_code: code, time });
    return true;
  } catch(e) { console.error(e); return false; }
}

// ==================== AUTENTICACIÓN ====================
async function iniciarSesion() {
  const nombreRaw = usernameInput.value.trim();
  const nombre = nombreRaw.toLowerCase();
  const contrasena = passwordInput.value.trim();
  if (!nombre || !contrasena) return mostrarMensaje(authMessage, 'Ingresa usuario y contraseña.');
  try {
    const doc = await db.collection("usuarios").doc(nombre).get();
    if (!doc.exists) return mostrarMensaje(authMessage, 'Usuario no existe.');
    const usuario = doc.data();
    const hashIngresado = await hashPassword(contrasena);
    if (usuario.passwordHash === hashIngresado) {
      usuarioActual = nombre;
      await cargarTasaCambio();
      currentInventoryOwner = null;
      currentPermission = "edit";
      await mostrarApp(nombre);
      mostrarMensaje(authMessage, `¡Bienvenido ${nombre}!`, '#16a34a');
    } else {
      mostrarMensaje(authMessage, 'Contraseña incorrecta.');
    }
  } catch(error) { mostrarMensaje(authMessage, 'Error: ' + error.message); }
}

async function registrarUsuario() {
  const nombreRaw = regUsername.value.trim();
  const nombre = nombreRaw.toLowerCase();
  const email = regEmail.value.trim().toLowerCase();
  const contrasena = regPassword.value.trim();
  if (!nombre || !email || !contrasena) return mostrarMensaje(regMessage, 'Completa todos los campos.');
  if (!/^[a-zA-Z0-9_\-]{3,20}$/.test(nombre)) return mostrarMensaje(regMessage, 'Usuario inválido: solo letras, números, _ y -, 3-20 caracteres.');
  if (nombre === 'admin') return mostrarMensaje(regMessage, 'El nombre "admin" está reservado.');
  if (contrasena.length < 6) return mostrarMensaje(regMessage, 'La contraseña debe tener al menos 6 caracteres.');
  if (!validarEmail(email)) return mostrarMensaje(regMessage, 'Correo inválido.');
  const userDoc = await db.collection("usuarios").doc(nombre).get();
  if (userDoc.exists) return mostrarMensaje(regMessage, 'El usuario ya existe.');
  const emailCheck = await db.collection("usuarios").where("email", "==", email).get();
  if (!emailCheck.empty) return mostrarMensaje(regMessage, 'El correo ya está registrado.');
  try {
    const passwordHash = await hashPassword(contrasena);
    await db.collection("usuarios").doc(nombre).set({ nombre, email, passwordHash, resetCodeHash: '', resetExpires: 0 });
    await savePersonalInventory(nombre, []);
    regUsername.value = ''; regEmail.value = ''; regPassword.value = '';
    mostrarMensaje(regMessage, '✅ Registro exitoso. Ahora inicia sesión.', '#16a34a');
    setTimeout(() => mostrarLoginForm(), 2000);
  } catch(error) {
    mostrarMensaje(regMessage, 'Error al guardar: ' + error.message, '#dc2626');
  }
}

async function mostrarApp(nombre) {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.remove('hidden');
  loggedUserSpan.textContent = escapeHtml(nombre);
  ocultarSeccionesInternas();
  if (nombre === 'admin') {
    adminPanelDiv.style.display = 'block';
    shareSectionDiv.style.display = 'none';
    inventorySelectorGroup.style.display = 'none';
    await cargarListaUsuariosAdmin();
    document.getElementById('changeMasterPasswordBtn').onclick = async () => {
      const newPass = document.getElementById('newMasterPassword').value;
      const confirmPass = document.getElementById('confirmMasterPassword').value;
      const msgElement = document.getElementById('changeMasterMsg');
      if (!newPass || newPass.length < 4) return mostrarMensaje(msgElement, 'Mínimo 4 caracteres.', '#dc2626');
      if (newPass !== confirmPass) return mostrarMensaje(msgElement, 'No coinciden.', '#dc2626');
      try { await setMasterPassword(newPass); mostrarMensaje(msgElement, '¡Contraseña maestra actualizada!', '#16a34a'); document.getElementById('newMasterPassword').value = ''; document.getElementById('confirmMasterPassword').value = ''; } 
      catch(error) { mostrarMensaje(msgElement, 'Error: ' + error.message, '#dc2626'); }
    };
  } else {
    adminPanelDiv.style.display = 'none';
    await actualizarUICompartir();
    await actualizarSelectorInventarios();
  }
  actualizarUITituloInventario();
  const owner = currentInventoryOwner || usuarioActual;
  suscribirInventario(owner);
  await mostrarInventario();
  await refreshNotificationBadge();
  await renderNotificationsPanel();
  notificationsPanel.classList.add('hidden');
}

function ocultarApp() {
  if (unsubscribeInventory) unsubscribeInventory();
  appSection.classList.add('hidden');
  usuarioActual = null;
  currentInventoryOwner = null;
  productos = [];
  mostrarLoginForm();
  authMessage.textContent = '';
  ocultarSeccionesInternas();
}

function ocultarSeccionesInternas() {
  addProductArea.classList.add('hidden');
  inventorySection.classList.add('hidden');
  summarySection.classList.add('hidden');
  if(appMessage) appMessage.textContent = '';
}

function mostrarLoginForm() {
  loginSection.classList.remove('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.add('hidden');
  usernameInput.value = passwordInput.value = regUsername.value = regEmail.value = regPassword.value = recoveryEmailInput.value = recoveryCodeInput.value = newPasswordInput.value = '';
  resetArea.classList.add('hidden'); newPasswordArea.classList.add('hidden'); verifyBtnArea.classList.add('hidden');
  authMessage.textContent = regMessage.textContent = recoveryMessage.textContent = '';
}

function mostrarRegisterForm() {
  loginSection.classList.add('hidden');
  registerSection.classList.remove('hidden');
  recoverySection.classList.add('hidden');
  appSection.classList.add('hidden');
  regMessage.textContent = '';
}

function mostrarRecoveryForm() {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  recoverySection.classList.remove('hidden');
  appSection.classList.add('hidden');
  authMessage.textContent = recoveryMessage.textContent = '';
}

// ==================== ADMIN (LISTA Y ELIMINAR) ====================
async function cargarListaUsuariosAdmin() {
  if (usuarioActual !== 'admin') return;
  userListAdminDiv.innerHTML = '<p>Cargando...</p>';
  const snapshot = await db.collection("usuarios").get();
  let lista = [];
  snapshot.forEach(d => { if(d.id !== 'admin') lista.push(d.data()); });
  if (lista.length === 0) { userListAdminDiv.innerHTML = '<p>No hay otros usuarios.</p>'; return; }
  let html = '<ul style="list-style:none;padding-left:0;">';
  for (const user of lista) {
    html += `<li style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
              <strong>${escapeHtml(user.nombre)}</strong> (${escapeHtml(user.email)})
              <div>
                <button class="admin-view-btn" data-user="${escapeHtml(user.nombre)}" style="background:#3b82f6;padding:6px 12px;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:5px;">👁️ Ver inventario</button>
                <button class="admin-delete-btn" data-user="${escapeHtml(user.nombre)}" style="background:#dc2626;padding:6px 12px;color:white;border:none;border-radius:4px;cursor:pointer;">Eliminar</button>
              </div>
            </li>`;
  }
  html += '</ul>';
  userListAdminDiv.innerHTML = html;
  document.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.getAttribute('data-user');
      if (confirm(`¿Eliminar a "${username}"?`)) { 
        await eliminarUsuario(username); 
        await cargarListaUsuariosAdmin(); 
        mostrarMensaje(appMessage, `Usuario ${username} eliminado.`, '#16a34a'); 
      }
    });
  });
  document.querySelectorAll('.admin-view-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.getAttribute('data-user');
      await adminViewInventory(username);
    });
  });
}

async function eliminarUsuario(username) {
  await db.collection("usuarios").doc(username).delete();
  await db.collection("inventarios").doc(username).delete();
  await db.collection("shared_config").doc(username).delete();
  mostrarMensaje(appMessage, `El usuario ${username} ha sido borrado del sistema.`, '#16a34a');
}

// ==================== COMPARTIR UI ====================
async function actualizarUICompartir() {
  if (usuarioActual === 'admin') return;
  shareSectionDiv.style.display = 'block';
  const collabs = await getCollaboratorsWithPermissions(usuarioActual);
  if (collabs.length === 0) collaboratorsListP.innerHTML = 'No has compartido tu inventario con nadie.';
  else collaboratorsListP.innerHTML = 'Colaboradores: ' + collabs.map(c => `${escapeHtml(c.user)} (${c.perm === 'edit' ? 'edición' : 'solo vista'})`).join(', ');
}

addCollaboratorBtn.addEventListener('click', async () => {
  const nombreColab = prompt('Nombre del usuario a invitar:');
  if (!nombreColab) return;
  if (nombreColab === usuarioActual || nombreColab === 'admin') return mostrarMensaje(appMessage, 'No puedes invitarte a ti mismo ni al admin.');
  const existeDoc = await db.collection("usuarios").doc(nombreColab).get();
  if (!existeDoc.exists) return mostrarMensaje(appMessage, `El usuario "${nombreColab}" no existe.`);
  const yaPermiso = await getCollaboratorPermission(usuarioActual, nombreColab);
  if (yaPermiso !== null) return mostrarMensaje(appMessage, `Ya es colaborador.`);
  const permiso = confirm('¿Permiso de edición? OK = Editar, Cancel = Solo ver') ? 'edit' : 'view';
  if (await createInvitation(usuarioActual, nombreColab, permiso)) mostrarMensaje(appMessage, `Invitación enviada a ${nombreColab}.`, '#16a34a');
  else mostrarMensaje(appMessage, `Ya hay invitación pendiente.`);
});

manageCollaboratorsBtn.addEventListener('click', async () => {
  const collabs = await getCollaboratorsWithPermissions(usuarioActual);
  if (collabs.length === 0) return mostrarMensaje(appMessage, 'No tienes colaboradores.');
  let lista = 'Colaboradores:\n' + collabs.map((c,i)=>`${i+1}. ${c.user} (${c.perm === 'edit' ? 'edición' : 'solo vista'})`).join('\n');
  lista += '\n\nEscribe el nombre para cambiar/eliminar (o "cancelar"):';
  const respuesta = prompt(lista);
  if (!respuesta || respuesta.toLowerCase() === 'cancelar') return;
  const colab = collabs.find(c => c.user === respuesta);
  if (!colab) return mostrarMensaje(appMessage, 'No encontrado.');
  const accion = prompt(`¿Qué hacer con ${colab.user}?\n1. Cambiar permiso\n2. Eliminar\nEscribe 1 o 2:`);
  if (accion === '1') {
    const nuevo = confirm('Dar edición? OK = Editar, Cancel = Solo ver') ? 'edit' : 'view';
    await setCollaboratorPermission(usuarioActual, colab.user, nuevo, true);
    mostrarMensaje(appMessage, `Permiso actualizado.`, '#16a34a');
  } else if (accion === '2') {
    await setCollaboratorPermission(usuarioActual, colab.user, null, true);
    mostrarMensaje(appMessage, `Colaborador eliminado.`, '#16a34a');
  } else mostrarMensaje(appMessage, 'Opción inválida.');
  await actualizarUICompartir();
  await actualizarSelectorInventarios();
});

// ==================== SELECTOR INVENTARIO ====================
async function actualizarSelectorInventarios() {
  if (usuarioActual === 'admin') { inventorySelectorGroup.style.display = 'none'; return; }
  const snapshot = await db.collection("shared_config").get();
  const owners = [];
  snapshot.forEach(doc => { if (doc.data()[usuarioActual]) owners.push(doc.id); });
  if (owners.length === 0) { inventorySelectorGroup.style.display = 'none'; leaveSharedBtn.style.display = 'none'; return; }
  inventorySelectorGroup.style.display = 'block';
  inventorySelect.innerHTML = '<option value="personal">Mi inventario personal</option>';
  for (const owner of owners) {
    const perm = await getCollaboratorPermission(owner, usuarioActual);
    const option = document.createElement('option');
    option.value = owner;
    option.textContent = `Inventario de ${escapeHtml(owner)} (${perm === 'edit' ? 'edición' : 'solo vista'})`;
    inventorySelect.appendChild(option);
  }
  if (currentInventoryOwner === null) inventorySelect.value = 'personal';
  else if (owners.includes(currentInventoryOwner)) inventorySelect.value = currentInventoryOwner;
  else inventorySelect.value = 'personal';
  leaveSharedBtn.style.display = currentInventoryOwner !== null ? 'inline-block' : 'none';
}

async function refreshCurrentPermission() {
  if (currentInventoryOwner === null) { currentPermission = 'edit'; return true; }
  const perm = await getCollaboratorPermission(currentInventoryOwner, usuarioActual);
  if (perm === null) {
    currentPermission = null;
    mostrarMensaje(appMessage, `Acceso revocado. Volviendo a inventario personal.`, '#dc2626');
    inventorySelect.value = 'personal';
    inventorySelect.dispatchEvent(new Event('change'));
    return false;
  }
  currentPermission = perm;
  return true;
}

inventorySelect.addEventListener('change', async () => {
  const selected = inventorySelect.value;
  if (selected === 'personal') {
    currentInventoryOwner = null;
    currentPermission = "edit";
    leaveSharedBtn.style.display = 'none';
    mostrarMensaje(appMessage, 'Ahora ves tu inventario personal.', '#16a34a');
  } else {
    const perm = await getCollaboratorPermission(selected, usuarioActual);
    if (perm) {
      currentInventoryOwner = selected;
      currentPermission = perm;
      leaveSharedBtn.style.display = 'inline-block';
      mostrarMensaje(appMessage, `Viendo inventario de ${escapeHtml(selected)} (${perm === 'edit' ? 'puedes editar' : 'solo lectura'}).`, '#16a34a');
    } else {
      mostrarMensaje(appMessage, 'No tienes acceso.', '#dc2626');
      await actualizarSelectorInventarios();
      return;
    }
  }
  actualizarUITituloInventario();
  const owner = currentInventoryOwner || usuarioActual;
  suscribirInventario(owner);
  await mostrarInventario();
});

if (leaveSharedBtn) {
  leaveSharedBtn.addEventListener('click', async () => {
    if (currentInventoryOwner && confirm(`¿Salir del inventario de ${currentInventoryOwner}?`)) {
      await setCollaboratorPermission(currentInventoryOwner, usuarioActual, null, true);
      await actualizarSelectorInventarios();
      inventorySelect.value = 'personal';
      inventorySelect.dispatchEvent(new Event('change'));
      mostrarMensaje(appMessage, `Has salido del inventario de ${currentInventoryOwner}.`, '#16a34a');
    }
  });
}

function actualizarUITituloInventario() {
  if (currentInventoryOwner === null) inventoryTitle.textContent = 'Mi inventario personal';
  else inventoryTitle.textContent = `Inventario compartido de ${escapeHtml(currentInventoryOwner)} (${currentPermission === 'edit' ? 'edición permitida' : 'solo lectura'})`;
}

async function esInventarioSoloLectura() {
  if (usuarioActual === 'admin' && adminObservingUser !== null) return true;
  if (currentInventoryOwner !== null) await refreshCurrentPermission();
  return currentPermission !== 'edit';
}

// ==================== PRODUCTOS ====================
function crearInputsProductos(cantidad) {
  productInputs.innerHTML = '';
  for (let i = 1; i <= cantidad; i++) {
    const div = document.createElement('div');
    div.className = 'product-row';
    div.innerHTML = `<p><strong>Producto ${i}</strong></p>
      <div class="form-group"><label>Código</label><input type="text" class="product-code" placeholder="Ej: RO117" required /></div>
      <div class="form-group"><label>Precio (S/.)</label><input type="number" min="0.01" step="0.01" class="product-price" placeholder="12.50" required /></div>
      <div class="form-group"><label>Cantidad</label><input type="number" min="1" class="product-quantity" value="1" required /></div>`;
    productInputs.appendChild(div);
  }
}

async function iniciarAgregarProductos() {
  if (await esInventarioSoloLectura()) return mostrarMensaje(appMessage, 'No puedes modificar este inventario (solo lectura).', '#dc2626');
  addProductArea.classList.remove('hidden');
  inventorySection.classList.add('hidden');
  summarySection.classList.add('hidden');
  appMessage.textContent = '';
  crearInputsProductos(parseInt(productCountInput.value) || 1);
}
function cancelarAgregar() { addProductArea.classList.add('hidden'); productCountInput.value = '1'; appMessage.textContent = ''; }

async function guardarProductos() {
  if (await esInventarioSoloLectura()) return mostrarMensaje(appMessage, 'No puedes modificar este inventario.');
  const rows = document.querySelectorAll('.product-row');
  let nuevos = [], error = false;
  rows.forEach(row => {
    const codigo = row.querySelector('.product-code').value.trim();
    const precio = parseFloat(row.querySelector('.product-price').value);
    const cantidad = parseInt(row.querySelector('.product-quantity').value);
    if (!codigo || isNaN(precio) || precio <= 0 || isNaN(cantidad) || cantidad <= 0) error = true;
    else nuevos.push({ codigo, precio_soles: precio, cantidad });
  });
  if (error) return mostrarMensaje(appMessage, 'Revisa todos los datos.');
  const owner = currentInventoryOwner || usuarioActual;
  for (let nuevo of nuevos) {
    const existente = productos.find(p => p.codigo === nuevo.codigo);
    if (existente) {
      if (confirm(`El producto "${nuevo.codigo}" ya existe. ¿Actualizar?`)) {
        const diff = nuevo.cantidad - existente.cantidad;
        existente.cantidad = nuevo.cantidad;
        existente.precio_soles = nuevo.precio_soles;
        await registrarMovimiento(owner, 'cambio_cantidad', nuevo.codigo, `Modificado "${nuevo.codigo}": cantidad ${diff>=0?'+':''}${diff}, nuevo precio S/${nuevo.precio_soles.toFixed(2)}`);
      }
    } else {
      productos.push(nuevo);
      await registrarMovimiento(owner, 'agregar', nuevo.codigo, `Agregado "${nuevo.codigo}" con cantidad ${nuevo.cantidad} y precio S/${nuevo.precio_soles.toFixed(2)}`);
    }
  }
  await guardarInventarioActual();
  mostrarMensaje(appMessage, 'Productos guardados.', '#16a34a');
  addProductArea.classList.add('hidden');
  productCountInput.value = '1';
  await mostrarInventario();
}

async function mostrarInventario() {
  inventorySection.classList.remove('hidden');
  summarySection.classList.add('hidden');
  addProductArea.classList.add('hidden');
  appMessage.textContent = '';
  inventoryList.innerHTML = '';
  if (productos.length === 0) { inventoryList.innerHTML = '<p>No hay productos.</p>'; return; }
  const readonly = await esInventarioSoloLectura();
  productos.forEach((prod, idx) => {
    const div = document.createElement('div');
    div.className = 'product-row';
    div.innerHTML = `<strong>${escapeHtml(prod.codigo)}</strong><br />Precio: S/ ${prod.precio_soles.toFixed(2)}<br />Cantidad: ${prod.cantidad}`;
    if (!readonly) {
      div.innerHTML += `<div class="edit-buttons">
        <button class="inc" data-index="${idx}">+1</button>
        <button class="dec" data-index="${idx}">-1</button>
        <button class="edit-price" data-index="${idx}">✏️ Precio</button>
        <button class="delete-product" data-index="${idx}">🗑️ Eliminar</button>
      </div>`;
    }
    inventoryList.appendChild(div);
  });
  if (!readonly) {
    const owner = currentInventoryOwner || usuarioActual;
    document.querySelectorAll('.inc').forEach(btn => btn.onclick = async () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && productos[idx] && !(await esInventarioSoloLectura())) {
        productos[idx].cantidad++;
        await guardarInventarioActual();
        await registrarMovimiento(owner, 'cambio_cantidad', productos[idx].codigo, `Incrementado en 1 "${productos[idx].codigo}" (nueva cantidad: ${productos[idx].cantidad})`);
        await mostrarInventario();
        mostrarMensaje(appMessage, `+1 a ${productos[idx].codigo}`, '#16a34a');
      }
    });
    document.querySelectorAll('.dec').forEach(btn => btn.onclick = async () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && productos[idx] && !(await esInventarioSoloLectura())) {
        if (productos[idx].cantidad > 1) {
          productos[idx].cantidad--;
          await guardarInventarioActual();
          await registrarMovimiento(owner, 'cambio_cantidad', productos[idx].codigo, `Reducido en 1 "${productos[idx].codigo}" (nueva cantidad: ${productos[idx].cantidad})`);
          await mostrarInventario();
          mostrarMensaje(appMessage, `-1 a ${productos[idx].codigo}`, '#16a34a');
        } else {
          if (confirm(`¿Eliminar producto "${productos[idx].codigo}"?`)) {
            await registrarMovimiento(owner, 'eliminar', productos[idx].codigo, `Eliminado completamente "${productos[idx].codigo}" (cantidad: ${productos[idx].cantidad})`);
            productos.splice(idx, 1);
            await guardarInventarioActual();
            await mostrarInventario();
            mostrarMensaje(appMessage, 'Producto eliminado.', '#16a34a');
          }
        }
      }
    });
    document.querySelectorAll('.edit-price').forEach(btn => btn.onclick = async () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && productos[idx] && !(await esInventarioSoloLectura())) {
        const nuevo = prompt('Nuevo precio en soles:', productos[idx].precio_soles);
        if (nuevo) {
          const num = parseFloat(nuevo);
          if (!isNaN(num) && num > 0) {
            const old = productos[idx].precio_soles;
            productos[idx].precio_soles = num;
            await guardarInventarioActual();
            await registrarMovimiento(owner, 'cambio_precio', productos[idx].codigo, `Precio de "${productos[idx].codigo}" cambiado de S/${old.toFixed(2)} a S/${num.toFixed(2)}`);
            await mostrarInventario();
            mostrarMensaje(appMessage, 'Precio actualizado.', '#16a34a');
          } else mostrarMensaje(appMessage, 'Precio inválido.');
        }
      }
    });
    document.querySelectorAll('.delete-product').forEach(btn => btn.onclick = async () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && productos[idx] && confirm(`¿Eliminar "${productos[idx].codigo}"?`) && !(await esInventarioSoloLectura())) {
        await registrarMovimiento(owner, 'eliminar', productos[idx].codigo, `Eliminado "${productos[idx].codigo}" (cantidad: ${productos[idx].cantidad})`);
        productos.splice(idx, 1);
        await guardarInventarioActual();
        await mostrarInventario();
        mostrarMensaje(appMessage, 'Producto eliminado.', '#16a34a');
      }
    });
  }
}

async function guardarInventarioActual() {
  if (adminObservingUser !== null) {
    mostrarMensaje(appMessage, 'No puedes modificar el inventario de otro usuario.', '#dc2626');
    return;
  }
  if (currentInventoryOwner === null) await savePersonalInventory(usuarioActual, productos);
  else await savePersonalInventory(currentInventoryOwner, productos);
}

async function mostrarResumen() {
  summarySection.classList.remove('hidden');
  inventorySection.classList.add('hidden');
  addProductArea.classList.add('hidden');
  if(appMessage) appMessage.textContent = '';
  summaryList.innerHTML = '';
  await guardarTasaCambio();
  let totalSoles = 0;
  productos.forEach(prod => {
    const subtotal = prod.precio_soles * prod.cantidad;
    totalSoles += subtotal;
    summaryList.innerHTML += `<div class="summary-row"><strong>${escapeHtml(prod.codigo)}</strong><br />Subtotal S/ ${subtotal.toFixed(2)}<br />Subtotal $ ${(subtotal / tasaCambio).toFixed(2)}</div>`;
  });
  totalSolesSpan.textContent = totalSoles.toFixed(2);
  totalUsdSpan.textContent = (totalSoles / tasaCambio).toFixed(2);
  const historyOwner = currentInventoryOwner || usuarioActual;
  await mostrarHistorial(historyOwner);
}

// ==================== RECUPERACIÓN ====================
sendRecoveryBtn.addEventListener('click', async () => {
  const email = recoveryEmailInput.value.trim().toLowerCase();
  if (!validarEmail(email)) return mostrarMensaje(recoveryMessage, 'Correo inválido.');
  const snapshot = await db.collection("usuarios").where("email", "==", email).get();
  if (snapshot.empty) return mostrarMensaje(recoveryMessage, 'No existe cuenta con ese correo.');
  const docRef = snapshot.docs[0].ref;
  const usuario = snapshot.docs[0].data();
  mostrarMensaje(recoveryMessage, `📝 Tu usuario: "${escapeHtml(usuario.nombre)}". Revisa tu correo.`, '#16a34a');
  const codigo = generarCodigo();
  const expiresAt = Date.now() + 15*60*1000;
  const expirationTime = new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  await docRef.update({ resetCodeHash: await hashString(codigo), resetExpires: expiresAt });
  resetArea.classList.remove('hidden');
  newPasswordArea.classList.remove('hidden');
  verifyBtnArea.classList.remove('hidden');
  const enviado = await sendRecoveryEmail(email, usuario.nombre, codigo, expirationTime);
  if (enviado) mostrarMensaje(recoveryMessage, `📧 Código enviado a ${email}.`, '#16a34a');
  else mostrarMensaje(recoveryMessage, `⚠️ No se pudo enviar correo. Usa código: ${codigo}`, '#dc2626');
});

verifyCodeBtn.addEventListener('click', async () => {
  const email = recoveryEmailInput.value.trim().toLowerCase();
  const codigo = recoveryCodeInput.value.trim();
  const nuevaPass = newPasswordInput.value.trim();
  if (!codigo || !nuevaPass) return mostrarMensaje(recoveryMessage, 'Ingresa código y nueva contraseña.');
  const snapshot = await db.collection("usuarios").where("email", "==", email).get();
  if (snapshot.empty) return mostrarMensaje(recoveryMessage, 'Correo no registrado.');
  const docRef = snapshot.docs[0].ref;
  const usuario = snapshot.docs[0].data();
  const codeHash = await hashString(codigo);
  if (!usuario.resetCodeHash || usuario.resetCodeHash !== codeHash) return mostrarMensaje(recoveryMessage, 'Código incorrecto.');
  if (Date.now() > usuario.resetExpires) {
    await docRef.update({ resetCodeHash: '', resetExpires: 0 });
    return mostrarMensaje(recoveryMessage, 'Código expirado.');
  }
  await docRef.update({ passwordHash: await hashPassword(nuevaPass), resetCodeHash: '', resetExpires: 0 });
  mostrarMensaje(recoveryMessage, '✅ Contraseña actualizada. Inicia sesión.', '#16a34a');
  mostrarLoginForm();
});

// ==================== EVENTOS ====================
loginBtn.addEventListener('click', iniciarSesion);
showRegisterBtn.addEventListener('click', mostrarRegisterForm);
confirmRegisterBtn.addEventListener('click', registrarUsuario);
cancelRegisterBtn.addEventListener('click', mostrarLoginForm);
forgotPasswordBtn.addEventListener('click', mostrarRecoveryForm);
cancelRecoveryBtn.addEventListener('click', mostrarLoginForm);
logoutBtn.addEventListener('click', ocultarApp);
startAddBtn.addEventListener('click', iniciarAgregarProductos);
saveProductsBtn.addEventListener('click', guardarProductos);
cancelAddBtn.addEventListener('click', cancelarAgregar);
showInventoryBtn.addEventListener('click', mostrarInventario);
showSummaryBtn.addEventListener('click', mostrarResumen);
exchangeRateInput.addEventListener('change', async () => { await guardarTasaCambio(); if (!summarySection.classList.contains('hidden')) await mostrarResumen(); });
if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', cargarListaUsuariosAdmin);
notificationsBtn.addEventListener('click', async () => {
  if (notificationsPanel.classList.contains('hidden')) { await renderNotificationsPanel(); notificationsPanel.classList.remove('hidden'); }
  else notificationsPanel.classList.add('hidden');
});

// ==================== INICIALIZACIÓN ====================
async function initApp() {
  initEmailJS();
  mostrarLoginForm();
  await cargarTasaCambio();
}

handleMasterPasswordFlow();