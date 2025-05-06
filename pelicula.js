const mongoose = require('mongoose');

const peliculaSchema = new mongoose.Schema({
  Título: String,
  Año: Number,
  Categoría: String,
  Actores: [String],
  Sinopsis: String,
  usuario: {  // 👈 Relación con el usuario que la creó
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

// Usa explícitamente la colección 'movie'
module.exports = mongoose.model('Pelicula', peliculaSchema, 'movie');
