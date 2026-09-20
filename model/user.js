class User {
  constructor({
    id,
    role,
    'creation-date': creationDate,
    'update-date': updateDate,
    encodedPasswd,
    tokenSecret,
    accessTokenHash,
    accessTokenExpiresAt,
  }) {
    this.id = id;
    this.role = role;
    this['creation-date'] = creationDate;
    this['update-date'] = updateDate;
    this.encodedPasswd = encodedPasswd;
    this.tokenSecret = tokenSecret;
    this.accessTokenHash = accessTokenHash;
    this.accessTokenExpiresAt = accessTokenExpiresAt;
  }

  static fromDatabase(userData, tokenSecret) {
    return new User({
      ...userData,
      'creation-date': userData.creationDate,
      'update-date': userData.updateDate,
      tokenSecret,
      accessTokenHash: userData.accessTokenHash,
      accessTokenExpiresAt: userData.accessTokenExpiresAt,
    });
  }

  toDatabase() {
    return {
      id: this.id,
      role: this.role,
      creationDate: this['creation-date'],
      updateDate: this['update-date'],
      encodedPasswd: this.encodedPasswd,
      tokenSecret: this.tokenSecret,
      accessTokenHash: this.accessTokenHash,
      accessTokenExpiresAt: this.accessTokenExpiresAt,
    };
  }

  toApi() {
    return {
      id: this.id,
      role: this.role,
      'creation-date': this['creation-date'],
      'update-date': this['update-date'],
      encodedPasswd: this.encodedPasswd,
    };
  }
}

module.exports = User;
