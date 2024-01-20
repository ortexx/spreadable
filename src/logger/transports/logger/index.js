import Service from "../../../service.js";

export default (Parent) => {
    /**
     * Logger transport interface
     */
    return class Logger extends (Parent || Service) {
        /**
         * @param {object} options
         */
        constructor(options = {}) {
            super(...arguments);
            this.options = options;
            this.levels = ['info', 'warn', 'error'];
            this.defaultLevel = 'info';
        }
        /**
         * Initialize the logger
         *
         * @async
         */
        async init() {
            this.setLevel(this.options.level === undefined ? this.defaultLevel : this.options.level);
            await super.init.apply(this, arguments);
        }
        /**
         * Deinitialize the logger
         *
         * @async
         */
        async deinit() {
            this.setLevel(false);
            await super.deinit.apply(this, arguments);
        }
        /**
         * Log by levels
         *
         * @async
         * @param {string} level
         */
        async log() {
            throw new Error('Method "log" is required for logger transport');
        }
        /**
         * Log info
         *
         * @async
         */
        async info(...args) {
            await this.log('info', ...args);
        }
        /**
         * Log a warning
         *
         * @async
         */
        async warn(...args) {
            await this.log('warn', ...args);
        }
        /**
         * Log an error
         *
         * @async
         */
        async error(...args) {
            await this.log('error', ...args);
        }
        /**
         * Check the log level is active
         *
         * @param {string} level
         */
        isLevelActive(level) {
            if (!this.level) {
                return false;
            }
            return this.levels.indexOf(level) >= this.levels.indexOf(this.level);
        }
        /**
         * Set the active level
         *
         * @param {string} level
         */
        setLevel(level) {
            if (level === false) {
                return this.level = false;
            }
            if (this.levels.indexOf(level) == -1) {
                throw new Error(`Wrong logger level "${level}"`);
            }
            this.level = level;
        }
    };
};
