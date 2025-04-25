const OFFSET_wk_vtable_first_element     = 0x00D04580;
const OFFSET_wk_memset_import            = 0x028F9D38;
const OFFSET_wk___stack_chk_guard_import = 0x028F9A18;

const OFFSET_lk___stack_chk_guard        = 0x00069190;
const OFFSET_lk_pthread_create_name_np   = 0x00001B60;
const OFFSET_lk_pthread_join             = 0x0002FAD0;
const OFFSET_lk_pthread_exit             = 0x00020A80;
const OFFSET_lk__thread_list             = 0x000601A8;
const OFFSET_lk_sleep                    = 0x000237E0;
const OFFSET_lk_sceKernelGetCurrentCpu   = 0x00002D10;

const OFFSET_lc_memset                   = 0x000148F0;
const OFFSET_lc_setjmp                   = 0x0005E9B0;
const OFFSET_lc_longjmp                  = 0x0005EA00;

const OFFSET_WORKER_STACK_OFFSET         = 0x0007FB88;

let wk_gadgetmap = {
    "ret"    : 0x00000042,
    "pop rdi": 0x00043B7C,
    "pop rsi": 0x0008F33E,
    "pop rdx": 0x000156EA,
    "pop rcx": 0x00060DF3,
    "pop r8": 0x01262A4F,
    "pop r9" : 0x004E450C,
    "pop rax": 0x00084094,
    "pop rsp": 0x0005D293,

    "mov [rdi], rsi": 0x00118570,
    "mov [rdi], rax": 0x00C3A5C0,
    "mov [rdi], eax": 0x003FB6E6,

    "infloop": 0x000109E1,

    "shl rax, 4"     : 0x0011BBB6,
    // "shr rax, 3"     : 0x014F2BAC,
    // "shr rax, 4"     : 0x01C41CD4,

    //branching specific gadgets
    "cmp [rcx], eax" : 0x00204122,
    "sete al"        : 0x00B7B735,
    "seta al"        : 0x000CCFB4,
    "setb al"        : 0x001B7657,
    "setg al"        : 0x000708c9,
    "setl al"        : 0x01517692,
    "shl rax, 3"     : 0x01A43F03,
    "add rax, rcx"   : 0x0008F9FD,
    "mov rax, [rax]" : 0x0142E309,
    "inc dword [rax]": 0x017629AF,
};

// Syscall map for the specific offsets
let syscall_map = {
    0x001: 0x34230, // sys_exit
    0x002: 0x351E0, // sys_fork
    0x003: 0x33400, // sys_read
    0x004: 0x33360, // sys_write
    0x005: 0x33A00, // sys_open
    0x006: 0x34030, // sys_close
    0x007: 0x32C20, // sys_wait4
    0x00A: 0x34D20, // sys_unlink
    0x00C: 0x346B0, // sys_chdir
    0x00F: 0x340B0, // sys_chmod
    0x014: 0x33580, // sys_getpid
    0x017: 0x33080, // sys_setuid
    0x018: 0x34690, // sys_getuid
    0x019: 0x33A40, // sys_geteuid
    0x01B: 0x33AE0, // sys_recvmsg
    0x01C: 0x33D10, // sys_sendmsg
    0x01D: 0x34860, // sys_recvfrom
    0x01E: 0x32F80, // sys_accept
    0x01F: 0x32DA0, // sys_getpeername
    0x020: 0x34EC0, // sys_getsockname
    0x021: 0x349E0, // sys_access
    0x022: 0x34B60, // sys_chflags
    0x023: 0x34530, // sys_fchflags
    0x024: 0x35410, // sys_sync
    0x025: 0x339E0, // sys_kill
    0x027: 0x33480, // sys_getppid
    0x029: 0x34A40, // sys_dup
    0x02A: 0x333D0, // sys_pipe
    0x02B: 0x35080, // sys_getegid
    0x02C: 0x353D0, // sys_profil
    0x02F: 0x32F20, // sys_getgid
    0x031: 0x32F00, // sys_getlogin
    0x032: 0x34790, // sys_setlogin
    0x035: 0x33140, // sys_sigaltstack
    0x036: 0x332A0, // sys_ioctl
    0x037: 0x34570, // sys_reboot
    0x038: 0x34470, // sys_revoke
    0x03B: 0x34770, // sys_execve
    0x041: 0x34110, // sys_msync
    0x049: 0x33900, // sys_munmap
    0x04A: 0x34670, // sys_mprotect
    0x04B: 0x337F0, // sys_madvise
    0x04E: 0x339C0, // sys_mincore
    0x04F: 0x32E80, // sys_getgroups
    0x050: 0x33420, // sys_setgroups
    0x053: 0x32E60, // sys_setitimer
    0x056: 0x32C80, // sys_getitimer
    0x059: 0x344D0, // sys_getdtablesize
    0x05A: 0x348E0, // sys_dup2
    0x05C: 0x33F10, // sys_fcntl
    0x05D: 0x33A60, // sys_select
    0x05F: 0x32EC0, // sys_fsync
    0x060: 0x33DF0, // sys_setpriority
    0x061: 0x33640, // sys_socket
    0x062: 0x346D0, // sys_connect
    0x063: 0x35040, // sys_netcontrol
    0x064: 0x32C40, // sys_getpriority
    0x065: 0x34C60, // sys_netabort
    0x066: 0x34FE0, // sys_netgetsockinfo
    0x068: 0x34CE0, // sys_bind
    0x069: 0x33F50, // sys_setsockopt
    0x06A: 0x33240, // sys_listen
    0x071: 0x34250, // sys_socketex
    0x072: 0x33C20, // sys_socketclose
    0x074: 0x353F0, // sys_gettimeofday
    0x075: 0x354D0, // sys_getrusage
    0x076: 0x32C00, // sys_getsockopt
    0x078: 0x33E90, // sys_readv
    0x079: 0x33CF0, // sys_writev
    0x07A: 0x34940, // sys_settimeofday
    0x07C: 0x33880, // sys_fchmod
    0x07D: 0x340F0, // sys_netgetiflist
    0x07E: 0x34FC0, // sys_setreuid
    0x07F: 0x33BE0, // sys_setregid
    0
