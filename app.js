const seed = {
  users: [
    { username: "admin", password: "admin", role: "admin", name: "Administrador" },
    { username: "his", password: "his", role: "his", name: "HIS" },
    { username: "lab", password: "lab", role: "lab", name: "Laboratorio" },
    { username: "far", password: "far", role: "far", name: "Farmacia" },
    { username: "fac", password: "fac", role: "fac", name: "Facturación" }
  ],
  pacientes: [],
  ordenes: [],
  resultados: [],
  dispensaciones: [],
  facturas: [],
  audit: []
};

const DB_KEY = "hospitalDB_v1";
const SESSION_KEY = "hospitalSession_v1";

function db() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return JSON.parse(JSON.stringify(seed));
  }
  return JSON.parse(raw);
}

function save(dbobj) {
  localStorage.setItem(DB_KEY, JSON.stringify(dbobj));
}

function audit(event, detail) {
  const d = db();
  d.audit.unshift({ ts: new Date().toISOString(), user: session()?.username || "-", event, detail });
  d.audit = d.audit.slice(0, 200);
  save(d);
}

function session() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(user, remember) {
  const payload = { username: user.username, role: user.role, name: user.name, remember: !!remember };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

const routes = {
  "/login": renderLogin,
  "/dashboard": renderDashboard,
  "/pacientes": renderPlaceholder("Pacientes"),
  "/ordenes": renderPlaceholder("Órdenes"),
  "/laboratorio": renderPlaceholder("Laboratorio"),
  "/farmacia": renderPlaceholder("Farmacia"),
  "/facturacion": renderPlaceholder("Facturación"),
  "/auditoria": renderAuditoria,};

function guard(path) {
  if (path === "/login") return true;
  if (!session()) {
    location.hash = "#/login";
    return false;
  }
  return true;
}

function syncNav() {
  const nav = document.getElementById("top-nav");
  const s = session();
  const userbox = document.getElementById("userbox");
  const userlabel = document.getElementById("userlabel");

  if (!s) {
    nav.classList.add("hidden");
    userbox.classList.add("hidden");
    return;
  }
  nav.classList.remove("hidden");
  userlabel.textContent = s.name || s.username;
  userbox.classList.remove("hidden");

  document.querySelectorAll('[data-role]').forEach(a => {
    const need = a.getAttribute("data-role");
    if (s.role === "admin" || s.role === need) a.classList.remove("hidden"); else a.classList.add("hidden");
  });
}


function router() {
  const hash = location.hash || "#/login";
  const path = hash.replace("#", "");
  if (!guard(path)) return;
  const fn = routes[path] || renderDashboard;
  fn();
  syncNav();
}


function mount(tplId) {
  const host = document.getElementById("app");
  const tpl = document.getElementById(tplId);
  host.innerHTML = "";
  host.appendChild(tpl.content.cloneNode(true));
}

function renderLogin() {
  mount("tpl-login");
  const s = session();
  if (s && s.remember) {
    document.getElementById("user").value = s.username;
    document.getElementById("remember").checked = true;
  }
  const f = document.getElementById("login-form");
  f.addEventListener("submit", e => {
    e.preventDefault();
    const u = document.getElementById("user").value.trim();
    const p = document.getElementById("pass").value.trim();
    const r = document.getElementById("remember").checked;
    const d = db();
    const found = d.users.find(x => x.username === u && x.password === p);
    if (!found) {
      alert("Usuario o contraseña inválidos");
      return;
    }
    setSession(found, r);
    audit("login", found.username);
    location.hash = "#/dashboard";
  });
}

function renderDashboard() {
  mount("tpl-dashboard");
  const d = db();
  document.getElementById("kpi-pac").textContent = d.pacientes.length;
  document.getElementById("kpi-ord").textContent = d.ordenes.length;
  document.getElementById("kpi-disp").textContent = d.dispensaciones.length;
}

function renderPlaceholder(title) {
  return function() {
    mount("tpl-placeholder");
    document.getElementById("ph-title").textContent = title;
    const list = document.getElementById("list");
    const q = document.getElementById("q");
    const btn = document.getElementById("btn-add");
    const s = session();
    let rows = [];
    if (title === "Pacientes") rows = db().pacientes.map(p => [p.doc, p.nombre, p.edad, p.tel]);
    if (title === "Órdenes") rows = db().ordenes.map(o => [o.id, o.docPac, o.tipo, o.estado]);
    if (title === "Laboratorio") rows = db().resultados.map(r => [r.ordenId, r.prueba, r.valor, r.ts]);
    if (title === "Farmacia") rows = db().dispensaciones.map(r => [r.ordenId, r.item, r.cant, r.ts]);
    if (title === "Facturación") rows = db().facturas.map(f => [f.id, f.ordenId, f.total, f.estado]);
    renderTable(list, rows, title);
    q.addEventListener("input", () => {
      const t = q.value.toLowerCase();
      const filtered = rows.filter(r => r.join(" ").toLowerCase().includes(t));
      renderTable(list, filtered, title);
    });
btn.addEventListener("click", () => openForm(title));
  };
}

function renderTable(host, rows, title) {
  let header = [];
  let template = "1fr 1fr 1fr 1fr";
  if (title === "Pacientes") { header = ["Documento","Nombre","Edad","Teléfono"]; template = "1.3fr 1.6fr .6fr 1.2fr"; }
  if (title === "Órdenes") { header = ["ID Orden","Doc Paciente","Tipo","Estado"]; template = "1.2fr 1.2fr 1fr 1fr"; }
  if (title === "Laboratorio") { header = ["ID Orden","Prueba","Valor","Fecha"]; template = "1.2fr 1.2fr 1fr 1.2fr"; }
  if (title === "Farmacia") { header = ["ID Orden","Medicamento","Cant","Fecha"]; template = "1.2fr 1.4fr .7fr 1.2fr"; }
  if (title === "Facturación") { header = ["ID Factura","ID Orden","Total","Estado"]; template = "1.3fr 1.2fr 1fr 1fr"; }
  if (title === "Auditoría") { header = ["Fecha","Usuario","Evento","Detalle"]; template = "1.8fr .8fr 1fr 1.2fr"; }
  if (!header.length && rows[0]) header = new Array(rows[0].length).fill("").map((_,i)=>"Col"+(i+1));
  const container = document.createElement("div");
  const h = document.createElement("div");
  h.className = "header";
  h.style.gridTemplateColumns = template;
  header.forEach(c => {
    const s = document.createElement("span");
    s.textContent = c;
    h.appendChild(s);
  });
  container.appendChild(h);
  rows.forEach(r => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = template;
    r.forEach(cell => {
      const s = document.createElement("span");
      s.textContent = cell;
      row.appendChild(s);
    });
    container.appendChild(row);
  });
  host.innerHTML = "";
  host.appendChild(container);
}

function openForm(title){
  const tpl=document.getElementById("tpl-modal");
  const node=tpl.content.cloneNode(true);
  document.body.appendChild(node);
  const backdrop=document.getElementById("modal-backdrop");
  const form=document.getElementById("modal-form");
  const titleEl=document.getElementById("modal-title");
  const cancelBtn=document.getElementById("modal-cancel");

  titleEl.textContent="Agregar " + title.slice(0,1).toUpperCase()+title.slice(1).toLowerCase();

  let fields=[];
  if(title==="Pacientes") fields=[{name:"doc",label:"Documento",type:"text"},{name:"nombre",label:"Nombre",type:"text"},{name:"edad",label:"Edad",type:"number"},{name:"tel",label:"Teléfono",type:"text"}];
  if(title==="Órdenes") fields=[{name:"docPac",label:"Documento paciente",type:"text"},{name:"tipo",label:"Tipo de orden",type:"text"}];
  if(title==="Laboratorio") fields=[{name:"ordenId",label:"ID de orden",type:"text"},{name:"prueba",label:"Prueba",type:"text"},{name:"valor",label:"Resultado",type:"text"}];
  if(title==="Farmacia") fields=[{name:"ordenId",label:"ID de orden",type:"text"},{name:"item",label:"Medicamento",type:"text"},{name:"cant",label:"Cantidad",type:"number"}];
  if(title==="Facturación") fields=[{name:"ordenId",label:"ID de orden",type:"text"},{name:"total",label:"Total",type:"number"}];

    form.innerHTML = "";
    fields.forEach(f=>{
    const wrap = document.createElement("label");
    wrap.textContent = f.label;
    const inp = document.createElement("input");
    inp.type = f.type;
    inp.id = f.name;
    inp.setAttribute("data-name", f.name);
    inp.required = true;
    const err = document.createElement("span");
    err.className = "field-error";
    err.textContent = "";
    wrap.appendChild(inp);
    wrap.appendChild(err);
    form.appendChild(wrap);
    });

    form.querySelectorAll("input").forEach(i=>{
    i.addEventListener("input", ()=>{
        i.classList.remove("error");
        const e = i.nextElementSibling;
        if (e) e.textContent = "";
    });
    });
  cancelBtn.addEventListener("click",()=>{backdrop.remove()});

form.addEventListener("submit", e=>{
  e.preventDefault();
  const d = db();

  const g = n => form.querySelector(`#${n}`);
  const V = n => g(n).value.trim();
  const setError = (input, msg) => {
    const err = input.nextElementSibling;
    if (msg) { input.classList.add("error"); err.textContent = msg; }
    else { input.classList.remove("error"); err.textContent = ""; }
  };

  const rules = {
    doc: /^[0-9]{5,15}$/,
    nombre: /^[A-Za-zÁÉÍÓÚÜÑ ]{3,60}$/,
    edad: /^(?:1[01]\d|[1-9]?\d|120)$/,
    tel: /^[0-9]{7,15}$/,
    docPac: /^[0-9]{5,15}$/,
    tipo: /^[A-Za-zÁÉÍÓÚÜÑ0-9 .,\-]{3,40}$/,
    ordenId: /^[A-Z0-9\-]{3,40}$/,
    prueba: /^[A-Za-zÁÉÍÓÚÜÑ0-9 .,\-]{3,60}$/,
    valor: /^[A-Za-zÁÉÍÓÚÜÑ0-9 .,%/\-]{1,40}$/,
    item: /^[A-Za-zÁÉÍÓÚÜÑ0-9 .,\-]{2,60}$/,
    cant: /^[0-9]{1,3}$/,
    total: /^\d+(\.\d{1,2})?$/
  };

  let ok = true;

  if (title === "Pacientes") {
    const doc = V("doc");
    const nombre = V("nombre");
    const edad = V("edad");
    const tel = V("tel");
    if (!rules.doc.test(doc) || d.pacientes.find(x=>x.doc===doc)) { setError(g("doc"), "Documento inválido/duplicado"); ok = false; } else setError(g("doc"), "");
    if (!rules.nombre.test(nombre)) { setError(g("nombre"), "Nombre inválido"); ok = false; } else setError(g("nombre"), "");
    if (!rules.edad.test(edad)) { setError(g("edad"), "Edad 0–120"); ok = false; } else setError(g("edad"), "");
    if (!rules.tel.test(tel)) { setError(g("tel"), "Teléfono inválido"); ok = false; } else setError(g("tel"), "");
    if (!ok) return;
    d.pacientes.push({ doc, nombre, edad, tel });
    save(d); audit("alta_paciente", doc);
  }

  if (title === "Órdenes") {
    const docPac = V("docPac");
    const tipo = V("tipo");
    if (!rules.docPac.test(docPac) || !d.pacientes.find(x=>x.doc===docPac)) { setError(g("docPac"), "Paciente no existe"); ok = false; } else setError(g("docPac"), "");
    if (!rules.tipo.test(tipo)) { setError(g("tipo"), "Tipo inválido"); ok = false; } else setError(g("tipo"), "");
    if (!ok) return;
    const id = "ORD-" + Math.random().toString(36).slice(2,8).toUpperCase();
    d.ordenes.push({ id, docPac, tipo, estado: "creada" });
    save(d); audit("crear_orden", id);
  }

  if (title === "Laboratorio") {
    const ordenId = V("ordenId");
    const prueba  = V("prueba");
    const valor   = V("valor");
    if (!rules.ordenId.test(ordenId) || !d.ordenes.find(x=>x.id===ordenId)) { setError(g("ordenId"), "Orden no existe"); ok = false; } else setError(g("ordenId"), "");
    if (!rules.prueba.test(prueba)) { setError(g("prueba"), "Prueba inválida"); ok = false; } else setError(g("prueba"), "");
    if (!rules.valor.test(valor)) { setError(g("valor"), "Resultado inválido"); ok = false; } else setError(g("valor"), "");
    if (!ok) return;
    d.resultados.push({ ordenId, prueba, valor, ts: new Date().toISOString() });
    const o = d.ordenes.find(x=>x.id===ordenId); o.estado = "resultado";
    save(d); audit("registrar_resultado", ordenId);
  }

  if (title === "Farmacia") {
    const ordenId = V("ordenId");
    const item    = V("item");
    const cant    = V("cant");
    if (!rules.ordenId.test(ordenId) || !d.ordenes.find(x=>x.id===ordenId)) { setError(g("ordenId"), "Orden no existe"); ok = false; } else setError(g("ordenId"), "");
    if (!rules.item.test(item)) { setError(g("item"), "Medicamento inválido"); ok = false; } else setError(g("item"), "");
    if (!rules.cant.test(cant) || Number(cant)<=0) { setError(g("cant"), "Cantidad inválida"); ok = false; } else setError(g("cant"), "");
    if (!ok) return;
    d.dispensaciones.push({ ordenId, item, cant, ts: new Date().toISOString() });
    save(d); audit("dispensar", ordenId + " " + item);
  }

  if (title === "Facturación") {
    const ordenId = V("ordenId");
    const total   = V("total");
    if (!rules.ordenId.test(ordenId) || !d.ordenes.find(x=>x.id===ordenId)) { setError(g("ordenId"), "Orden no existe"); ok = false; } else setError(g("ordenId"), "");
    if (!rules.total.test(total) || Number(total)<=0) { setError(g("total"), "Total inválido"); ok = false; } else setError(g("total"), "");
    if (!ok) return;
    const id = "FAC-" + Math.random().toString(36).slice(2,8).toUpperCase();
    d.facturas.push({ id, ordenId, total, estado: "generada" });
    save(d); audit("facturar", id);
  }

  document.getElementById("modal-backdrop").remove();
  location.reload();
});

}


function renderAuditoria() {
  mount("tpl-auditoria");
  const host = document.getElementById("audit-list");
  const rows = db().audit.map(a => [new Date(a.ts).toLocaleString(), a.user, a.event, a.detail]);
  renderTable(host, rows, "Auditoría");
}

function renderPerfil() {
  mount("tpl-perfil");
  const s = session();
  const box = document.getElementById("profile-box");
  box.innerHTML = `
    <p><strong>Usuario:</strong> ${s.username}</p>
    <p><strong>Nombre:</strong> ${s.name}</p>
    <p><strong>Rol:</strong> ${s.role}</p>
  `;
  document.getElementById("logout").addEventListener("click", () => {
    audit("logout", s.username);
    clearSession();
    location.hash = "#/login";
  });
}

window.addEventListener("hashchange", router);
window.addEventListener("load", router);
document.addEventListener("click", e=>{
  const box = document.getElementById("userbox");
  const drop = document.getElementById("userdrop");
  if (!box || !drop) return;
  if (e.target.closest("#userbtn")) {
    drop.classList.toggle("hidden");
  } else if (!e.target.closest("#userbox")) {
    drop.classList.add("hidden");
  }
});

document.addEventListener("keydown", e=>{
  if (e.key === "Escape") document.getElementById("userdrop")?.classList.add("hidden");
});

document.addEventListener("click", e=>{
  if (e.target.id === "logout-top") {
    const s = session();
    audit("logout", s?.username || "-");
    clearSession();
    location.hash = "#/login";
  }
});
