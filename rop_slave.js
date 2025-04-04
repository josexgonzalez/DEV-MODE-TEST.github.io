let my_worker = this;

self.onmessage = function (event) {
    event.ports[0].postMessage(1);
}

class KernelSyscalls {
    constructor(p) {
        this.p = p; // Objeto de explotación con primitivas R/W
    }

    syscall(num, arg1 = 0, arg2 = 0, arg3 = 0, arg4 = 0, arg5 = 0, arg6 = 0) {
        return this.p.syscall(num, arg1, arg2, arg3, arg4, arg5, arg6);
    }

    kekcall() {
        console.log("Ejecutando syscall: kekcall (0x100000027)");
        return this.syscall(0x100000027);
        showTemporaryAlert("0x100000027");
    }

    kmem_alloc() {
        console.log("Ejecutando syscall: kmem_alloc (0x600000027)");
        let addr = this.syscall(0x600000027);
        return addr | 0xffffff8000000000n;
        showTemporaryAlert("0x600000027");
    }

    kproc_create() {
        console.log("Ejecutando syscall: kproc_create (0x700000027)");
        return this.syscall(0x700000027);
        showTemporaryAlert("0x700000027");
    }

    kstuff_check() {
        console.log("Ejecutando syscall: kstuff_check (0xffffffff00000027)");
        return this.syscall(0xffffffff00000027);
        showTemporaryAlert("0xffffffff00000027");
    }
}

// Supongamos que ya tienes el objeto de explotación listo (p)
const kernel = new KernelSyscalls(p);

console.log("kekcall:", kernel.kekcall());
console.log("kmem_alloc:", kernel.kmem_alloc().toString(16));
console.log("kproc_create:", kernel.kproc_create());
console.log("kstuff_check:", kernel.kstuff_check());

// Simulación de estructuras y funciones kernel en JavaScript

// Simulación de una dirección base (como si fuese kdata_address)
let kdata_address = 0x10000000;

// Offset simulado para kprintf
const kprintf_offset = 0x1234; // valor simbólico

// Función kprintf simulada
function kprintf(fmt, ...args) {
    // Reemplazo básico de %s, %d, %x, etc.
    const formatted = fmt.replace(/%#02lx|%s|%d|%x/g, () => args.shift());
    console.log(formatted);
}

// Simulación de lectura del registro MSR_LSTAR
function __readmsr(msr) {
    // En un entorno real leería el valor del registro
    // Aquí simulamos un valor arbitrario para demostración
    if (msr === 0xC0000082) {
        return 0xFFFFFFFF81000000; // valor simulado para LSTAR
    }
    return 0;
}

// Simulación de estructura de argumentos pasados desde el kernel
const kproc_args = {
    kdata_base: kdata_address
};

// Función de inicialización del "kernel"
function init_kernel() {
    // Simulación: normalmente se haría puntero a función desde memoria
    // Aquí ya tenemos la función kprintf definida
}

// Simulación del módulo de inicio
function module_start(args) {
    kdata_address = args.kdata_base;
    init_kernel();

    kprintf("Hello from kernel land! Let's check the MSR_LSTAR value!\n");
    kprintf("MSR_LSTAR => %#02lx\n", __readmsr(0xC0000082));

    return 1;
}

// Lanzamiento del módulo
module_start(kproc_args);
