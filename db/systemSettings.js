const { EntitySchema } = require('typeorm');

const SystemSettings = new EntitySchema({
  name: 'SystemSettings',
  tableName: 'system_settings',
  columns: {
    id: { type: Number, primary: true },
    runSecurityCheck: { type: Boolean, default: false },
    testing: { type: Boolean, default: false },
    hk4Enabled: { type: Boolean, default: true },
    alertLocation: { type: String },
    pollingInterval: { type: Number },
    overrideOrefUrl: { type: String, nullable: true },
    supportedAlertCategories: { type: 'simple-json' },
  },
});

module.exports = [SystemSettings];
