export default class Service {
  constructor() {
    this.__services = [];
  }

  /**
   * Initialize the service
   *
   * @async
   */
  async init() {
    if (!this.node && !this.__isMasterService) {
      throw new Error(`You have to register the service "${ this.constructor.name }" at first`);
    }
    
    await this.initServices();
    this.__initialized = Date.now();
  }

  /**
   * Deinitialize the service
   *
   * @async
   */
  async deinit() {
    await this.deinitServices();
    this.__initialized = false;
  }

  /**
   * Destroy the service
   *
   * @async
   */
  async destroy() {
    await this.destroyServices();
    await this.deinit();
  }

  /**
   * Add the service
   *
   * @async
   * @param {string} name
   * @param {Service} service
   * @param {string} [type]
   * @returns {object}
   */
  async addService(name, service, type) {
    const index = this.__services.findIndex(s => s.name === name && s.type === type);
    index != -1 && this.__services.splice(index, 1);
    this.__services.push({ service, name, type });
    service.name = name;
    service.node = this;
    this.__initialized && !service.__initialized && await service.init();
    return service;
  }

  /**
   * Get the service
   *
   * @async
   * @param {string} name
   * @param {string} [type]
   * @returns {object}
   */
  async getService(name, type) {
    const res = this.__services.find(s => s.name === name && s.type == type);
    return res ? res.service : null;
  }

  /**
   * Remove the service
   *
   * @async
   * @param {string} name
   * @param {string} [type]
   */
  async removeService(name, type) {
    const index = this.__services.findIndex(s => s.name === name && s.type == type);
    
    if (index == -1) {
      return;
    }

    const res = this.__services[index];
    await res.service.destroy();
    this.__services.splice(index, 1);
  }

  /**
   * Initialize the services
   *
   * @async
   */
  async initServices() {
    for (let i = 0; i < this.__services.length; i++) {
      await this.__services[i].service.init();
    }
  }

  /**
   * Deinitialize the services
   *
   * @async
   */
  async deinitServices() {
    for (let i = this.__services.length - 1; i >= 0; i--) {
      await this.__services[i].service.deinit();
    }
  }

  /**
   * Destroy the services
   *
   * @async
   */
  async destroyServices() {
    for (let i = this.__services.length - 1; i >= 0; i--) {
      await this.__services[i].service.destroy();
    }

    this.__services = [];
  }

  /**
   * Check the service is initialized
   *
   * @returns {boolean}
   */
  isInitialized() {
    return !!this.__initialized;
  }

  /**
   * Get the service version
   *
   * @returns {string}
   */
  getVersion() {
    return `${this.constructor.codename}-${this.constructor.version.split('.').slice(0, -1).join('.')}`;
  }
}