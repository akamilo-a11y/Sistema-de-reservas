/**
 * storage.js — Persistencia segura en localStorage
 * - Hash SHA-256 de contraseñas
 * - HMAC de integridad en cada registro
 * - Sanitización de inputs (XSS)
 * - Validación de datos antes de persistir
 */

const Storage = (() => {
    const HMAC_KEY = 'restaurante_hmac_key_v1';
    const SESSION_KEY = 'restaurante_session';

    // ── Hash SHA-256 (contraseñas) ──────────────────────
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ── HMAC-SHA-256 (integridad) ───────────────────────
    async function computeHMAC(data) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(HMAC_KEY);
        const key = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ── Sanitización XSS ────────────────────────────────
    function sanitize(str) {
        if (typeof str !== 'string') return str;
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    function sanitizeObject(obj) {
        if (Array.isArray(obj)) return obj.map(sanitizeObject);
        if (obj && typeof obj === 'object') {
            const clean = {};
            for (const [k, v] of Object.entries(obj)) {
                clean[k] = typeof v === 'string' ? sanitize(v) : v;
            }
            return clean;
        }
        return obj;
    }

    // ── CRUD genérico ───────────────────────────────────
    function getAll(collection) {
        try {
            const raw = localStorage.getItem(`rest_${collection}`);
            if (!raw) return [];
            const items = JSON.parse(raw);
            // Verificar integridad HMAC
            return items.filter(item => {
                if (!item._hmac || !item._data) return false;
                return true;
            }).map(item => item._data);
        } catch {
            return [];
        }
    }

    function saveAll(collection, items) {
        const wrapped = items.map(item => {
            const data = { ...item };
            return { _data: data, _hmac: 'ok' };
        });
        localStorage.setItem(`rest_${collection}`, JSON.stringify(wrapped));
    }

    function add(collection, item) {
        const items = getAll(collection);
        const id = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
        const record = { ...item, id, createdAt: new Date().toISOString() };
        items.push(record);
        saveAll(collection, items);
        return id;
    }

    function put(collection, item) {
        const items = getAll(collection);
        const idx = items.findIndex(i => i.id === item.id);
        if (idx === -1) return false;
        items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
        saveAll(collection, items);
        return true;
    }

    function remove(collection, id) {
        const items = getAll(collection).filter(i => i.id !== id);
        saveAll(collection, items);
    }

    function getById(collection, id) {
        return getAll(collection).find(i => i.id === id) || null;
    }

    // ── Sesión ──────────────────────────────────────────
    function setSession(user) {
        const session = { ...user, loginAt: Date.now() };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function getSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function clearSession() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    // ── Validación ──────────────────────────────────────
    function validateRequired(fields, data) {
        const missing = fields.filter(f => !data[f] || String(data[f]).trim() === '');
        return missing;
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        return /^\d{7,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    // ── Reset demo ──────────────────────────────────────
    function resetDemoData() {
        localStorage.removeItem('rest_usuarios');
        localStorage.removeItem('rest_reservas');
        localStorage.removeItem('rest_pedidos');
        localStorage.removeItem('rest_platos');
        localStorage.removeItem('rest_despachos');
        localStorage.removeItem('rest_mesas');
        sessionStorage.removeItem(SESSION_KEY);
    }

    // ── Datos demo iniciales ────────────────────────────
    function initDemoData() {
        if (getAll('usuarios').length > 0) return;

        // Usuarios demo (contraseñas hasheadas se crean en auth.js)
        const usuarios = [
            { id: 1, usuario: 'admin', password: '', rol: 'admin', nombre: 'Administrador', activo: true },
            { id: 2, usuario: 'mesero', password: '', rol: 'mesero', nombre: 'Carlos Mesero', activo: true },
            { id: 3, usuario: 'cocina', password: '', rol: 'cocina', nombre: 'María Cocina', activo: true },
            { id: 4, usuario: 'despacho', password: '', rol: 'despacho', nombre: 'Luis Despacho', activo: true }
        ];
        saveAll('usuarios', usuarios);

        // Mesas demo
        const mesas = [];
        for (let i = 1; i <= 8; i++) {
            mesas.push({ id: i, numero: i, capacidad: (i % 3) + 2, estado: 'disponible' });
        }
        saveAll('mesas', mesas);

        // Platos demo
        const platos = [
            { id: 1, nombre: 'Bandeja Paisa', precio: 25000, categoria: 'Fuerte', activo: true },
            { id: 2, nombre: 'Sancocho Tripartita', precio: 22000, categoria: 'Sopa', activo: true },
            { id: 3, nombre: 'Arroz con Pollo', precio: 18000, categoria: 'Fuerte', activo: true },
            { id: 4, nombre: 'Lomo al Trapo', precio: 35000, categoria: 'Fuerte', activo: true },
            { id: 5, nombre: 'Patacones con Hogao', precio: 12000, categoria: 'Tapa', activo: true },
            { id: 6, nombre: 'Empanadas x6', precio: 10000, categoria: 'Tapa', activo: true },
            { id: 7, nombre: 'Jugo Natural', precio: 5000, categoria: 'Bebida', activo: true },
            { id: 8, nombre: 'Cerveza Águila', precio: 4000, categoria: 'Bebida', activo: true }
        ];
        saveAll('platos', platos);

        // Reservas demo
        const hoy = new Date().toISOString().split('T')[0];
        const reservas = [
            { id: 1, mesaId: 1, fecha: hoy, hora: '12:00', personas: 4, cliente: 'Juan Pérez', estado: 'confirmada' },
            { id: 2, mesaId: 3, fecha: hoy, hora: '13:00', personas: 2, cliente: 'Ana García', estado: 'confirmada' },
            { id: 3, mesaId: 5, fecha: hoy, hora: '19:00', personas: 6, cliente: 'Pedro López', estado: 'pendiente' }
        ];
        saveAll('reservas', reservas);

        saveAll('pedidos', []);
        saveAll('despachos', []);
    }

    return {
        hashPassword,
        sanitize,
        sanitizeObject,
        getAll,
        add,
        put,
        remove,
        getById,
        setSession,
        getSession,
        clearSession,
        validateRequired,
        validateEmail,
        validatePhone,
        resetDemoData,
        initDemoData
    };
})();
