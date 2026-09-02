/**
 * auth.js — Login, sesiones y permisos por rol
 * 
 * Roles: admin, mesero, cocina, despacho
 * Credenciales demo:
 *   admin/admin123, mesero/mesero123, cocina/cocina123, despacho/despacho123
 */

const Auth = (() => {
    const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas

    const PERMISOS = {
        admin: ['dashboard', 'reservas', 'pedidos', 'cocina', 'despachos', 'mesas', 'usuarios'],
        mesero: ['dashboard', 'reservas', 'pedidos', 'mesas'],
        cocina: ['dashboard', 'cocina'],
        despacho: ['dashboard', 'despachos']
    };

    const NAV_ITEMS = {
        admin: ['dashboard', 'reservas', 'pedidos', 'cocina', 'despachos', 'mesas', 'usuarios'],
        mesero: ['dashboard', 'reservas', 'pedidos', 'mesas'],
        cocina: ['dashboard', 'cocina'],
        despacho: ['dashboard', 'despachos']
    };

    // Inicializar contraseñas hasheadas de usuarios demo
    async function initDemoPasswords() {
        const usuarios = Storage.getAll('usuarios');
        let changed = false;
        for (const u of usuarios) {
            if (!u.password || u.password === '') {
                u.password = await Storage.hashPassword(u.usuario + '123');
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem('rest_usuarios', JSON.stringify(
                usuarios.map(u => ({ _data: u, _hmac: 'ok' }))
            ));
        }
    }

    async function login(usuario, password) {
        const missing = Storage.validateRequired(['usuario', 'password'], { usuario, password });
        if (missing.length > 0) {
            return { ok: false, error: 'Complete todos los campos' };
        }

        const sanitizedUser = Storage.sanitize(usuario.trim());
        const usuarios = Storage.getAll('usuarios');
        const user = usuarios.find(u => u.usuario === sanitizedUser);

        if (!user) {
            return { ok: false, error: 'Usuario no encontrado' };
        }

        if (!user.activo) {
            return { ok: false, error: 'Usuario desactivado' };
        }

        const hashed = await Storage.hashPassword(password);
        if (user.password !== hashed) {
            return { ok: false, error: 'Contraseña incorrecta' };
        }

        const session = {
            id: user.id,
            usuario: user.usuario,
            nombre: user.nombre,
            rol: user.rol
        };

        Storage.setSession(session);
        return { ok: true, user: session };
    }

    function logout() {
        Storage.clearSession();
    }

    function getSession() {
        const session = Storage.getSession();
        if (!session) return null;

        // Verificar expiración
        if (Date.now() - session.loginAt > SESSION_TIMEOUT) {
            Storage.clearSession();
            return null;
        }

        return session;
    }

    function requireAuth(rolRequerido) {
        const session = getSession();
        if (!session) return false;
        if (rolRequerido && session.rol !== rolRequerido && session.rol !== 'admin') return false;
        return true;
    }

    function hasPermission(permission) {
        const session = getSession();
        if (!session) return false;
        const perms = PERMISOS[session.rol] || [];
        return perms.includes(permission);
    }

    function getVisibleNav() {
        const session = getSession();
        if (!session) return [];
        return NAV_ITEMS[session.rol] || [];
    }

    async function changePassword(userId, oldPass, newPass) {
        const usuarios = Storage.getAll('usuarios');
        const user = usuarios.find(u => u.id === userId);
        if (!user) return { ok: false, error: 'Usuario no encontrado' };

        const hashedOld = await Storage.hashPassword(oldPass);
        if (user.password !== hashedOld) {
            return { ok: false, error: 'Contraseña actual incorrecta' };
        }

        if (newPass.length < 6) {
            return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' };
        }

        user.password = await Storage.hashPassword(newPass);
        Storage.put('usuarios', user);
        return { ok: true };
    }

    function getRolLabel(rol) {
        const labels = { admin: 'Administrador', mesero: 'Mesero', cocina: 'Cocina', despacho: 'Despacho' };
        return labels[rol] || rol;
    }

    return {
        initDemoPasswords,
        login,
        logout,
        getSession,
        requireAuth,
        hasPermission,
        getVisibleNav,
        changePassword,
        getRolLabel,
        PERMISOS
    };
})();
