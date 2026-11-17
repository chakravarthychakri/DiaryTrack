// ====================================================================
// Module: Settings & Configuration
// ====================================================================

const settingsModule = {
  async init() {
    await this.loadSettings();
  },

  async loadSettings() {
    try {
      const res = await api.getSettings();
      if (res.success) {
        const s = res.data;
        if (s.currency_symbol) state.currencySymbol = s.currency_symbol;
        if (s.tax_rate_percent) state.taxRatePercent = Number(s.tax_rate_percent);

        // Populate form fields
        for (const [key, val] of Object.entries(s)) {
          const el = document.getElementById(`setting-${key}`);
          if (el) el.value = val;
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  async saveSettings(e) {
    e.preventDefault();
    const payload = {
      shop_name: document.getElementById('setting-shop_name').value,
      tagline: document.getElementById('setting-tagline').value,
      currency_symbol: document.getElementById('setting-currency_symbol').value,
      tax_rate_percent: document.getElementById('setting-tax_rate_percent').value,
      expiry_warning_days: document.getElementById('setting-expiry_warning_days').value,
      phone: document.getElementById('setting-phone').value,
      email: document.getElementById('setting-email').value,
      address: document.getElementById('setting-address').value,
      receipt_header: document.getElementById('setting-receipt_header').value,
      receipt_footer: document.getElementById('setting-receipt_footer').value
    };

    try {
      await api.saveSettings(payload);
      state.currencySymbol = payload.currency_symbol;
      state.taxRatePercent = Number(payload.tax_rate_percent);
      ui.showToast('Shop settings saved successfully!', 'success');
      dashboardModule.loadStats();
    } catch (err) {
      console.error(err);
    }
  }
};
