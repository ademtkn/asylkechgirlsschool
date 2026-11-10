// Editor sign-in without a server.
// The GitHub token is encrypted (AES-GCM) with a random vault key; for every editor the vault key is
// encrypted again with a key derived from that editor's password (Argon2id, deliberately slow and
// memory-hard so short passwords are expensive to guess). All of it is stored in content/editors.json
// and published as admin/editors.json:
//   { vault: { iv, data }, editors: [{ username, name, role, salt, kdf, iv, key, created }] }
(function () {
  'use strict';
  var KDF = { alg: 'argon2id', m: 65536, t: 6, p: 1 }; // 64 MiB, 6 passes (≈0.5–1 s per try on a laptop)
  var enc = new TextEncoder(), dec = new TextDecoder();
  var b64 = function (u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  var unb64 = function (s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  var rnd = function (n) { return crypto.getRandomValues(new Uint8Array(n)); };
  var aes = function (raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); };
  function seal(raw, bytes) {
    var iv = rnd(12);
    return aes(raw).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, bytes); })
      .then(function (c) { return { iv: b64(iv), data: b64(new Uint8Array(c)) }; });
  }
  function open(raw, box) {
    return aes(raw).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.data)); })
      .then(function (p) { return new Uint8Array(p); });
  }
  function derive(password, salt, kdf) {
    return window.hashwasm.argon2id({
      password: password, salt: salt, parallelism: kdf.p, iterations: kdf.t, memorySize: kdf.m, hashLength: 32, outputType: 'binary',
    });
  }

  window.ADMIN_AUTH = {
    // Passwords: 4–6 Latin letters and digits. Usernames: 2–30 of a-z 0-9 . _ -
    PASSWORD: /^[A-Za-z0-9]{4,6}$/,
    USERNAME: /^[a-z0-9._-]{2,30}$/,
    b64: b64, unb64: unb64,
    // New vault for a GitHub token → { key: raw vault key, vault }
    newVault: function (token) {
      var key = rnd(32);
      return seal(key, enc.encode(JSON.stringify({ token: token }))).then(function (vault) { return { key: key, vault: vault }; });
    },
    sealToken: function (key, token) { return seal(key, enc.encode(JSON.stringify({ token: token }))); },
    openVault: function (key, vault) { return open(key, vault).then(function (p) { return JSON.parse(dec.decode(p)).token; }); },
    // Editor record carrying the vault key, locked with the editor's password
    lock: function (key, password, who) {
      var salt = rnd(16);
      return derive(password, salt, KDF).then(function (kek) { return seal(kek, key); }).then(function (box) {
        return { username: who.username, name: who.name || '', role: who.role || 'editor', salt: b64(salt), kdf: KDF, iv: box.iv, key: box.data, created: who.created || new Date().toISOString().slice(0, 10) };
      });
    },
    // Vault key from an editor record and password; rejects on a wrong password
    unlock: function (rec, password) {
      return derive(password, unb64(rec.salt), rec.kdf || KDF).then(function (kek) { return open(kek, { iv: rec.iv, data: rec.key }); });
    },
  };
})();
