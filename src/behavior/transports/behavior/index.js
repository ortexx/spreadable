import service from "../../../service.js";
const Service = service();
export default (Parent) => {
    /**
     * Behavior transport
     */
    return class Behavior extends (Parent || Service) {
        /**
         * @param {object} [options]
         */
        constructor(options = {}) {
            super(...arguments);
            Object.assign(this, options);
        }
    };
};
