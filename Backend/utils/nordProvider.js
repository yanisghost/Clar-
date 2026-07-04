// utils/nordProvider.js

class NordProvider {
  static async createParcel(order) {
    // Simulated Nord & Back parcel generation
    const mockTracking = `NORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return {
      tracking: mockTracking,
      label: `https://nordandback.dz/tracking/label?id=${mockTracking}`,
    };
  }

  static async deleteParcel(tracking) {
    // Simulated Nord & Back parcel cancellation
    return true;
  }

  static async getParcelLatestStatus(tracking) {
    // Simulated Nord & Back status query
    return {
      status: 'In Transit',
      location: 'Sidi Bel Abbès',
      reason: null,
      timestamp: new Date(),
    };
  }

  static mapStatusToOpzia(status) {
    const NORD_TO_OPZIA_STATUS = {
      'En préparation': 'confirmed',
      'Expédié': 'shipped',
      'In Transit': 'shipped',
      'Livré': 'delivered',
      'Retourné': 'cancelled',
      'Annulé': 'cancelled',
    };
    return NORD_TO_OPZIA_STATUS[status] || null;
  }
}

module.exports = NordProvider;
