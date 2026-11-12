export type ContextLogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const levels: Record<ContextLogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

let currentLevel: ContextLogLevel = 'info';

const styles = {
    core: 'background:#42b883;color:#fff;font-weight:700;padding:2px 5px;border-radius:3px',
    devtools: 'background:#35495e;color:#fff;font-weight:700;padding:2px 5px;border-radius:3px',
};

/** Set the verbosity used by all vue-scoped-context packages. */
export function setContextLogLevel(level: ContextLogLevel): void {
    currentLevel = level;
}

/** Create a styled logger that shares verbosity with the core package. */
export function createContextLogger(
    packageName: 'vue-scoped-context' | 'vue-scoped-context-devtools' = 'vue-scoped-context',
) {
    const badge = packageName === 'vue-scoped-context' ? '[vue-scoped-context]' : '[vue-scoped-context-devtools]';
    const style = packageName === 'vue-scoped-context' ? styles.core : styles.devtools;

    const write = (level: Exclude<ContextLogLevel, 'silent'>, method: 'error' | 'warn' | 'info' | 'debug', message: string, ...details: unknown[]) => {
        if (levels[currentLevel] < levels[level]) {
            return;
        }

        console[method](`%c${badge}%c ${message}`, style, 'color:inherit', ...details);
    };

    return {
        error: (message: string, ...details: unknown[]) => write('error', 'error', message, ...details),
        warn: (message: string, ...details: unknown[]) => write('warn', 'warn', message, ...details),
        info: (message: string, ...details: unknown[]) => write('info', 'info', message, ...details),
        debug: (message: string, ...details: unknown[]) => write('debug', 'debug', message, ...details),
    };
}
