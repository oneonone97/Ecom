class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  // Register a service with its dependencies
  register(name, factory, options = {}) {
    this.services.set(name, {
      factory,
      singleton: options.singleton || false,
      dependencies: options.dependencies || []
    });
  }

  // Register a singleton service
  registerSingleton(name, factory, dependencies = []) {
    this.register(name, factory, { singleton: true, dependencies });
  }

  // Register a transient service (new instance each time)
  registerTransient(name, factory, dependencies = []) {
    this.register(name, factory, { singleton: false, dependencies });
  }

  // Register an existing instance as singleton
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
  }

  // Resolve a service and its dependencies
  resolve(name) {
    // Check if it's a singleton and already instantiated
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Get service definition
    const serviceDefinition = this.services.get(name);
    if (!serviceDefinition) {
      throw new Error(`Service '${name}' not found`);
    }

    // Resolve dependencies
    const dependencies = serviceDefinition.dependencies.map(dep => this.resolve(dep));

    // Create instance
    const instance = serviceDefinition.factory(...dependencies);

    // Store as singleton if needed
    if (serviceDefinition.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  // Check if service is registered
  has(name) {
    return this.services.has(name) || this.singletons.has(name);
  }

  // Clear all services (useful for testing)
  clear() {
    this.services.clear();
    this.singletons.clear();
  }

  // Get all registered service names
  getRegisteredServices() {
    return Array.from(this.services.keys());
  }

  // Remove a service
  unregister(name) {
    this.services.delete(name);
    this.singletons.delete(name);
  }

  // Resolve multiple services at once
  resolveAll(names) {
    return names.map(name => this.resolve(name));
  }

  // Auto-register based on class dependencies (experimental)
  autoRegister(name, ClassConstructor, options = {}) {
    // Get constructor parameter names (simple approach)
    const factory = (...deps) => new ClassConstructor(...deps);
    this.register(name, factory, options);
  }
}

// Create a global container instance
const container = new DIContainer();

// Helper function to create factory functions
const createFactory = (Constructor) => (...dependencies) => new Constructor(...dependencies);

module.exports = { DIContainer, container, createFactory };