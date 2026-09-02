/**
 * app.js — Controlador principal
 */

const App = (() => {
    const NAV_LABELS = {
        dashboard: 'Dashboard',
        reservas: 'Reservas',
        pedidos: 'Pedidos',
        cocina: 'Cocina',
        despachos: 'Despachos',
        mesas: 'Mesas',
        usuarios: 'Usuarios'
    };

    let currentSection = 'dashboard';

    async function init() {
        Storage.initDemoData();
        await Auth.initDemoPasswords();

        const session = Auth.getSession();
        if (session) {
            showApp(session);
        } else {
            showLogin();
        }

        // Sidebar toggle
        const toggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (toggle) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    function showLogin() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('app-screen').classList.remove('active');

        const form = document.getElementById('login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usuario = document.getElementById('login-usuario').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.textContent = '';

            const result = await Auth.login(usuario, password);
            if (result.ok) {
                showApp(result.user);
            } else {
                errorEl.textContent = result.error;
            }
        });
    }

    function showApp(session) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');

        // User info
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="user-name">${session.nombre}</span>
                <span class="user-role badge badge-info">${Auth.getRolLabel(session.rol)}</span>
            `;
        }

        // Build sidebar nav
        buildSidebar(session.rol);

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Auth.logout();
                showLogin();
            });
        }

        showSection('dashboard');
    }

    function buildSidebar(rol) {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        const visible = Auth.getVisibleNav();
        nav.innerHTML = visible.map(key => `
            <a href="#" class="nav-item ${key === currentSection ? 'active' : ''}" data-section="${key}">
                ${NAV_LABELS[key] || key}
            </a>
        `).join('');

        nav.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                showSection(item.dataset.section);
                // Close sidebar on mobile
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebar-overlay').classList.remove('active');
            });
        });
    }

    function showSection(section) {
        currentSection = section;
        const content = document.getElementById('main-content');
        if (!content) return;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        let html = '';
        switch (section) {
            case 'dashboard': html = Modules.Dashboard.render(); break;
            case 'reservas': html = Modules.Reservas.render(); break;
            case 'pedidos': html = Modules.Pedidos.render(); break;
            case 'cocina': html = Modules.Cocina.render(); break;
            case 'despachos': html = Modules.Despachos.render(); break;
            case 'mesas': html = Modules.Mesas.render(); break;
            case 'usuarios':
                if (!Auth.hasPermission('usuarios')) {
                    html = '<div class="empty-text">Sin permisos</div>';
                } else {
                    html = Modules.Usuarios.render();
                }
                break;
            default:
                html = '<div class="empty-text">Sección no encontrada</div>';
        }

        content.innerHTML = html;
    }

    return { init, showSection };
})();

document.addEventListener('DOMContentLoaded', App.init);
