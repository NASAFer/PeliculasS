const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  esAdmin: { type: Boolean, default: false }, // 👈 campo nuevo para rol de administrador
  fecha_registro: { type: Date, default: Date.now }
});

// plugin para manejo con passport-local-mongoose
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);
