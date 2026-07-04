// utils/shippingService.js
const YalidineProvider = require('./yalidineProvider');
const NordProvider = require('./nordProvider');

class ManualProvider {
  static async createParcel(order) {
    // Manual shipping doesn't connect to any external API
    return {
      tracking: order.yalidineTracking || `MAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      label: '',
    };
  }

  static async deleteParcel(tracking) {
    return true;
  }

  static async getParcelLatestStatus(tracking) {
    return null;
  }

  static mapStatusToOpzia(status) {
    return null;
  }
}

class ShippingService {
  static getProvider(name) {
    switch (name) {
      case 'yalidine':
        return YalidineProvider;
      case 'nord_and_back':
        return NordProvider;
      case 'manual':
        return ManualProvider;
      default:
        return YalidineProvider; // fallback to Yalidine
    }
  }

  static async createParcel(providerName, order) {
    const provider = this.getProvider(providerName);
    return await provider.createParcel(order);
  }

  static async deleteParcel(providerName, tracking) {
    const provider = this.getProvider(providerName);
    return await provider.deleteParcel(tracking);
  }

  static async getParcelLatestStatus(providerName, tracking) {
    const provider = this.getProvider(providerName);
    return await provider.getParcelLatestStatus(tracking);
  }

  static mapStatusToOpzia(providerName, status) {
    const provider = this.getProvider(providerName);
    return provider.mapStatusToOpzia(status);
  }
}

module.exports = ShippingService;
