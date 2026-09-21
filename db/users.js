const { EntitySchema } = require('typeorm');

const Permission = new EntitySchema({
  name: 'Permission',
  tableName: 'permissions',
  columns: {
    action: { type: String, primary: true },
    roles: { type: 'simple-json' },
    displayOrder: { type: Number, nullable: true },
    updatedAt: { type: 'bigint' },
  },
});

const UserAccount = new EntitySchema({
  name: 'UserAccount',
  tableName: 'users',
  columns: {
    id: { type: String, primary: true },
    role: { type: String },
    creationDate: { type: 'bigint', nullable: true },
    updateDate: { type: 'bigint', nullable: true },
    encodedPasswd: { type: String },
    tokenSecret: { type: String, nullable: true },
    accessTokenHash: { type: String, nullable: true },
    accessTokenExpiresAt: { type: 'bigint', nullable: true },
  },
});

module.exports = [UserAccount, Permission];
