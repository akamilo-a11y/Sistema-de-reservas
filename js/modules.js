/**
 * modules.js — Lógica de negocio y vistas
 */

const Modules = (() => {

    // ── Utilidades ──────────────────────────────────────
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function showToast(msg, type = 'success') {
        const container = $('#toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function formatCurrency(val) {
        return '$' + Number(val || 0).toLocaleString('es-CO');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    function getHoy() {
        return new Date().toISOString().split('T')[0];
    }

    // ── DASHBOARD ───────────────────────────────────────
    const Dashboard = {
        render() {
            const reservas = Storage.getAll('reservas');
            const pedidos = Storage.getAll('pedidos');
            const despachos = Storage.getAll('despachos');
            const mesas = Storage.getAll('mesas');
            const hoy = getHoy();

            const reservasHoy = reservas.filter(r => r.fecha === hoy).length;
            const platosPendientes = pedidos.filter(p => p.estado !== 'entregado').reduce((sum, p) => {
                return sum + (p.platos || []).filter(pl => pl.estado !== 'listo').length;
            }, 0);
            const despachosActivos = despachos.filter(d => d.estado !== 'entregado').length;
            const mesasOcupadas = mesas.filter(m => m.estado === 'ocupada').length;

            return `
                <div class="page-header">
                    <h1>★ Dashboard ★</h1>
                </div>                <div class="stats-grid">
                    <div class="stat-card stat-reservas">
                        <div class="stat-number">${reservasHoy}</div>
                        <div class="stat-label">Reservas Hoy</div>
                    </div>
                    <div class="stat-card stat-pedidos">
                        <div class="stat-number">${platosPendientes}</div>
                        <div class="stat-label">Platos Pendientes</div>
                    </div>
                    <div class="stat-card stat-despachos">
                        <div class="stat-number">${despachosActivos}</div>
                        <div class="stat-label">Despachos Activos</div>
                    </div>
                    <div class="stat-card stat-mesas">
                        <div class="stat-number">${mesasOcupadas}/${mesas.length}</div>
                        <div class="stat-label">Mesas Ocupadas</div>
                    </div>
                </div>
                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3>Reservas de Hoy</h3>
                        ${Dashboard._reservasHoy(reservas, mesas)}
                    </div>
                    <div class="dashboard-card">
                        <h3>Pedidos Recientes</h3>
                        ${Dashboard._pedidosRecientes(pedidos)}
                    </div>
                </div>
            `;
        },
        _reservasHoy(reservas, mesas) {
            const hoy = getHoy();
            const items = reservas.filter(r => r.fecha === hoy);
            if (items.length === 0) return '<p class="empty-text">No hay reservas hoy</p>';
            return '<div class="list-compact">' + items.map(r => {
                const mesa = mesas.find(m => m.id === r.mesaId);
                const estadoClass = r.estado === 'confirmada' ? 'badge-success' :
                    r.estado === 'cancelada' ? 'badge-danger' : 'badge-warning';
                return `<div class="list-item">
                    <span class="badge ${estadoClass}">${r.estado}</span>
                    <span>Mesa ${mesa ? mesa.numero : r.mesaId}</span>
                    <span>${r.hora}</span>
                    <span>${r.personas} pers.</span>
                    <span>${r.cliente}</span>
                </div>`;
            }).join('') + '</div>';
        },
        _pedidosRecientes(pedidos) {
            const items = pedidos.slice(-5).reverse();
            if (items.length === 0) return '<p class="empty-text">No hay pedidos recientes</p>';
            return '<div class="list-compact">' + items.map(p => {
                const estadoClass = p.estado === 'entregado' ? 'badge-success' :
                    p.estado === 'cancelado' ? 'badge-danger' : 'badge-warning';
                const total = (p.platos || []).reduce((s, pl) => s + (pl.precio || 0), 0);
                return `<div class="list-item">
                    <span class="badge ${estadoClass}">${p.estado}</span>
                    <span>Pedido #${p.id}</span>
                    <span>Mesa ${p.mesaId}</span>
                    <span>${formatCurrency(total)}</span>
                </div>`;
            }).join('') + '</div>';
        }
    };

    // ── RESERVAS ────────────────────────────────────────
    const Reservas = {
        render() {
            const reservas = Storage.getAll('reservas');
            const mesas = Storage.getAll('mesas');
            const session = Auth.getSession();
            const puedeCrear = Auth.hasPermission('reservas');

            let html = `<div class="page-header">
                <h1>★ Reservas ★</h1>
                ${puedeCrear ? '<button class="btn btn-primary" onclick="App.showSection(\'reservas\'); document.getElementById(\'reserva-form-container\').classList.toggle(\'hidden\')">+ Nueva Reserva</button>' : ''}
            </div>`;

            if (puedeCrear) {
                html += `
                <div id="reserva-form-container" class="form-container hidden">
                    <form id="reserva-form" onsubmit="Modules.Reservas.guardar(event)">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Mesa *</label>
                                <select id="res-mesa" required>
                                    <option value="">Seleccionar mesa...</option>
                                    ${mesas.filter(m => m.estado === 'disponible').map(m =>
                                        `<option value="${m.id}">Mesa ${m.numero} (${m.capacidad} personas)</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fecha *</label>
                                <input type="date" id="res-fecha" value="${getHoy()}" required>
                            </div>
                            <div class="form-group">
                                <label>Hora *</label>
                                <input type="time" id="res-hora" required>
                            </div>
                            <div class="form-group">
                                <label>Personas *</label>
                                <input type="number" id="res-personas" min="1" max="20" required>
                            </div>
                            <div class="form-group full-width">
                                <label>Cliente *</label>
                                <input type="text" id="res-cliente" required placeholder="Nombre del cliente">
                            </div>
                            <div class="form-group full-width">
                                <label>Estado</label>
                                <select id="res-estado">
                                    <option value="pendiente">Pendiente</option>
                                    <option value="confirmada">Confirmada</option>
                                    <option value="cancelada">Cancelada</option>
                                </select>
                            </div>
                        </div>
                        <input type="hidden" id="res-id" value="">
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Guardar</button>
                            <button type="button" class="btn btn-secondary" onclick="Modules.Reservas.cancelar()">Cancelar</button>
                        </div>
                    </form>
                </div>`;
            }

            html += `<div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Mesa</th><th>Fecha</th><th>Hora</th>
                            <th>Personas</th><th>Cliente</th><th>Estado</th>${puedeCrear ? '<th>Acciones</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>`;

            if (reservas.length === 0) {
                html += `<tr><td colspan="${puedeCrear ? 8 : 7}" class="empty-row">No hay reservas registradas</td></tr>`;
            } else {
                reservas.sort((a, b) => (b.id || 0) - (a.id || 0)).forEach(r => {
                    const mesa = mesas.find(m => m.id === r.mesaId);
                    const estadoClass = r.estado === 'confirmada' ? 'badge-success' :
                        r.estado === 'cancelada' ? 'badge-danger' : 'badge-warning';
                    html += `<tr>
                        <td>${r.id}</td>
                        <td>Mesa ${mesa ? mesa.numero : r.mesaId}</td>
                        <td>${formatDate(r.fecha)}</td>
                        <td>${r.hora}</td>
                        <td>${r.personas}</td>
                        <td>${Storage.sanitize(r.cliente)}</td>
                        <td><span class="badge ${estadoClass}">${r.estado}</span></td>
                        ${puedeCrear ? `<td class="actions">
                            <button class="btn btn-sm btn-warning" onclick="Modules.Reservas.editar(${r.id})">Editar</button>
                            <button class="btn btn-sm btn-danger" onclick="Modules.Reservas.eliminar(${r.id})">Eliminar</button>
                        </td>` : ''}
                    </tr>`;
                });
            }

            html += '</tbody></table></div>';
            return html;
        },

        guardar(event) {
            event.preventDefault();
            const id = $('#res-id').value;
            const datos = {
                mesaId: parseInt($('#res-mesa').value),
                fecha: $('#res-fecha').value,
                hora: $('#res-hora').value,
                personas: parseInt($('#res-personas').value),
                cliente: Storage.sanitize($('#res-cliente').value.trim()),
                estado: $('#res-estado').value
            };

            const missing = Storage.validateRequired(['mesaId', 'fecha', 'hora', 'personas', 'cliente'], datos);
            if (missing.length > 0) {
                showToast('Complete todos los campos obligatorios', 'error');
                return;
            }

            if (id) {
                datos.id = parseInt(id);
                // Si cambió la mesa, liberar la anterior
                const anterior = Storage.getById('reservas', parseInt(id));
                if (anterior && anterior.mesaId !== datos.mesaId) {
                    Reservas._liberarMesa(anterior.mesaId);
                }
                Storage.put('reservas', datos);
                showToast('Reserva actualizada', 'success');
            } else {
                Storage.add('reservas', datos);
                showToast('Reserva creada', 'success');
            }

            Reservas._actualizarMesa(datos.mesaId, datos.estado);
            App.showSection('reservas');
        },

        editar(id) {
            const r = Storage.getById('reservas', id);
            if (!r) return;
            $('#res-id').value = r.id;
            $('#res-mesa').value = r.mesaId;
            $('#res-fecha').value = r.fecha;
            $('#res-hora').value = r.hora;
            $('#res-personas').value = r.personas;
            $('#res-cliente').value = r.cliente;
            $('#res-estado').value = r.estado;
            $('#reserva-form-container').classList.remove('hidden');
        },

        eliminar(id) {
            if (!confirm('¿Eliminar esta reserva?')) return;
            const r = Storage.getById('reservas', id);
            if (r) Reservas._liberarMesa(r.mesaId);
            Storage.remove('reservas', id);
            showToast('Reserva eliminada', 'success');
            App.showSection('reservas');
        },

        cancelar() {
            $('#reserva-form-container').classList.add('hidden');
            $('#reserva-form').reset();
            $('#res-id').value = '';
        },

        _actualizarMesa(mesaId, estadoReserva) {
            const mesa = Storage.getById('mesas', mesaId);
            if (!mesa) return;
            if (estadoReserva === 'confirmada') {
                Storage.put('mesas', { ...mesa, estado: 'reservada' });
            } else if (estadoReserva === 'cancelada') {
                Storage.put('mesas', { ...mesa, estado: 'disponible' });
            }
        },

        _liberarMesa(mesaId) {
            const mesa = Storage.getById('mesas', mesaId);
            if (mesa) Storage.put('mesas', { ...mesa, estado: 'disponible' });
        }
    };

    // ── PEDIDOS ─────────────────────────────────────────
    const Pedidos = {
        render() {
            const pedidos = Storage.getAll('pedidos');
            const mesas = Storage.getAll('mesas');
            const platos = Storage.getAll('platos').filter(p => p.activo);
            const session = Auth.getSession();
            const puedeCrear = Auth.hasPermission('pedidos');

            let html = `<div class="page-header">
                <h1>★ Pedidos ★</h1>
                ${puedeCrear ? '<button class="btn btn-primary" onclick="Modules.Pedidos.mostrarFormulario()">+ Nuevo Pedido</button>' : ''}
            </div>`;

            if (puedeCrear) {
                html += `
                <div id="pedido-form-container" class="form-container hidden">
                    <form id="pedido-form" onsubmit="Modules.Pedidos.guardar(event)">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Mesa *</label>
                                <select id="ped-mesa" required>
                                    <option value="">Seleccionar mesa...</option>
                                    ${mesas.map(m => `<option value="${m.id}">Mesa ${m.numero} (${m.estado})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label>Agregar platos</label>
                                <div class="plato-selector">
                                    <select id="ped-plato-select">
                                        <option value="">Seleccionar plato...</option>
                                        ${platos.map(p => `<option value="${p.id}">${p.nombre} - ${formatCurrency(p.precio)}</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn-sm btn-primary" onclick="Modules.Pedidos.agregarPlato()">Agregar</button>
                                </div>
                                <div id="ped-platos-list" class="platos-seleccionados"></div>
                            </div>
                        </div>
                        <input type="hidden" id="ped-id" value="">
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Crear Pedido</button>
                            <button type="button" class="btn btn-secondary" onclick="Modules.Pedidos.cancelar()">Cancelar</button>
                        </div>
                    </form>
                </div>`;
            }

            html += `<div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Mesa</th><th>Platos</th><th>Total</th>
                            <th>Estado</th>${puedeCrear ? '<th>Acciones</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>`;

            if (pedidos.length === 0) {
                html += `<tr><td colspan="${puedeCrear ? 6 : 5}" class="empty-row">No hay pedidos registrados</td></tr>`;
            } else {
                pedidos.sort((a, b) => (b.id || 0) - (a.id || 0)).forEach(p => {
                    const mesa = mesas.find(m => m.id === p.mesaId);
                    const total = (p.platos || []).reduce((s, pl) => s + (pl.precio || 0), 0);
                    const estadoClass = p.estado === 'entregado' ? 'badge-success' :
                        p.estado === 'cancelado' ? 'badge-danger' : 'badge-warning';
                    const platosHtml = (p.platos || []).map(pl => `${pl.nombre}`).join(', ');

                    html += `<tr>
                        <td>${p.id}</td>
                        <td>Mesa ${mesa ? mesa.numero : p.mesaId}</td>
                        <td class="cell-truncate" title="${Storage.sanitize(platosHtml)}">${Storage.sanitize(platosHtml) || '-'}</td>
                        <td>${formatCurrency(total)}</td>
                        <td><span class="badge ${estadoClass}">${p.estado}</span></td>
                        ${puedeCrear ? `<td class="actions">
                            ${p.estado !== 'entregado' && p.estado !== 'cancelado' ? `<button class="btn btn-sm btn-success" onclick="Modules.Pedidos.cambiarEstado(${p.id})">Avanzar</button>` : ''}
                            ${p.estado === 'entregado' ? `<button class="btn btn-sm btn-secondary" onclick="Modules.Pedidos.cerrar(${p.id})">Cerrar</button>` : ''}
                            <button class="btn btn-sm btn-danger" onclick="Modules.Pedidos.eliminar(${p.id})">X</button>
                        </td>` : ''}
                    </tr>`;
                });
            }

            html += '</tbody></table></div>';
            return html;
        },

        _platosSeleccionados: [],

        mostrarFormulario() {
            Pedidos._platosSeleccionados = [];
            $('#pedido-form-container').classList.remove('hidden');
            Pedidos._renderPlatos();
        },

        agregarPlato() {
            const select = $('#ped-plato-select');
            const platoId = parseInt(select.value);
            if (!platoId) return;

            const plato = Storage.getById('platos', platoId);
            if (!plato) return;

            Pedidos._platosSeleccionados.push({
                platoId: plato.id,
                nombre: plato.nombre,
                precio: plato.precio,
                estado: 'pendiente'
            });
            Pedidos._renderPlatos();
            select.value = '';
        },

        _renderPlatos() {
            const container = $('#ped-platos-list');
            if (!container) return;
            if (Pedidos._platosSeleccionados.length === 0) {
                container.innerHTML = '<p class="empty-text">No hay platos seleccionados</p>';
                return;
            }
            container.innerHTML = Pedidos._platosSeleccionados.map((pl, i) => `
                <div class="plato-chip">
                    <span>${pl.nombre} - ${formatCurrency(pl.precio)}</span>
                    <button type="button" class="btn-remove" onclick="Modules.Pedidos.quitarPlato(${i})">x</button>
                </div>
            `).join('');
        },

        quitarPlato(index) {
            Pedidos._platosSeleccionados.splice(index, 1);
            Pedidos._renderPlatos();
        },

        guardar(event) {
            event.preventDefault();
            const mesaId = parseInt($('#ped-mesa').value);
            const platos = Pedidos._platosSeleccionados;

            if (!mesaId) { showToast('Seleccione una mesa', 'error'); return; }
            if (platos.length === 0) { showToast('Agregue al menos un plato', 'error'); return; }

            const pedido = {
                mesaId,
                platos,
                estado: 'pendiente',
                fecha: getHoy(),
                hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            };

            Storage.add('pedidos', pedido);

            // Marcar mesa como ocupada
            const mesa = Storage.getById('mesas', mesaId);
            if (mesa) Storage.put('mesas', { ...mesa, estado: 'ocupada' });

            showToast('Pedido creado', 'success');
            Pedidos.cancelar();
            App.showSection('pedidos');
        },

        cambiarEstado(id) {
            const pedido = Storage.getById('pedidos', id);
            if (!pedido) return;
            const session = Auth.getSession();

            if (session.rol === 'mesero') {
                // Mesero envía a cocina
                if (pedido.estado === 'pendiente') {
                    pedido.estado = 'en_cocina';
                }
            } else if (session.rol === 'cocina') {
                // Cocina marca platos como listos
                pedido.platos.forEach(pl => {
                    if (pl.estado === 'pendiente') pl.estado = 'en_preparacion';
                    else if (pl.estado === 'en_preparacion') pl.estado = 'listo';
                });
                const todosListos = pedido.platos.every(pl => pl.estado === 'listo');
                if (todosListos) pedido.estado = 'listo';
            } else if (session.rol === 'despacho') {
                if (pedido.estado === 'listo') pedido.estado = 'en_ruta';
                else if (pedido.estado === 'en_ruta') pedido.estado = 'entregado';
            } else if (session.rol === 'admin') {
                // Admin puede avanzar cualquier estado
                const estados = ['pendiente', 'en_cocina', 'listo', 'en_ruta', 'entregado'];
                const idx = estados.indexOf(pedido.estado);
                if (idx < estados.length - 1) pedido.estado = estados[idx + 1];
            }

            Storage.put('pedidos', pedido);
            showToast(`Pedido #${id} avanzado a: ${pedido.estado}`, 'success');
            App.showSection('pedidos');
        },

        cerrar(id) {
            const pedido = Storage.getById('pedidos', id);
            if (!pedido) return;
            Storage.put('pedidos', { ...pedido, estado: 'cerrado' });
            showToast('Pedido cerrado', 'success');
            App.showSection('pedidos');
        },

        eliminar(id) {
            if (!confirm('¿Eliminar este pedido?')) return;
            Storage.remove('pedidos', id);
            showToast('Pedido eliminado', 'success');
            App.showSection('pedidos');
        },

        cancelar() {
            $('#pedido-form-container').classList.add('hidden');
            $('#pedido-form').reset();
            Pedidos._platosSeleccionados = [];
        }
    };

    // ── COCINA ──────────────────────────────────────────
    const Cocina = {
        render() {
            const pedidos = Storage.getAll('pedidos');
            const mesas = Storage.getAll('mesas');
            const activos = pedidos.filter(p =>
                p.estado === 'en_cocina' || p.estado === 'listo' ||
                (p.platos || []).some(pl => pl.estado === 'pendiente' || pl.estado === 'en_preparacion')
            );

            let html = `<div class="page-header"><h1>★ Cocina ★</h1></div>`;

            if (activos.length === 0) {
                html += '<p class="empty-text">No hay pedidos en cocina</p>';
                return html;
            }

            html += '<div class="cocina-grid">';
            activos.forEach(p => {
                const mesa = mesas.find(m => m.id === p.mesaId);
                html += `
                <div class="cocina-card">
                    <div class="cocina-card-header">
                        <h3>Pedido #${p.id}</h3>
                        <span class="badge badge-warning">${p.estado}</span>
                        <span>Mesa ${mesa ? mesa.numero : p.mesaId}</span>
                    </div>
                    <div class="cocina-card-body">
                        ${(p.platos || []).map((pl, i) => {
                            const estadoClass = pl.estado === 'listo' ? 'badge-success' :
                                pl.estado === 'en_preparacion' ? 'badge-warning' : 'badge-secondary';
                            return `<div class="cocina-plato">
                                <span>${pl.nombre}</span>
                                <span class="badge ${estadoClass}">${pl.estado}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="cocina-card-footer">
                        <button class="btn btn-primary" onclick="Modules.Cocina.avanzarPedido(${p.id})">Avanzar Platos</button>
                    </div>
                </div>`;
            });
            html += '</div>';
            return html;
        },

        avanzarPedido(id) {
            const pedido = Storage.getById('pedidos', id);
            if (!pedido) return;

            pedido.platos.forEach(pl => {
                if (pl.estado === 'pendiente') pl.estado = 'en_preparacion';
                else if (pl.estado === 'en_preparacion') pl.estado = 'listo';
            });

            const todosListos = pedido.platos.every(pl => pl.estado === 'listo');
            if (todosListos) pedido.estado = 'listo';

            Storage.put('pedidos', pedido);
            showToast('Pedido actualizado', 'success');
            App.showSection('cocina');
        }
    };

    // ── DESPACHOS ───────────────────────────────────────
    const Despachos = {
        render() {
            const despachos = Storage.getAll('despachos');
            const pedidos = Storage.getAll('pedidos');
            const mesas = Storage.getAll('mesas');
            const session = Auth.getSession();

            let html = `<div class="page-header">
                <h1>★ Despachos ★</h1>
                ${Auth.hasPermission('despachos') ? '<button class="btn btn-primary" onclick="Modules.Despachos.crearDesdePedido()">+ Crear Despacho</button>' : ''}
            </div>`;

            html += `<div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Pedido</th><th>Mesa</th><th>Platos</th>
                            <th>Estado</th>${Auth.hasPermission('despachos') ? '<th>Acciones</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>`;

            if (despachos.length === 0) {
                html += `<tr><td colspan="${Auth.hasPermission('despachos') ? 6 : 5}" class="empty-row">No hay despachos</td></tr>`;
            } else {
                despachos.sort((a, b) => (b.id || 0) - (a.id || 0)).forEach(d => {
                    const pedido = Storage.getById('pedidos', d.pedidoId);
                    const mesa = pedido ? mesas.find(m => m.id === pedido.mesaId) : null;
                    const platosCount = pedido ? (pedido.platos || []).length : 0;
                    const estadoClass = d.estado === 'entregado' ? 'badge-success' :
                        d.estado === 'cancelado' ? 'badge-danger' : 'badge-warning';

                    html += `<tr>
                        <td>${d.id}</td>
                        <td>#${d.pedidoId}</td>
                        <td>Mesa ${mesa ? mesa.numero : '-'}</td>
                        <td>${platosCount} plato(s)</td>
                        <td><span class="badge ${estadoClass}">${d.estado}</span></td>
                        ${Auth.hasPermission('despachos') ? `<td class="actions">
                            ${d.estado !== 'entregado' && d.estado !== 'cancelado' ?
                                `<button class="btn btn-sm btn-success" onclick="Modules.Despachos.avanzar(${d.id})">Avanzar</button>` : ''}
                            <button class="btn btn-sm btn-danger" onclick="Modules.Despachos.eliminar(${d.id})">X</button>
                        </td>` : ''}
                    </tr>`;
                });
            }

            html += '</tbody></table></div>';
            return html;
        },

        crearDesdePedido() {
            const pedidos = Storage.getAll('pedidos').filter(p =>
                p.estado === 'listo' || p.estado === 'en_ruta'
            );

            if (pedidos.length === 0) {
                showToast('No hay pedidos listos para despachar', 'error');
                return;
            }

            const pedidosHtml = pedidos.map(p => {
                const mesa = Storage.getById('mesas', p.mesaId);
                return `<option value="${p.id}">Pedido #${p.id} - Mesa ${mesa ? mesa.numero : p.mesaId}</option>`;
            }).join('');

            const html = `
                <div class="modal-overlay" onclick="this.remove()">
                    <div class="modal" onclick="event.stopPropagation()">
                        <h3>Crear Despacho</h3>
                        <div class="form-group">
                            <label>Pedido *</label>
                            <select id="desp-pedido-id">${pedidosHtml}</select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="Modules.Despachos.confirmarCrear()">Crear</button>
                            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                        </div>
                    </div>
                </div>`;

            document.body.insertAdjacentHTML('beforeend', html);
        },

        confirmarCrear() {
            const pedidoId = parseInt($('#desp-pedido-id').value);
            if (!pedidoId) { showToast('Seleccione un pedido', 'error'); return; }

            Storage.add('despachos', {
                pedidoId,
                estado: 'en_preparacion',
                fecha: getHoy(),
                hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            });

            document.querySelector('.modal-overlay')?.remove();
            showToast('Despacho creado', 'success');
            App.showSection('despachos');
        },

        avanzar(id) {
            const despacho = Storage.getById('despachos', id);
            if (!despacho) return;

            const estados = ['en_preparacion', 'en_ruta', 'entregado'];
            const idx = estados.indexOf(despacho.estado);
            if (idx < estados.length - 1) {
                despacho.estado = estados[idx + 1];
            }

            if (despacho.estado === 'entregado') {
                const pedido = Storage.getById('pedidos', despacho.pedidoId);
                if (pedido) {
                    Storage.put('pedidos', { ...pedido, estado: 'entregado' });
                    const mesa = Storage.getById('mesas', pedido.mesaId);
                    if (mesa) Storage.put('mesas', { ...mesa, estado: 'disponible' });
                }
            }

            Storage.put('despachos', despacho);
            showToast(`Despacho #${id}: ${despacho.estado}`, 'success');
            App.showSection('despachos');
        },

        eliminar(id) {
            if (!confirm('¿Eliminar este despacho?')) return;
            Storage.remove('despachos', id);
            showToast('Despacho eliminado', 'success');
            App.showSection('despachos');
        }
    };

    // ── MESAS ───────────────────────────────────────────
    const Mesas = {
        render() {
            const mesas = Storage.getAll('mesas');
            let html = `<div class="page-header"><h1>★ Mesas ★</h1></div>`;
            html += '<div class="mesas-grid">';

            mesas.forEach(m => {
                let estadoClass = 'mesa-disponible';
                if (m.estado === 'reservada') estadoClass = 'mesa-reservada';
                else if (m.estado === 'ocupada') estadoClass = 'mesa-ocupada';

                html += `
                <div class="mesa-card ${estadoClass}" onclick="Modules.Mesas.toggleEstado(${m.id})">
                    <div class="mesa-numero">${m.numero}</div>
                    <div class="mesa-capacidad">${m.capacidad} personas</div>
                    <div class="mesa-estado">${m.estado}</div>
                </div>`;
            });

            html += '</div>';

            html += `<div class="mesas-legend">
                <div><span class="legend-dot mesa-disponible"></span> Disponible</div>
                <div><span class="legend-dot mesa-reservada"></span> Reservada</div>
                <div><span class="legend-dot mesa-ocupada"></span> Ocupada</div>
            </div>`;

            return html;
        },

        toggleEstado(id) {
            const mesa = Storage.getById('mesas', id);
            if (!mesa) return;
            const session = Auth.getSession();
            if (session.rol !== 'admin' && session.rol !== 'mesero') {
                showToast('Sin permisos para modificar mesas', 'error');
                return;
            }
            const estados = ['disponible', 'reservada', 'ocupada'];
            const idx = estados.indexOf(mesa.estado);
            mesa.estado = estados[(idx + 1) % estados.length];
            Storage.put('mesas', mesa);
            showToast(`Mesa ${mesa.numero}: ${mesa.estado}`, 'success');
            App.showSection('mesas');
        }
    };

    // ── USUARIOS (Admin) ────────────────────────────────
    const Usuarios = {
        render() {
            const usuarios = Storage.getAll('usuarios');
            let html = `<div class="page-header">
                <h1>★ Usuarios ★</h1>
                <div>
                    <button class="btn btn-danger" onclick="Modules.Usuarios.resetDemo()">Reset Demo</button>
                </div>
            </div>`;

            html += `<div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>`;

            usuarios.forEach(u => {
                const estadoClass = u.activo ? 'badge-success' : 'badge-danger';
                html += `<tr>
                    <td>${u.id}</td>
                    <td>${Storage.sanitize(u.usuario)}</td>
                    <td>${Storage.sanitize(u.nombre)}</td>
                    <td><span class="badge badge-info">${Auth.getRolLabel(u.rol)}</span></td>
                    <td><span class="badge ${estadoClass}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-warning" onclick="Modules.Usuarios.toggleActivo(${u.id})">
                            ${u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            return html;
        },

        toggleActivo(id) {
            const user = Storage.getById('usuarios', id);
            if (!user) return;
            user.activo = !user.activo;
            Storage.put('usuarios', user);
            showToast(`Usuario ${user.usuario}: ${user.activo ? 'activado' : 'desactivado'}`, 'success');
            App.showSection('usuarios');
        },

        resetDemo() {
            if (!confirm('¿Resetear todos los datos demo? Se perderán todos los cambios.')) return;
            Storage.resetDemoData();
            window.location.reload();
        }
    };

    return { Dashboard, Reservas, Pedidos, Cocina, Despachos, Mesas, Usuarios, showToast, formatCurrency, formatDate };
})();
